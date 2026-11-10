// One tooltip for every control. Any element with data-tip="…" shows it on
// hover (after a short delay) and on keyboard focus. Positioned with
// position:fixed above the element, flipping below when there's no room, and
// clamped to the viewport so it never clips in the narrow side panel.
//
// `root` is the document or a shadow root; `layer` is where the bubble lives.

const DELAY = 380;

export function installTooltips(root: Document | ShadowRoot, layer: HTMLElement | ShadowRoot, className = 'tip') {
  const tip = document.createElement('div');
  tip.className = className;
  tip.setAttribute('role', 'tooltip');
  tip.id = 'eu-tip';
  tip.hidden = true;
  layer.appendChild(tip);

  let target: HTMLElement | null = null;
  let timer = 0;

  const find = (e: Event): HTMLElement | null => {
    for (const n of e.composedPath()) {
      if (n instanceof HTMLElement && n.dataset.tip) return n;
      if (n === root) break;
    }
    return null;
  };

  const show = (el: HTMLElement) => {
    target = el;
    tip.textContent = el.dataset.tip ?? '';
    tip.hidden = false;
    tip.classList.remove('in');
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const gap = 8;
    let top = r.top - t.height - gap;
    let below = false;
    if (top < 6) {
      top = r.bottom + gap;
      below = true;
    }
    const left = Math.max(6, Math.min(innerWidth - t.width - 6, r.left + r.width / 2 - t.width / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.dataset.below = String(below);
    el.setAttribute('aria-describedby', tip.id);
    requestAnimationFrame(() => tip.classList.add('in'));
  };

  const hide = () => {
    clearTimeout(timer);
    target?.removeAttribute('aria-describedby');
    target = null;
    tip.hidden = true;
    tip.classList.remove('in');
  };

  root.addEventListener('pointerover', (e) => {
    const el = find(e);
    if (el === target) return;
    hide();
    if (el) timer = window.setTimeout(() => show(el), DELAY);
  });
  root.addEventListener('pointerout', (e) => {
    const to = (e as PointerEvent).relatedTarget as Node | null;
    if (target && to && target.contains(to)) return;
    if (!find(e)) return;
    hide();
  });
  root.addEventListener('focusin', (e) => {
    const el = find(e);
    if (el && (el.matches(':focus-visible') || el.querySelector(':focus-visible'))) show(el);
  });
  root.addEventListener('focusout', hide);
  root.addEventListener('pointerdown', hide, true);
  addEventListener('scroll', hide, { capture: true, passive: true });
  addEventListener('keydown', (e) => e.key === 'Escape' && hide());

  return {
    /** Hide now, and cancel a tip that is waiting to appear (call on click). */
    hide,
    // Live text change (e.g. Play -> Stop) while the tip is open.
    refresh(el: HTMLElement) {
      if (target === el) tip.textContent = el.dataset.tip ?? '';
    },
  };
}
