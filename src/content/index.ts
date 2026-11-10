// EarsUp content script: a play button on every chosen heading level. Click
// reads that section (heading + everything up to the next heading of the same
// or a higher level); the button turns coral and becomes Stop.
//
// All UI lives in one shadow-DOM overlay with position:fixed, so nothing is
// inserted into the page's own DOM (safe inside rich editors).
import { base64ToAudioBlob } from '../shared/text';
import {
  DEFAULTS,
  RATES,
  fmtRate,
  isAllowedOn,
  loadSettings,
  onSettingsChanged,
  saveSettings,
  type GeminiReply,
  type Msg,
  type Settings,
} from '../shared/settings';
import { MENU_CSS, OVERLAY_CSS, SNACK_CSS, TIP_CSS } from './overlay.css';
import { installTooltips } from '../shared/tooltip';
import { Follower, chunkRanges, collectSection, paragraphs, wordAt, type Mapped } from './follow';

declare global {
  interface Window {
    __earsUp?: boolean;
  }
}

if (!window.__earsUp) {
  window.__earsUp = true;
  void boot();
}

const SIZE = 26;
const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6c0 .5.6.8 1 .5l7.3-4.8a.6.6 0 0 0 0-1L6 2.7c-.4-.3-1 0-1 .5Z"/></svg>',
  stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="1.6"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3" width="3.2" height="10" rx="1"/><rect x="9.3" y="3" width="3.2" height="10" rx="1"/></svg>',
  prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M13 3.6v8.8c0 .5-.5.8-.9.5L5.6 8.5a.6.6 0 0 1 0-1l6.5-4.4c.4-.3.9 0 .9.5Z"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.5 3v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M3 3.6v8.8c0 .5.5.8.9.5l6.5-4.4a.6.6 0 0 0 0-1L3.9 3.1c-.4-.3-.9 0-.9.5Z"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>',
};

interface Engine {
  play(from: number): void;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(r: number): void;
}

