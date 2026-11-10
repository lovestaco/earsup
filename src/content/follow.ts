// Follow-along highlighting: the spoken word (and its sentence) light up on
// the page as EarsUp reads. Uses the CSS Custom Highlight API, so the page's
// DOM is never changed (safe in rich editors). Text is collected together with
// a map from every character back to its DOM text node + offset.

export interface Mapped {
  text: string;
  /** For each char of `text`: its source node and offset, or null for a synthetic break/space. */
  nodes: (Text | null)[];
  offs: number[];
  last: Element | null;
}

const BLOCK = /^(P|DIV|LI|UL|OL|TD|TH|TR|TABLE|BLOCKQUOTE|PRE|H[1-6]|DT|DD|DL|FIGCAPTION|SECTION|ARTICLE|HEADER|FOOTER|BR|HR)$/;
const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|BUTTON|INPUT|TEXTAREA|SELECT|IFRAME|CANVAS|EARSUP-OVERLAY)$/;
const WS = /[\s ]/;

/** The heading plus everything up to the next heading of the same or a higher level. */
export function collectSection(h: HTMLElement, maxChars = 40000): Mapped {
  const level = Number(h.tagName[1]);
  const nodes: (Text | null)[] = [];
  const offs: number[] = [];
  let text = '';
  let last: Element | null = null;

  const push = (ch: string, node: Text | null, off: number) => {
    text += ch;
    nodes.push(node);
    offs.push(off);
  };
  const breakLine = () => {
    while (text.endsWith(' ')) {
      text = text.slice(0, -1);
      nodes.pop();
      offs.pop();
    }
    if (text && !text.endsWith('\n')) push('\n', null, 0);
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeType === 1 &&
      (SKIP.test((n as Element).tagName.toUpperCase()) || (n as Element).getAttribute('aria-hidden') === 'true')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  walker.currentNode = h;
  let n: Node | null = h;
  let leftHeading = false;
  while (n) {
    if (n.nodeType === 1) {
      const el = n as Element;
      const tag = el.tagName.toUpperCase();
      if (n !== h && !h.contains(n)) {
        if (!leftHeading) {
          leftHeading = true;
          breakLine();
        }
        if (/^H[1-6]$/.test(tag) && Number(tag[1]) <= level) break;
        if (BLOCK.test(tag)) breakLine();
      }
    } else {
      const t = n as Text;
      const p = t.parentElement;
      const visible = !p || !('checkVisibility' in p) || p.checkVisibility();
      if (visible && t.data.trim()) {
        if (!h.contains(t)) {
          if (!leftHeading) {
            leftHeading = true;
            breakLine();
          }
          last = p;
        }
        const d = t.data;
        for (let i = 0; i < d.length; i++) {
          const ch = d[i];
          if (WS.test(ch)) {
            if (text && !text.endsWith(' ') && !text.endsWith('\n')) push(' ', t, i);
          } else push(ch, t, i);
        }
        if (text.length > maxChars) break;
      }
    }
    n = walker.nextNode();
  }
  breakLine();
  if (text.endsWith('\n')) {
    text = text.slice(0, -1);
    nodes.pop();
    offs.pop();
  }
  return { text, nodes, offs, last };
}

/** Paragraph ranges [start, end) of a mapped text. */
export function paragraphs(text: string): { s: number; e: number }[] {
  const out: { s: number; e: number }[] = [];
  let s = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      if (i > s) out.push({ s, e: i });
      s = i + 1;
    }
  }
  return out;
}

/** Sentence-sized chunks [start, end) inside one paragraph, at most ~max chars. */
export function chunkRanges(text: string, s: number, e: number, max: number): { s: number; e: number }[] {
  const re = /[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g;
  const para = text.slice(s, e);
  const sentences: { s: number; e: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(para))) {
    if (!m[0]) break;
    sentences.push({ s: s + m.index, e: s + m.index + m[0].length });
  }
  if (!sentences.length) sentences.push({ s, e });
  const out: { s: number; e: number }[] = [];
  let cur: { s: number; e: number } | null = null;
  for (const sen of sentences) {
    if (cur && sen.e - cur.s > max) {
      out.push(cur);
      cur = null;
    }
    cur = cur ? { s: cur.s, e: sen.e } : { ...sen };
  }
  if (cur) out.push(cur);
  // Split anything still far too long at word boundaries.
  return out.flatMap((c) => {
    if (c.e - c.s <= max * 1.4) return [trim(text, c)];
    const parts: { s: number; e: number }[] = [];
    let start = c.s;
    while (start < c.e) {
      let end = Math.min(c.e, start + max);
      if (end < c.e) {
        const sp = text.lastIndexOf(' ', end);
        if (sp > start) end = sp + 1;
      }
      parts.push(trim(text, { s: start, e: end }));
      start = end;
    }
    return parts;
  });
}

