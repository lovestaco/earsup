import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HISTORY_ALL,
  HISTORY_KEY,
  ruleSampleUrl,
  type GeminiReply,
  type HistoryEntry,
  type Msg,
  type Settings,
} from '../../shared/settings';
import { base64ToAudioBlob, chunkText } from '../../shared/text';
import { I } from '../icons';
import { useLocal, type Toast } from '../state';
import { Select } from '../ui/controls';

type Set = <K extends keyof Settings>(k: K, v: Settings[K]) => void;

const time = (t: number) => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(t);
const dayLabel = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(t);
};
/**
 * Link that opens the page scrolled to `text` and highlighted, using Chrome's
 * text fragments (#:~:text=start,end). Works when the text is in the page
 * itself; text inside an embedded frame can't be targeted, so the page opens at the top.
 */
const enc = (s: string) => encodeURIComponent(s).replace(/-/g, '%2D').replace(/,/g, '%2C').replace(/&/g, '%26');
function fragmentUrl(url: string, text: string) {
  const w = text.replace(/\s+/g, ' ').trim().split(' ');
  if (!w.length || !w[0]) return url;
  const base = url.replace(/#.*$/, '');
  const frag = w.length <= 8 ? enc(w.join(' ')) : `${enc(w.slice(0, 5).join(' '))},${enc(w.slice(-4).join(' '))}`;
  return `${base}#:~:text=${frag}`;
}

const words = (h: HistoryEntry) => (h.paragraphs ?? []).join(' ').split(/\s+/).filter(Boolean).length;

/** Plays history text in the panel itself, with the current voice settings. */
function useReplay(s: Settings, notify: Toast) {
  const [now, setNow] = useState<{ id: string; para: number } | null>(null);
  const token = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    token.current++;
    speechSynthesis.cancel();
    audio.current?.pause();
    setNow(null);
  };
  useEffect(() => stop, []);

  const play = (h: HistoryEntry, from: number) => {
    stop();
    const my = token.current;
    const paras = h.paragraphs ?? [];
    // from = -1 starts with the heading.
    const queue: { text: string; para: number }[] = [];
    if (from < 0) queue.push({ text: h.title, para: -1 });
    paras.slice(Math.max(0, from)).forEach((p, i) => {
      const para = Math.max(0, from) + i;
      chunkText(p, s.engine === 'gemini' ? 900 : 220).forEach((text) => queue.push({ text, para }));
    });
    let k = 0;
    const next = async () => {
      if (my !== token.current) return;
      if (k >= queue.length) return setNow(null);
      const { text, para } = queue[k++];
      setNow({ id: h.id, para });
      if (s.engine === 'gemini') {
        const r = await chrome.runtime.sendMessage<Msg, GeminiReply>({ type: 'gemini-speak', text });
        if (my !== token.current) return;
        if (!r?.ok) {
          notify(r?.error ?? 'Gemini did not answer');
          return setNow(null);
        }
        const a = (audio.current ??= new Audio());
        a.src = URL.createObjectURL(base64ToAudioBlob(r.audio));
        a.playbackRate = s.rate;
        a.volume = s.volume;
        a.onended = () => void next();
        void a.play();
      } else {
        const u = new SpeechSynthesisUtterance(text);
        const v = speechSynthesis.getVoices().find((x) => x.voiceURI === s.browserVoice);
        if (v) {
          u.voice = v;
          u.lang = v.lang;
        }
        u.rate = s.rate;
        u.pitch = s.pitch;
        u.volume = s.volume;
        u.onend = () => void next();
        u.onerror = (e) => {
          if (e.error !== 'interrupted' && e.error !== 'canceled') void next();
        };
        speechSynthesis.speak(u);
      }
    };
    void next();
  };
  return { now, play, stop };
}