async function boot() {
  let settings: Settings = await loadSettings().catch(() => DEFAULTS);
  // Site rules match the tab's address. Inside an embedded frame (a doc shown
  // inside claude.ai, say) that is the top page's URL, fetched from the
  // top frame's own EarsUp via the worker, and refreshed for single-page apps.
  const isTop = window === window.top;
  let pageUrl = location.href;
  let pageTitle = document.title;
  const refreshUrl = async () => {
    if (isTop) {
      pageUrl = location.href;
      return;
    }
    try {
      const top = await chrome.runtime.sendMessage<Msg, { url: string; title: string } | undefined>({ type: 'top-url' });
      if (top?.url) {
        pageUrl = top.url;
        pageTitle = top.title;
      }
    } catch {
      /* worker asleep or extension reloaded */
    }
  };
  await refreshUrl();

  // Follow-along highlighter; set up before syncTheme() first runs.
  const follow = new Follower();
  let pageDark = false;
  const lookFollow = () => follow.setLook(settings.followColor, pageDark);

  // ---- overlay --------------------------------------------------------------
  const hostEl = document.createElement('earsup-overlay');
  hostEl.style.cssText =
    'all:initial;position:fixed;inset:0 auto auto 0;width:0;height:0;margin:0;padding:0;border:0;overflow:visible;background:transparent;z-index:2147483647;';
  const root = hostEl.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${OVERLAY_CSS}${TIP_CSS}${SNACK_CSS}${MENU_CSS}</style><div class="hl" hidden></div>`;
  const hl = root.querySelector<HTMLDivElement>('.hl')!;
  document.documentElement.appendChild(hostEl);
  // Put the overlay in the browser's top layer so page overlays, dialogs and
  // stacking contexts can't sit on top of our buttons and swallow clicks.
  const raise = () => {
    try {
      if (!hostEl.popover) hostEl.popover = 'manual';
      if (hostEl.matches(':popover-open')) hostEl.hidePopover();
      hostEl.showPopover();
    } catch {
      /* popover unsupported: z-index still applies */
    }
  };
  raise();
  const tips = installTooltips(root, root);
  syncTheme();

  const buttons = new Map<HTMLElement, HTMLButtonElement>();
  const headingOf = new WeakMap<HTMLElement, HTMLElement>();
  // ---- follow-along ----------------------------------------------------------
  /** Chunk k started: light its sentence and its first word. */
  function followChunk(k: number) {
    if (!session || settings.followAlong === 'off') return follow.clear();
    const r = session.ranges[k];
    if (settings.followAlong === 'sentence') follow.showSentence(r.s, r.e);
    else follow.showSentence(0, 0);
    followWord(k, 0);
  }
  /** `off` chars into chunk k is being spoken. */
  function followWord(k: number, off: number) {
    if (!session || settings.followAlong === 'off') return;
    const r = session.ranges[k];
    const w = wordAt(session.map.text, r.s + Math.max(0, off), r.e);
    if (w) follow.showWord(w.s, w.e);
  }

  // Filled by the player and snackbar; declared before buildPlayer() runs.
  const playerActions: Record<string, () => void> = {};
  let hovered: HTMLElement | null = null;

  // ---- reading session ------------------------------------------------------
  let session: {
    heading: HTMLElement;
    last: Element | null;
    chunks: string[];
    index: number;
    paused: boolean;
    engine: Engine;
    chunkPara: number[];
    ranges: { s: number; e: number }[];
    map: Mapped;
    histId: string;
    reached: number;
  } | null = null;

  const player = buildPlayer();

  function setButton(btn: HTMLButtonElement, playing: boolean) {
    btn.classList.toggle('playing', playing);
    btn.innerHTML = playing ? ICON.stop : ICON.play;
    const label = playing ? 'Stop reading' : 'Read this section aloud';
    btn.dataset.tip = playing ? 'Stop reading (Esc)' : 'Read this section aloud';
    btn.setAttribute('aria-label', label);
    tips.refresh(btn);
    btn.setAttribute('aria-pressed', String(playing));
  }

  function selector() {
    return settings.levels.map((l) => 'h' + l).join(',') || 'h1';
  }

  function scan() {
    if (isTop) pageUrl = location.href;
    const active = isAllowedOn(pageUrl, settings);
    const found = new Set<HTMLElement>(
      active
        ? [...document.querySelectorAll<HTMLElement>(selector())].filter(
            (h) => h.textContent?.trim() && !hostEl.contains(h),
          )
        : [],
    );
    for (const [h, b] of buttons) {
      if (found.has(h) && h.isConnected) continue;
      if (session?.heading === h) stop();
      b.remove();
      buttons.delete(h);
    }
    for (const h of found) {
      if (buttons.has(h)) continue;
      const b = document.createElement('button');
      b.className = 'eu-btn';
      setButton(b, false);
      b.dataset.act = 'read';
      headingOf.set(b, h);
      root.appendChild(b);
      buttons.set(h, b);
    }
    place();
  }

  const range = document.createRange();
  function place() {
    const vw = innerWidth;
    const vh = innerHeight;
    for (const [h, b] of buttons) {
      const r = h.getBoundingClientRect();
      const offscreen = (r.width === 0 && r.height === 0) || r.bottom < 0 || r.top > vh;
      const showHover = settings.buttonVisibility === 'always' || hovered === h || session?.heading === h;
      if (offscreen) {
        b.style.display = 'none';
        continue;
      }
      range.selectNodeContents(h);
      const rects = range.getClientRects();
      const first = rects[0] ?? r;
      const last = rects[rects.length - 1] ?? r;
      let left =
        settings.buttonSide === 'left' ? first.left - SIZE - 8 : last.right + 8;
      if (left < 4) left = Math.min(last.right + 8, vw - SIZE - 4);
      if (left > vw - SIZE - 4) left = Math.max(4, first.left - SIZE - 8);
      b.style.display = 'flex';
      b.style.left = `${left}px`;
      b.style.top = `${first.top + (first.height - SIZE) / 2}px`;
      b.classList.toggle('ghost', !showHover);
    }
    placeHighlight();
  }

  function placeHighlight() {
    if (!session || !settings.highlight) {
      hl.hidden = true;
      return;
    }
    const hr = session.heading.getBoundingClientRect();
    const lr = session.last?.getBoundingClientRect() ?? hr;
    const top = hr.top - 8;
    const bottom = Math.max(hr.bottom, lr.bottom) + 8;
    if (bottom < 0 || top > innerHeight || hr.width === 0) {
      hl.hidden = true;
      return;
    }
    hl.hidden = false;
    hl.style.left = `${hr.left - 12}px`;
    hl.style.top = `${top}px`;
    hl.style.width = `${hr.width + 24}px`;
    hl.style.height = `${bottom - top}px`;
  }

  // ---- engines --------------------------------------------------------------
  function prevWordStart(text: string, i: number) {
    let j = Math.min(i, text.length - 1);
    while (j > 0 && !/\s/.test(text[j - 1])) j--;
    return j;
  }

  function browserEngine(): Engine {
    const synth = window.speechSynthesis;
    let token = 0;
    let estimator = 0;
    const voice = () => {
      const voices = synth.getVoices();
      if (settings.browserVoice) {
        const v = voices.find((x) => x.voiceURI === settings.browserVoice);
        if (v) return v;
      }
      const lang = (document.documentElement.lang || navigator.language || 'en').toLowerCase().slice(0, 2);
      const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
      const list = pool.length ? pool : voices;
      return (
        list.find((v) => /natural|online/i.test(v.name)) ??
        list.find((v) => /google/i.test(v.name)) ??
        list.find((v) => v.default) ??
        list[0] ??
        null
      );
    };
    const speakFrom = (i: number) => {
      const my = ++token;
      synth.cancel();
      const step = (k: number) => {
        if (my !== token || !session) return;
        if (k >= session.chunks.length) return finish();
        session.index = k;
        renderProgress();
        const u = new SpeechSynthesisUtterance(session.chunks[k]);
        const v = voice();
        if (v) {
          u.voice = v;
          u.lang = v.lang;
        }
        u.rate = settings.rate;
        u.pitch = settings.pitch;
        u.volume = settings.volume;
        // Word timing: exact from boundary events (local voices); online voices
        // send none, so estimate from elapsed time until one arrives.
        let gotBoundary = false;
        let startedAt = 0;
        const text = session.chunks[k];
        const tick = () => {
          if (my !== token || gotBoundary || !startedAt) return;
          const chars = ((performance.now() - startedAt) / 1000) * 14.5 * settings.rate;
          if (chars < text.length) {
            followWord(k, prevWordStart(text, Math.floor(chars)));
            estimator = window.setTimeout(tick, 110);
          }
        };
        u.onstart = () => {
          if (my !== token) return;
          startedAt = performance.now();
          followChunk(k);
          estimator = window.setTimeout(tick, 350);
        };
        u.onboundary = (e) => {
          if (my !== token || e.name !== 'word') return;
          gotBoundary = true;
          followWord(k, e.charIndex);
        };
        u.onend = () => {
          clearTimeout(estimator);
          step(k + 1);
        };
        u.onerror = (e) => {
          clearTimeout(estimator);
          if (my !== token || e.error === 'interrupted' || e.error === 'canceled') return;
          step(k + 1);
        };
        synth.resume();
        synth.speak(u);
      };
      setTimeout(() => step(i), 60); // Chrome can drop a speak() right after cancel()
    };
    return {
      play: speakFrom,
      // speechSynthesis.pause() is unreliable with Chrome's online voices, so
      // pausing cancels and resuming replays the current part from its start.
      pause: () => {
        token++;
        synth.cancel();
      },
      resume: () => session && speakFrom(session.index),
      stop: () => {
        token++;
        synth.cancel();
      },
      setRate: () => session && !session.paused && speakFrom(session.index),
    };
  }

  function geminiEngine(): Engine {
    const audio = new Audio();
    let token = 0;
    const cache = new Map<number, Promise<string>>();
    const urls: string[] = [];
    const fetchChunk = (k: number) => {
      if (!session || k >= session.chunks.length) return null;
      if (!cache.has(k)) {
        const text = session.chunks[k];
        cache.set(
          k,
          chrome.runtime.sendMessage<Msg, GeminiReply>({ type: 'gemini-speak', text }).then((r) => {
            if (!r?.ok) throw new Error(r?.error ?? 'Gemini did not answer.');
            const url = URL.createObjectURL(base64ToAudioBlob(r.audio));
            urls.push(url);
            return url;
          }),
        );
      }
      return cache.get(k)!;
    };
    const playFrom = async (k: number) => {
      const my = ++token;
      audio.pause();
      if (!session) return;
      if (k >= session.chunks.length) return finish();
      session.index = k;
      renderProgress();
      player.setLoading(true);
      try {
        const url = await fetchChunk(k)!;
        if (my !== token || !session) return;
        void fetchChunk(k + 1)?.catch(() => undefined); // prefetch
        audio.src = url;
        audio.playbackRate = settings.rate;
        audio.volume = settings.volume;
        audio.onended = () => my === token && void playFrom(k + 1);
        // No word timing from Gemini: estimate from how far the audio is.
        audio.onplaying = () => {
          if (my !== token) return;
          followChunk(k);
          const text = session?.chunks[k] ?? '';
          const loop = () => {
            if (my !== token || audio.paused || !audio.duration) return;
            followWord(k, prevWordStart(text, Math.floor((audio.currentTime / audio.duration) * text.length)));
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        };
        player.setLoading(false);
        if (!session.paused) await audio.play();
      } catch (e) {
        if (my !== token) return;
        player.setLoading(false);
        player.error(e instanceof Error ? e.message : String(e));
        finish(true);
      }
    };
    return {
      play: (i) => void playFrom(i),
      pause: () => audio.pause(),
      resume: () => void audio.play().catch(() => undefined),
      stop: () => {
        token++;
        audio.pause();
        audio.removeAttribute('src');
        urls.forEach((u) => URL.revokeObjectURL(u));
      },
      setRate: (r) => (audio.playbackRate = r),
    };
  }

  // ---- control --------------------------------------------------------------
  function start(h: HTMLElement) {
    stop();
    const map = collectSection(h);
    const { text, last } = map;
    // Chunk per paragraph (progress is reported in paragraphs), keeping each
    // chunk's position in the text so spoken words can be found on the page.
    const paraRanges = paragraphs(text);
    const paras = paraRanges.map((r) => text.slice(r.s, r.e));
    const chunks: string[] = [];
    const chunkPara: number[] = [];
    const ranges: { s: number; e: number }[] = [];
    const max = settings.engine === 'gemini' ? 900 : 220;
    paraRanges.forEach((p, i) =>
      chunkRanges(text, p.s, p.e, max).forEach((r) => {
        if (r.e <= r.s) return;
        chunks.push(text.slice(r.s, r.e));
        chunkPara.push(i);
        ranges.push(r);
      }),
    );
    if (!chunks.length) return;
    follow.use(map);
    lookFollow();
    const engine = settings.engine === 'gemini' ? geminiEngine() : browserEngine();
    const histId = crypto.randomUUID();
    session = { heading: h, last, chunks, chunkPara, ranges, map, histId, reached: 0, index: 0, paused: false, engine };
    raise(); // stay above anything the page opened since
    announceSoon(true);
    const btn = buttons.get(h);
    if (btn) setButton(btn, true);
    player.open(h.innerText.trim());
    engine.play(0);
    place();
    void chrome.runtime
      .sendMessage<Msg>({
        type: 'history-add',
        entry: {
          id: histId,
          title: h.innerText.trim().slice(0, 200),
          pageTitle: (isTop ? document.title : pageTitle || document.title).slice(0, 200),
          url: isTop ? location.href : pageUrl,
          engine: settings.engine,
          chars: text.length,
          // The heading is paras[0]; keep the body, capped so storage stays sane.
          paragraphs: capParas(paras.slice(1)),
          read: 0,
        },
      })
      .catch(() => undefined);
  }

  function announceSoon(reading: boolean) {
    queueMicrotask(() => announce(reading));
  }

  function stop() {
    if (!session) return;
    follow.clear();
    announceSoon(false);
    session.engine.stop();
    const btn = buttons.get(session.heading);
    if (btn) setButton(btn, false);
    session = null;
    player.close();
    place();
  }

  function stopByKey() {
    if (!session) return;
    stop();
    const key = settings.stopKey === 'Shift+Escape' ? 'Shift + Esc' : 'Esc';
    snack(`Stopped reading (${key}). Pressed it by mistake? You can change the stop key.`, 'Take me to settings', () => {
      void chrome.runtime.sendMessage<Msg>({ type: 'open-options', page: 'general' }).catch(() => undefined);
    });
  }

  // ---- snackbar -----------------------------------------------------------------
  let snackTimer = 0;
  function snack(text: string, action: string, onAction: () => void) {
    root.querySelector('.snack')?.remove();
    const el = document.createElement('div');
    el.className = 'snack';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="snack-text"></span><button class="snack-act" data-act="snack-go"></button><button class="ic snack-x" data-act="snack-x" data-tip="Dismiss" aria-label="Dismiss">${ICON.close}</button>`;
    el.querySelector('.snack-text')!.textContent = text;
    const go = el.querySelector<HTMLButtonElement>('.snack-act')!;
    go.textContent = action;
    go.dataset.tip = 'Open EarsUp settings to change the stop key';
    const close = () => {
      clearTimeout(snackTimer);
      el.classList.remove('in');
      setTimeout(() => el.remove(), 200);
    };
    playerActions['snack-go'] = () => (onAction(), close());
    playerActions['snack-x'] = close;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    clearTimeout(snackTimer);
    snackTimer = window.setTimeout(close, 8000);
    el.addEventListener('pointerenter', () => clearTimeout(snackTimer));
    el.addEventListener('pointerleave', () => (snackTimer = window.setTimeout(close, 4000)));
  }

  function finish(keepError = false) {
    if (!session) return;
    follow.clear();
    announceSoon(false);
    session.engine.stop();
    const btn = buttons.get(session.heading);
    if (btn) setButton(btn, false);
    session = null;
    if (keepError) player.idle();
    else player.close();
    place();
  }

  function togglePause() {
    if (!session) return;
    session.paused = !session.paused;
    if (session.paused) session.engine.pause();
    else session.engine.resume();
    player.setPaused(session.paused);
  }

  function setRate(r: number) {
    settings = { ...settings, rate: r };
    playerActions.showSpeed?.();
    playerActions.closeMenu?.();
    session?.engine.setRate(r);
    void saveSettings({ rate: r });
  }

  function jump(delta: number) {
    if (!session) return;
    const k = Math.max(0, Math.min(session.chunks.length - 1, session.index + delta));
    session.paused = false;
    player.setPaused(false);
    session.engine.play(k);
  }

  function renderProgress() {
    if (!session) return;
    player.progress(session.index + 1, session.chunks.length);
    // Paragraphs reached so far (the heading is paragraph 0, not stored).
    const reached = session.chunkPara[session.index];
    if (reached > session.reached) {
      session.reached = reached;
      void chrome.runtime
        .sendMessage<Msg>({ type: 'history-progress', id: session.histId, read: reached })
        .catch(() => undefined);
    }
  }

  function capParas(list: string[]) {
    const out: string[] = [];
    let total = 0;
    for (const p of list) {
      if (total + p.length > 60000) break;
      out.push(p);
      total += p.length;
    }
    return out;
  }

  // ---- clicks -----------------------------------------------------------------
  // Pages (rich editors, doc viewers) often catch clicks at the window in the
  // capture phase. We listen there too, act on pointerup as well as click (two
  // chances to get through), and stop the event so the page never sees it.
  const actOf = (e: Event): HTMLElement | null => {
    for (const n of e.composedPath()) {
      if (n === hostEl) break;
      if (n instanceof HTMLElement && n.dataset.act && root.contains(n) && !(n as HTMLButtonElement).disabled) return n;
    }
    return null;
  };
  const run = (el: HTMLElement) => {
    tips.hide(); // the page never sees this click, so the tooltip's own listener doesn't either
    if (el.dataset.act === 'read') {
      const h = headingOf.get(el);
      if (!h) return;
      if (session?.heading === h) stop();
      else start(h);
    } else if (el.dataset.act!.startsWith('rate:')) setRate(Number(el.dataset.act!.slice(5)));
    else playerActions[el.dataset.act!]?.();
  };
  let pressed: HTMLElement | null = null;
  let firedAt = 0;
  const swallow = (e: Event) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
  };
  addEventListener(
    'pointerdown',
    (e) => {
      pressed = e.button === 0 ? actOf(e) : null;
      if (pressed) swallow(e); // also keeps the page's focus and selection
    },
    true,
  );
  addEventListener(
    'pointerup',
    (e) => {
      const el = actOf(e);
      if (!el) return;
      swallow(e);
      if (el === pressed) {
        firedAt = performance.now();
        run(el);
      }
      pressed = null;
    },
    true,
  );
  addEventListener('mousedown', (e) => actOf(e) && swallow(e), true);
  addEventListener('mouseup', (e) => actOf(e) && swallow(e), true);
  addEventListener(
    'click',
    (e) => {
      const el = actOf(e);
      if (!el) return;
      swallow(e);
      // Keyboard (Enter/Space) arrives as click only; a pointer click already ran on pointerup.
      if (performance.now() - firedAt > 400) run(el);
    },
    true,
  );

  // ---- dragging the player -------------------------------------------------------
  const POS_KEY = 'playerPos';
  function clampTo(el: HTMLElement, x: number, y: number) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return { x: Math.max(8, Math.min(innerWidth - w - 8, x)), y: Math.max(8, Math.min(innerHeight - h - 8, y)) };
  }
  function place2(el: HTMLElement, x: number, y: number) {
    const p = clampTo(el, x, y);
    el.classList.add('placed');
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.bottom = 'auto';
  }
  function resetPosition(el: HTMLElement) {
    el.classList.remove('placed');
    el.style.left = el.style.top = el.style.bottom = '';
    void chrome.storage.local.remove(POS_KEY);
  }
  function applySavedPosition(el: HTMLElement) {
    void chrome.storage.local.get(POS_KEY).then((r) => {
      const p = r[POS_KEY] as { fx: number; fy: number } | undefined;
      if (p) requestAnimationFrame(() => place2(el, p.fx * innerWidth, p.fy * innerHeight));
    });
  }
  function enableDrag(el: HTMLElement) {
    let start: { px: number; py: number; x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || actOf(e)) return;
      const r = el.getBoundingClientRect();
      start = { px: e.clientX, py: e.clientY, x: r.left, y: r.top };
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      place2(el, start.x + e.clientX - start.px, start.y + e.clientY - start.py);
    });
    const end = (e: PointerEvent) => {
      if (!start) return;
      start = null;
      el.classList.remove('dragging');
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      if (el.classList.contains('placed'))
        void chrome.storage.local.set({ [POS_KEY]: { fx: r.left / innerWidth, fy: r.top / innerHeight } });
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', (e) => {
      if (!actOf(e)) resetPosition(el);
    });
    addEventListener('resize', () => {
      if (el.classList.contains('placed')) {
        const r = el.getBoundingClientRect();
        place2(el, r.left, r.top);
      }
    });
  }

  // ---- floating player ------------------------------------------------------
  function buildPlayer() {
    const el = document.createElement('div');
    el.className = 'player';
    el.hidden = true;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'EarsUp player');
    el.innerHTML = `
      <img class="mascot" alt="" draggable="false" data-tip="Drag to move the player. Double-click to put it back" src="${chrome.runtime.getURL('img/bunny-head.png')}">
      <div class="meta">
        <div class="title"></div>
        <div class="status" aria-live="polite"></div>
        <div class="bar"><span></span></div>
      </div>
      <div class="ctrls">
        <button class="ic prev" data-act="prev" data-tip="Go back one part" aria-label="Previous part">${ICON.prev}</button>
        <button class="ic main pp" data-act="pause" data-tip="Pause" aria-label="Pause">${ICON.pause}</button>
        <button class="ic next" data-act="next" data-tip="Skip to the next part" aria-label="Next part">${ICON.next}</button>
        <div class="speed-wrap">
          <button class="speed" data-act="speed" data-tip="Reading speed. Click to choose" aria-label="Reading speed" aria-haspopup="menu" aria-expanded="false"><span class="speed-val"></span><svg class="caret" viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div class="speed-menu" role="menu" aria-label="Reading speed" hidden></div>
        </div>
        <button class="ic close" data-act="close" data-tip="Stop reading and close the player" aria-label="Stop and close">${ICON.close}</button>
      </div>`;
    root.appendChild(el);
    const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
    const title = q<HTMLDivElement>('.title');
    const status = q<HTMLDivElement>('.status');
    const bar = q<HTMLSpanElement>('.bar span');
    const pp = q<HTMLButtonElement>('.pp');
    const speed = q<HTMLButtonElement>('.speed');
    const speedVal = q<HTMLSpanElement>('.speed-val');
    const menu = q<HTMLDivElement>('.speed-menu');
    const showSpeed = () => {
      speedVal.textContent = fmtRate(settings.rate);
      for (const it of menu.querySelectorAll<HTMLElement>('[role=menuitemradio]'))
        it.setAttribute('aria-checked', String(Math.abs(Number(it.dataset.act!.slice(5)) - settings.rate) < 0.001));
    };
    menu.innerHTML = RATES.map(
      (r) => `<button role="menuitemradio" data-act="rate:${r}" aria-checked="false">${fmtRate(r)}${r === 1 ? '<span>Normal</span>' : ''}</button>`,
    ).join('');
    const closeMenu = () => {
      menu.hidden = true;
      speed.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      showSpeed();
      // Open downward when the player has been dragged near the top.
      menu.classList.toggle('down', el.getBoundingClientRect().top < 300);
      menu.hidden = false;
      speed.setAttribute('aria-expanded', 'true');
      menu.querySelector<HTMLElement>('[aria-checked=true]')?.focus({ preventScroll: true });
    };
    playerActions.closeMenu = closeMenu;
    menu.addEventListener('keydown', (e) => {
      const items = [...menu.querySelectorAll<HTMLElement>('button')];
      const i = items.indexOf(root.activeElement as HTMLElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        speed.focus();
      }
    });
    addEventListener('pointerdown', (e) => {
      if (!menu.hidden && !e.composedPath().some((n) => n === menu || n === speed)) closeMenu();
    }, true);
    playerActions.prev = () => jump(-1);
    playerActions.next = () => jump(1);
    playerActions.close = () => (session ? stop() : api.close());
    playerActions.pause = togglePause;
    playerActions.speed = () => (menu.hidden ? openMenu() : closeMenu());
    playerActions.showSpeed = showSpeed;
    enableDrag(el);
    let partText = 'Reading';
    const api = {
      open(t: string) {
        if (!settings.miniPlayer) return;
        el.hidden = false;
        applySavedPosition(el);
        el.classList.remove('err');
        title.textContent = t;
        status.textContent = 'Reading';
        bar.style.transform = 'scaleX(0)';
        showSpeed();
        api.setPaused(false);
        requestAnimationFrame(() => session && el.classList.add('in'));
      },
      close() {
        el.classList.remove('in');
        setTimeout(() => {
          if (!session) el.hidden = true;
        }, 180);
      },
      idle() {
        pp.disabled = true;
      },
      progress(i: number, n: number) {
        bar.style.transform = `scaleX(${i / n})`;
        partText = n > 1 ? `Part ${i} of ${n}` : 'Reading';
        if (!el.classList.contains('loading')) status.textContent = partText;
        pp.disabled = false;
      },
      setPaused(p: boolean) {
        pp.innerHTML = p ? ICON.play : ICON.pause;
        const t = p ? 'Resume' : 'Pause';
        pp.dataset.tip = p ? 'Resume reading' : 'Pause reading';
        pp.setAttribute('aria-label', t);
        tips.refresh(pp);
        el.classList.toggle('paused', p);
      },
      setLoading(on: boolean) {
        el.classList.toggle('loading', on);
        status.textContent = on ? 'Fetching Gemini voice…' : partText;
      },
      error(m: string) {
        if (!settings.miniPlayer) return;
        el.hidden = false;
        el.classList.add('in', 'err');
        status.textContent = m;
      },
    };
    return api;
  }

  // ---- theme: follow the page's light/dark ------------------------------------
  function syncTheme() {
    const bg = getComputedStyle(document.body || document.documentElement).backgroundColor;
    const m = bg.match(/\d+(\.\d+)?/g);
    let dark = matchMedia('(prefers-color-scheme: dark)').matches;
    if (m && m.length >= 3 && (m[3] === undefined || Number(m[3]) > 0.5)) {
      const [r, g, b] = m.map(Number);
      dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
    }
    hostEl.setAttribute('data-dark', String(dark));
    if (dark !== pageDark) {
      pageDark = dark;
      lookFollow();
    }
  }

  // ---- wiring ---------------------------------------------------------------
  let raf = 0;
  const schedulePlace = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      place();
    });
  };
  let scanTimer = 0;
  const scheduleScan = () => {
    clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scan, 250);
  };

  addEventListener('scroll', schedulePlace, { capture: true, passive: true });
  addEventListener('resize', schedulePlace, { passive: true });
  addEventListener(
    'mousemove',
    (e) => {
      if (settings.buttonVisibility !== 'hover') return;
      let found: HTMLElement | null = null;
      for (const h of buttons.keys()) {
        const r = h.getBoundingClientRect();
        if (e.clientX >= r.left - 48 && e.clientX <= r.right + 48 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6) {
          found = h;
          break;
        }
      }
      if (found !== hovered) {
        hovered = found;
        schedulePlace();
      }
    },
    { passive: true },
  );
  // Stop key. Focus may be in a different frame from the one reading (a doc
  // embedded in claude.ai), so every frame forwards it to the whole tab.
  addEventListener(
    'keydown',
    (e) => {
      if (settings.stopKey === 'off' || e.key !== 'Escape' || e.repeat) return;
      if (root.querySelector('.speed-menu:not([hidden])')) return playerActions.closeMenu?.();
      if ((settings.stopKey === 'Shift+Escape') !== e.shiftKey) return;
      if (session) stopByKey();
      else void chrome.runtime.sendMessage<Msg>({ type: 'broadcast', command: 'stop-key' }).catch(() => undefined);
    },
    true,
  );

  // Space pauses/resumes while something in this tab is reading, unless the
  // user is typing (inputs, editors) or pressing a button.
  let tabReading = false;
  const typing = (e: KeyboardEvent) => {
    for (const n of e.composedPath()) {
      if (!(n instanceof HTMLElement)) continue;
      if (n === hostEl) return false;
      if (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(n.tagName) || n.getAttribute('role') === 'textbox') return true;
    }
    return false;
  };
  addEventListener(
    'keydown',
    (e) => {
      if (settings.pauseKey === 'off' || e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (!(session || tabReading) || typing(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      if (session) togglePause();
      else void chrome.runtime.sendMessage<Msg>({ type: 'broadcast', command: 'toggle-pause' }).catch(() => undefined);
    },
    true,
  );
  const announce = (reading: boolean) =>
    void chrome.runtime.sendMessage<Msg>({ type: 'reading-state', reading }).catch(() => undefined);
  addEventListener('pagehide', stop);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  setInterval(() => {
    if (!document.hidden) place();
  }, 1000);
  setInterval(syncTheme, 5000);

  if (!isTop) {
    let last = pageUrl;
    setInterval(async () => {
      await refreshUrl();
      if (pageUrl !== last) {
        last = pageUrl;
        scan();
      }
    }, 2000);
  }

  chrome.runtime.onMessage.addListener((msg: Msg, _sender, reply) => {
    if (msg.type === 'reading-state') {
      tabReading = msg.reading;
      return;
    }
    if (msg.type === 'top-url') {
      if (isTop) reply({ url: location.href, title: document.title });
      return;
    }
    if (msg.type !== 'command' || !session) return;
    if (msg.command === 'stop-key') stopByKey();
    else if (msg.command === 'stop-reading') stop();
    else togglePause();
  });

  onSettingsChanged((s) => {
    const followChanged = s.followAlong !== settings.followAlong || s.followColor !== settings.followColor;
    const engineChanged = s.engine !== settings.engine;
    settings = s;
    if (engineChanged || !isAllowedOn(pageUrl, s)) stop();
    if (followChanged) {
      lookFollow();
      if (s.followAlong === 'off') follow.clear();
      else if (session) followChunk(session.index);
    }
    scan();
  });

  scan();
}