function trim(text: string, r: { s: number; e: number }) {
  let { s, e } = r;
  while (s < e && text[s] === ' ') s++;
  while (e > s && text[e - 1] === ' ') e--;
  return { s, e };
}

/** [start, end) of the word at or after `i`. */
export function wordAt(text: string, i: number, limit: number): { s: number; e: number } | null {
  let s = i;
  while (s < limit && /[\s\n]/.test(text[s])) s++;
  if (s >= limit) return null;
  let e = s;
  while (e < limit && !/[\s\n]/.test(text[e])) e++;
  return { s, e };
}

export type FollowMode = 'off' | 'word' | 'sentence';
export type FollowColor = 'yellow' | 'green' | 'pink' | 'cyan';

const COLORS: Record<FollowColor, { word: string; tint: string }> = {
  yellow: { word: '#ffd84d', tint: 'rgba(255, 216, 77, .22)' },
  green: { word: '#7ee787', tint: 'rgba(126, 231, 135, .2)' },
  pink: { word: '#ff8fc8', tint: 'rgba(255, 143, 200, .2)' },
  cyan: { word: '#6fe3ff', tint: 'rgba(111, 227, 255, .2)' },
};

/** Paints the current sentence and word with CSS custom highlights. */
export class Follower {
  private style = document.createElement('style');
  private word = new (globalThis as any).Highlight() as Highlight;
  private sentence = new (globalThis as any).Highlight() as Highlight;
  readonly supported = typeof CSS !== 'undefined' && 'highlights' in CSS;
  private map: Mapped | null = null;

  constructor() {
    if (!this.supported) return;
    this.word.priority = 2;
    this.sentence.priority = 1;
    CSS.highlights.set('earsup-word', this.word);
    CSS.highlights.set('earsup-sentence', this.sentence);
    (document.head ?? document.documentElement).appendChild(this.style);
  }

  /** Re-theme for the page: dark pages get coloured text, light pages a marker. */
  setLook(color: FollowColor, dark: boolean) {
    const c = COLORS[color] ?? COLORS.yellow;
    this.style.textContent = dark
      ? `::highlight(earsup-sentence){color:#fff}::highlight(earsup-word){color:${c.word};text-decoration:underline 2px ${c.word};text-underline-offset:4px}`
      : `::highlight(earsup-sentence){background-color:${c.tint}}::highlight(earsup-word){background-color:${c.word};color:#111}`;
    if (!this.style.isConnected) (document.head ?? document.documentElement).appendChild(this.style);
  }

  use(map: Mapped | null) {
    this.map = map;
    this.clear();
  }

  private range(s: number, e: number): Range | null {
    const m = this.map;
    if (!m) return null;
    // Skip synthetic chars (line breaks) at the edges.
    while (s < e && !m.nodes[s]) s++;
    while (e > s && !m.nodes[e - 1]) e--;
    if (s >= e) return null;
    try {
      const r = document.createRange();
      r.setStart(m.nodes[s]!, m.offs[s]);
      r.setEnd(m.nodes[e - 1]!, m.offs[e - 1] + 1);
      return r;
    } catch {
      return null; // the page changed under us
    }
  }

  showSentence(s: number, e: number) {
    if (!this.supported) return;
    this.sentence.clear();
    const r = this.range(s, e);
    if (r) this.sentence.add(r);
  }

  showWord(s: number, e: number) {
    if (!this.supported) return;
    this.word.clear();
    const r = this.range(s, e);
    if (r) this.word.add(r);
  }

  clear() {
    if (!this.supported) return;
    this.word.clear();
    this.sentence.clear();
  }
}
