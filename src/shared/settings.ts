// One settings object shared by the options page, content script and worker.
// Everything lives in chrome.storage.sync except the Gemini key, which stays
// in chrome.storage.local so it never syncs to other devices.

export type Engine = 'browser' | 'gemini';
export type Theme = 'system' | 'light' | 'dark';
export type HeadingLevel = 1 | 2 | 3 | 4;

export interface Settings {
  enabled: boolean;
  levels: HeadingLevel[];
  buttonSide: 'left' | 'right';
  buttonVisibility: 'always' | 'hover';
  highlight: boolean;
  miniPlayer: boolean;
  engine: Engine;
  browserVoice: string; // voiceURI, '' = automatic
  rate: number;
  pitch: number;
  volume: number;
  geminiModel: string;
  geminiVoice: string;
  geminiStyle: string;
  siteMode: 'everywhere' | 'only';
  blockedSites: string[];
  allowedSites: string[];
  historyLimit: number;
  stopKey: 'Escape' | 'Shift+Escape' | 'off';
  pauseKey: 'Space' | 'off';
  followAlong: 'off' | 'word' | 'sentence';
  followColor: 'yellow' | 'green' | 'pink' | 'cyan';
  theme: Theme;
}

export const DEFAULTS: Settings = {
  enabled: true,
  levels: [1, 2, 3],
  buttonSide: 'left',
  buttonVisibility: 'always',
  highlight: true,
  miniPlayer: true,
  engine: 'browser',
  browserVoice: '',
  rate: 1,
  pitch: 1,
  volume: 1,
  geminiModel: 'gemini-3.8-flash-tts',
  geminiVoice: 'Kore',
  geminiStyle: '',
  siteMode: 'everywhere',
  blockedSites: [],
  allowedSites: [],
  historyLimit: 50,
  stopKey: 'Escape',
  pauseKey: 'Space',
  followAlong: 'sentence',
  followColor: 'yellow',
  theme: 'system',
};

export const RATES = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5];
export const fmtRate = (r: number) => `${r.toFixed(2).replace(/\.?0+$/, '')}×`;

export const GEMINI_KEY = 'geminiApiKey';
export const HISTORY_KEY = 'history';

export interface HistoryEntry {
  id: string;
  title: string;
  pageTitle: string;
  url: string;
  at: number;
  engine: Engine;
  chars: number;
  /** The section's paragraphs (heading excluded), as read. Older entries have none. */
  paragraphs?: string[];
  /** How many of those paragraphs were reached before stopping. */
  read?: number;
}

