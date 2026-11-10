import {
  DEFAULTS,
  GEMINI_KEY,
  HISTORY_ALL,
  HISTORY_KEY,
  loadSettings,
  type GeminiReply,
  type HistoryEntry,
  type Msg,
} from '../shared/settings';

const API = 'https://generativelanguage.googleapis.com/v1beta';

// Toolbar icon -> settings docked in Chrome's side panel on the right.
const dockPanel = () => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
void dockPanel();
chrome.runtime.onStartup.addListener(() => void dockPanel());

chrome.runtime.onInstalled.addListener((d) => {
  if (d.reason === 'install') void chrome.tabs.create({ url: chrome.runtime.getURL('options.html#welcome') });
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (!tab?.id) return;
  if (command === 'toggle-pause' || command === 'stop-reading') {
    const msg: Msg = { type: 'command', command };
    chrome.tabs.sendMessage(tab.id, msg).catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((msg: Msg, sender, reply) => {
  switch (msg.type) {
    case 'top-url':
      // Ask the tab's top frame (frameId 0) for its address.
      if (sender.tab?.id === undefined) return false;
      chrome.tabs
        .sendMessage(sender.tab.id, msg, { frameId: 0 })
        .then(reply)
        .catch(() => reply(undefined));
      return true;
    case 'gemini-speak':
      void geminiSpeak(msg).then(reply);
      return true;
    case 'gemini-test-key':
      void geminiTest(msg.key, msg.model).then(reply);
      return true;
    case 'history-add':
      void queueHistory(() => addHistory(msg.entry)).then(() => reply(true));
      return true;
    case 'history-progress':
      void queueHistory(() => setProgress(msg.id, msg.read));
      return false;
    case 'open-options': {
      // Prefer the side panel; Chrome only allows that right after a click,
      // so fall back to a tab when it refuses.
      const path = 'options.html' + (msg.page ? '#' + msg.page : '');
      const tabId = sender.tab?.id;
      const asTab = () => void chrome.tabs.create({ url: chrome.runtime.getURL(path) });
      if (tabId === undefined) asTab();
      else {
        void chrome.sidePanel.setOptions({ tabId, path, enabled: true }).catch(() => undefined);
        chrome.sidePanel.open({ tabId }).catch(asTab);
      }
      return false;
    }
    case 'broadcast':
      // A key was pressed in one frame; the reading may be in another.
      if (sender.tab?.id !== undefined) {
        const cmd: Msg = { type: 'command', command: msg.command };
        chrome.tabs.sendMessage(sender.tab.id, cmd).catch(() => undefined);
      }
      return false;
    case 'reading-state':
      // Tell every frame in the tab whether something is reading, so Space
      // is only taken over while it is.
      if (sender.tab?.id !== undefined) chrome.tabs.sendMessage(sender.tab.id, msg).catch(() => undefined);
      return false;
  }
  return false;
});

async function geminiCall(key: string, model: string, text: string, voice: string, style: string) {
  const part: Record<string, unknown> = { text };
  if (style.trim()) part.speech_metadata = { style: style.trim() };
  const res = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [part] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { voice } },
      },
    }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message ?? '';
    } catch {
      /* body was not JSON */
    }
    throw new Error(explain(res.status, detail));
  }
  const data = await res.json();
  const audio: string | undefined = data?.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data,
  )?.inlineData?.data;
  if (!audio) throw new Error('Gemini answered without audio. Check the model name in Voices.');
  return audio;
}

function explain(status: number, detail: string): string {
  if (status === 400 && /api key/i.test(detail)) return 'That Gemini API key is not valid.';
  if (status === 401 || status === 403) return 'Gemini refused the key. Check it in Voices.';
  if (status === 404) return 'Gemini does not know that model. Check the model name in Voices.';
  if (status === 429) return 'Gemini rate limit reached. Wait a minute, or switch to Chrome voices.';
  return `Gemini error ${status}${detail ? ': ' + detail : ''}`;
}

async function geminiSpeak(msg: Extract<Msg, { type: 'gemini-speak' }>): Promise<GeminiReply> {
  try {
    const key = (await chrome.storage.local.get(GEMINI_KEY))[GEMINI_KEY] as string | undefined;
    if (!key) return { ok: false, error: 'Add a Gemini API key in EarsUp → Voices first.' };
    const s = await loadSettings();
    const audio = await geminiCall(
      key,
      msg.model || s.geminiModel || DEFAULTS.geminiModel,
      msg.text,
      msg.voice || s.geminiVoice,
      msg.style ?? s.geminiStyle,
    );
    return { ok: true, audio };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function geminiTest(key: string, model: string): Promise<GeminiReply> {
  try {
    const audio = await geminiCall(key, model, 'Ears up! EarsUp is ready to read.', 'Kore', '');
    return { ok: true, audio };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Writes are serialized so a progress update can't race the add it follows.
let historyChain: Promise<unknown> = Promise.resolve();
function queueHistory(job: () => Promise<void>) {
  historyChain = historyChain.then(job, job);
  return historyChain;
}

const readHistory = async () =>
  ((await chrome.storage.local.get(HISTORY_KEY))[HISTORY_KEY] as HistoryEntry[] | undefined) ?? [];

async function addHistory(entry: Omit<HistoryEntry, 'at'>) {
  const s = await loadSettings();
  if (s.historyLimit === 0) return;
  const list = await readHistory();
  // Same section replayed: move it to the top instead of duplicating it.
  const rest = list.filter((h) => !(h.url === entry.url && h.title === entry.title));
  const next = [{ ...entry, at: Date.now() }, ...rest];
  await chrome.storage.local.set({ [HISTORY_KEY]: s.historyLimit === HISTORY_ALL ? next : next.slice(0, s.historyLimit) });
}

async function setProgress(id: string, read: number) {
  const list = await readHistory();
  const hit = list.find((h) => h.id === id);
  if (!hit || (hit.read ?? 0) >= read) return;
  hit.read = read;
  await chrome.storage.local.set({ [HISTORY_KEY]: list });
}