export function History({ s, set, notify }: { s: Settings; set: Set; notify: Toast }) {
  const [list, save] = useLocal<HistoryEntry[]>(HISTORY_KEY, []);
  const [q, setQ] = useState('');
  const replay = useReplay(s, notify);

  const changeLimit = (n: number) => {
    set('historyLimit', n);
    if (n !== HISTORY_ALL) save(list.slice(0, n));
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (h) =>
        h.title.toLowerCase().includes(needle) ||
        h.pageTitle.toLowerCase().includes(needle) ||
        (h.paragraphs ?? []).some((p) => p.toLowerCase().includes(needle)),
    );
  }, [list, q]);

  const days = useMemo(() => {
    const out: { label: string; items: HistoryEntry[] }[] = [];
    for (const h of shown) {
      const label = dayLabel(h.at);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(h);
      else out.push({ label, items: [h] });
    }
    return out;
  }, [shown]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p>Everything you listened to, paragraph by paragraph, newest first. Kept in this browser only.</p>
        </div>
        {list.length > 0 && (
          <button className="btn danger" data-tip="Delete every entry" onClick={() => (replay.stop(), save([]), notify('History cleared'))}>
            <I.trash /> Clear all
          </button>
        )}
      </div>

      <div className="toolbar">
        <label className="search">
          <I.search />
          <input
            className="field"
            placeholder="Search what you listened to…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search history"
            data-tip="Searches headings, page titles and paragraph text"
          />
        </label>
        <Select
          label="Keep history"
          tip="How many sections to remember. Off stops saving and clears the list"
          value={s.historyLimit}
          onChange={changeLimit}
          options={[
            { value: 0, label: 'Off' },
            { value: 10, label: 'Latest 10' },
            { value: 25, label: 'Latest 25' },
            { value: 50, label: 'Latest 50' },
            { value: 100, label: 'Latest 100' },
            { value: HISTORY_ALL, label: 'All' },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <div className="card empty">
          <img src="img/bunny-logo.png" alt="" />
          <strong>{s.historyLimit === 0 ? 'History is off' : 'Nothing here yet'}</strong>
          <span>
            {s.historyLimit === 0
              ? 'Pick how much to keep above to start saving what you listen to.'
              : 'Press play on any heading. Every paragraph you hear shows up here.'}
          </span>
        </div>
      ) : shown.length === 0 ? (
        <div className="card empty">
          <img src="img/bunny-logo.png" alt="" />
          <strong>Nothing matches “{q}”</strong>
          <span>Try a word from the heading or the text.</span>
        </div>
      ) : (
        days.map((d) => (
          <section key={d.label} className="group">
            <h2>{d.label}</h2>
            <div className="h-list">
              {d.items.map((h) => (
                <Entry
                  key={h.id}
                  h={h}
                  q={q}
                  now={replay.now?.id === h.id ? replay.now.para : null}
                  onPlay={(from) => (replay.now?.id === h.id && from === -1 ? replay.stop() : replay.play(h, from))}
                  onCopy={() =>
                    void navigator.clipboard
                      .writeText([h.title, ...(h.paragraphs ?? [])].join('\n\n'))
                      .then(() => notify('Text copied'))
                  }
                  onCopyPara={(t) => void navigator.clipboard.writeText(t).then(() => notify('Paragraph copied'))}
                  onDelete={() => {
                    if (replay.now?.id === h.id) replay.stop();
                    save(list.filter((x) => x.id !== h.id));
                  }}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Entry({
  h,
  q,
  now,
  onPlay,
  onCopy,
  onDelete,
  onCopyPara,
}: {
  h: HistoryEntry;
  q: string;
  now: number | null;
  onPlay: (from: number) => void;
  onCopy: () => void;
  onDelete: () => void;
  onCopyPara: (text: string) => void;
}) {
  const headingLink = fragmentUrl(h.url, h.title);
  const paras = h.paragraphs ?? [];
  const read = Math.min(h.read ?? paras.length, paras.length);
  const long = paras.length > 4;
  const [open, setOpen] = useState(false);
  const matchHidden = !!q.trim() && paras.slice(3).some((p) => p.toLowerCase().includes(q.trim().toLowerCase()));
  const visible = open || !long || matchHidden ? paras : paras.slice(0, 3);
  const playing = now !== null;

  return (
    <article className={'h-card' + (playing ? ' is-playing' : '')}>
      <header className="h-head">
        <button
          className={'h-play' + (playing ? ' on' : '')}
          onClick={() => onPlay(-1)}
          aria-label={playing ? 'Stop' : 'Play this section'}
          data-tip={playing ? 'Stop' : 'Play this section from the heading'}
        >
          {playing ? <I.stop /> : <I.play />}
        </button>
        <div className="h-headtext">
          <div className="h-title">
            <Mark text={h.title} q={q} />
          </div>
          <div className="h-meta">
            <span className="h-time">{time(h.at)}</span>
            <span className="h-dot" aria-hidden="true" />
            <img
              className="fav"
              alt=""
              width={14}
              height={14}
              src={`${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(ruleSampleUrl(h.url))}&size=32`}
            />
            <a href={headingLink} target="_blank" rel="noreferrer" data-tip={`Open at this section: ${h.url}`}>
              {h.pageTitle || h.url}
            </a>
          </div>
        </div>
        <div className="h-actions">
          <button className="icon-btn" data-tip="Copy the heading and every paragraph" aria-label="Copy text" onClick={onCopy}>
            <I.copy />
          </button>
          <a className="icon-btn" data-tip="Open the page at this section" aria-label="Open page at this section" href={headingLink} target="_blank" rel="noreferrer">
            <I.external />
          </a>
          <button className="icon-btn danger" data-tip="Remove this entry" aria-label="Delete entry" onClick={onDelete}>
            <I.trash />
          </button>
        </div>
      </header>

      {paras.length > 0 ? (
        <div className="h-body">
          {visible.map((p, i) => (
            <div key={i}>
              {i === read && read < paras.length && (
                <div className="h-stop">
                  <span>You stopped here</span>
                </div>
              )}
              <div className={'h-para' + (i >= read ? ' unread' : '') + (now === i ? ' now' : '')}>
                <button
                  className="h-para-play"
                  aria-label={`Play from paragraph ${i + 1}`}
                  data-tip="Play from this paragraph"
                  onClick={() => onPlay(i)}
                >
                  <I.play />
                </button>
                <p>
                  <Mark text={p} q={q} />
                </p>
                <div className="h-para-acts">
                  <button className="icon-btn" aria-label={`Copy paragraph ${i + 1}`} data-tip="Copy this paragraph" onClick={() => onCopyPara(p)}>
                    <I.copy />
                  </button>
                  <a
                    className="icon-btn"
                    aria-label={`Open the page at paragraph ${i + 1}`}
                    data-tip="Open the page scrolled to this paragraph"
                    href={fragmentUrl(h.url, p)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <I.external />
                  </a>
                </div>
              </div>
            </div>
          ))}
          {long && !matchHidden && (
            <button className="h-more" onClick={() => setOpen((v) => !v)} data-tip={open ? 'Collapse to the first paragraphs' : 'Show the whole section'}>
              {open ? 'Show less' : `Show all ${paras.length} paragraphs`}
              <I.chevron />
            </button>
          )}
        </div>
      ) : (
        <p className="h-legacy">Saved before EarsUp kept paragraphs. Play it again on the page to keep the text.</p>
      )}

      <footer className="h-foot">
        <span className="badge muted">{h.engine === 'gemini' ? 'Gemini voice' : 'Chrome voice'}</span>
        {paras.length > 0 && (
          <span>
            Read {read} of {paras.length} paragraph{paras.length === 1 ? '' : 's'} · {words(h).toLocaleString()} words
          </span>
        )}
      </footer>
    </article>
  );
}

function Mark({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (!needle) return <>{text}</>;
  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return (
    <>
      {parts.map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))}
    </>
  );
}