/** historyLimit value meaning "keep everything". */
export const HISTORY_ALL = -1;

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(null);
  return { ...DEFAULTS, ...(stored as Partial<Settings>) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

export function onSettingsChanged(fn: (s: Settings) => void): () => void {
  const listener = (_: unknown, area: string) => {
    if (area === 'sync') void loadSettings().then(fn);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** "https://www.Example.com/x" | "example.com" -> "example.com" */
export function normalizeHost(input: string): string {
  let s = input.trim().toLowerCase();
  if (!s) return '';
  try {
    if (!/^[a-z]+:\/\//.test(s)) s = 'https://' + s;
    s = new URL(s).hostname;
  } catch {
    return '';
  }
  return s.replace(/^www\./, '');
}

/**
 * A site rule is kept exactly as the user typed it. Two kinds:
 *  - a bare domain ("claude.ai"): matches that host and its subdomains;
 *  - a URL pattern ("https://claude.ai/chat/*"): `*` is a wildcard, a missing
 *    scheme means any scheme, and "www." is ignored on both sides.
 * Returns '' when the input can't be read as either.
 */
export function cleanRule(input: string): string {
  const s = input.trim();
  if (!s) return '';
  const isPattern = /[/*]/.test(s.replace(/^[a-z]+:\/\//i, '')) || /^[a-z]+:\/\//i.test(s);
  if (!isPattern) return normalizeHost(s);
  const host = s.replace(/^[a-z*]+:\/\//i, '').split('/')[0].replace(/\*\.?/g, '');
  return host.includes('.') || host === 'localhost' ? s : '';
}

/** A real URL to look up the rule's favicon, e.g. "https://claude.ai/". */
export function ruleSampleUrl(rule: string): string {
  const host = rule.replace(/^[a-z*]+:\/\//i, '').split('/')[0].replace(/^\*\.?/, '');
  return `https://${host}/`;
}

function stripWww(url: string): string {
  return url.replace(/^([a-z*]+:\/\/)?www\./i, '$1');
}

export function ruleMatches(url: string, rule: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!/[/*]/.test(rule.replace(/^[a-z]+:\/\//i, '')) && !/^[a-z]+:\/\//i.test(rule)) {
    const h = u.hostname.replace(/^www\./, '');
    return h === rule || h.endsWith('.' + rule);
  }
  let pat = stripWww(rule.trim());
  if (!/^[a-z*]+:\/\//i.test(pat)) pat = '*://' + pat;
  if (!/^[a-z*]+:\/\/[^/]*\//i.test(pat)) pat += '/*'; // host-only pattern covers every path
  const re = new RegExp(
    '^' + pat.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$',
    'i',
  );
  const target = stripWww(u.origin + u.pathname + u.search);
  return re.test(target) || re.test(target.replace(/\?.*$/, ''));
}

export function isAllowedOn(url: string, s: Settings): boolean {
  if (!s.enabled) return false;
  if (s.siteMode === 'only') return s.allowedSites.some((r) => ruleMatches(url, r));
  return !s.blockedSites.some((r) => ruleMatches(url, r));
}

// Prebuilt Gemini voices, used when the voices endpoint is unavailable.
export const GEMINI_VOICES: { name: string; tone: string }[] = [
  { name: 'Kore', tone: 'Firm' },
  { name: 'Puck', tone: 'Upbeat' },
  { name: 'Zephyr', tone: 'Bright' },
  { name: 'Charon', tone: 'Informative' },
  { name: 'Fenrir', tone: 'Excitable' },
  { name: 'Leda', tone: 'Youthful' },
  { name: 'Orus', tone: 'Firm' },
  { name: 'Aoede', tone: 'Breezy' },
  { name: 'Callirrhoe', tone: 'Easy-going' },
  { name: 'Autonoe', tone: 'Bright' },
  { name: 'Enceladus', tone: 'Breathy' },
  { name: 'Iapetus', tone: 'Clear' },
  { name: 'Umbriel', tone: 'Easy-going' },
  { name: 'Algieba', tone: 'Smooth' },
  { name: 'Despina', tone: 'Smooth' },
  { name: 'Erinome', tone: 'Clear' },
  { name: 'Algenib', tone: 'Gravelly' },
  { name: 'Rasalgethi', tone: 'Informative' },
  { name: 'Laomedeia', tone: 'Upbeat' },
  { name: 'Achernar', tone: 'Soft' },
  { name: 'Alnilam', tone: 'Firm' },
  { name: 'Schedar', tone: 'Even' },
  { name: 'Gacrux', tone: 'Mature' },
  { name: 'Pulcherrima', tone: 'Forward' },
  { name: 'Achird', tone: 'Friendly' },
  { name: 'Zubenelgenubi', tone: 'Casual' },
  { name: 'Vindemiatrix', tone: 'Gentle' },
  { name: 'Sadachbia', tone: 'Lively' },
  { name: 'Sadaltager', tone: 'Knowledgeable' },
  { name: 'Sulafat', tone: 'Warm' },
];

// ---- messages between content script, options page and worker ----
export type Msg =
  | { type: 'gemini-speak'; text: string; voice?: string; style?: string; model?: string }
  | { type: 'gemini-test-key'; key: string; model: string }
  | { type: 'history-add'; entry: Omit<HistoryEntry, 'at'> }
  | { type: 'history-progress'; id: string; read: number }
  | { type: 'open-options'; page?: string }
  | { type: 'command'; command: 'toggle-pause' | 'stop-reading' | 'stop-key' }
  | { type: 'broadcast'; command: 'toggle-pause' | 'stop-key' }
  | { type: 'reading-state'; reading: boolean }
  | { type: 'top-url' };

export type GeminiReply = { ok: true; audio: string } | { ok: false; error: string };
