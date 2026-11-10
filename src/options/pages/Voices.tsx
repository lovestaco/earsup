import { useEffect, useMemo, useRef, useState } from 'react';
import { GEMINI_KEY, GEMINI_VOICES, RATES, fmtRate, type GeminiReply, type Msg, type Settings } from '../../shared/settings';
import { base64ToAudioBlob } from '../../shared/text';
import { I } from '../icons';
import { useLocal, useVoices, type Toast } from '../state';
import { Group, Row, Select, Slider } from '../ui/controls';

type Set = <K extends keyof Settings>(k: K, v: Settings[K]) => void;

const SAMPLE = 'Ears up! This is how I will read your docs.';
const langName = (code: string) => {
  try {
    return new Intl.DisplayNames([navigator.language], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
};
const fmtX = (v: number) => `${v.toFixed(2).replace(/\.?0+$/, '')}×`;
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

export function Voices({ s, set, notify }: { s: Settings; set: Set; notify: Toast }) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stopPreview = () => {
    speechSynthesis.cancel();
    audio.current?.pause();
    setPreviewing(null);
  };
  useEffect(() => stopPreview, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Voices</h1>
          <p>Pick who reads to you. Chrome voices are free and private. Gemini sounds more natural but needs your own API key.</p>
        </div>
      </div>

      <div className="engine-pick" role="radiogroup" aria-label="Voice engine">
        <button
          className="engine"
          role="radio"
          aria-checked={s.engine === 'browser'}
          data-tip={s.engine === 'browser' ? 'In use. Free, and nothing leaves this computer' : 'Switch to Chrome voices: free, and nothing leaves this computer'}
          onClick={() => set('engine', 'browser')}
        >
          <span className="check">{s.engine === 'browser' && <I.check />}</span>
          <strong>
            <I.chip /> Chrome voices
          </strong>
          <span>Uses the voices already installed in Chrome and Windows.</span>
          <span className="tags">
            <span className="badge gold">Recommended</span>
            <span className="badge muted">Text stays on this computer</span>
          </span>
        </button>
        <button
          className="engine"
          role="radio"
          aria-checked={s.engine === 'gemini'}
          data-tip={s.engine === 'gemini' ? 'In use. Section text is sent to Google' : 'Switch to Gemini voices: needs an API key, sends text to Google'}
          onClick={() => set('engine', 'gemini')}
        >
          <span className="check">{s.engine === 'gemini' && <I.check />}</span>
          <strong>
            <I.cloud /> Gemini voices
          </strong>
          <span>Google's text-to-speech model. Needs a Gemini API key.</span>
          <span className="tags">
            <span className="badge muted">Sends text to Google</span>
          </span>
        </button>
      </div>

      <Group title="Playback">
        <Row label="Speed" hint="You can also change it from the floating player.">
          <Select
            label="Speed"
            tip="How fast EarsUp reads"
            value={s.rate}
            onChange={(v) => set('rate', v)}
            options={[...new Set([...RATES, s.rate])]
              .sort((a, b) => a - b)
              .map((r) => ({ value: r, label: r === 1 ? `${fmtRate(r)} (Normal)` : fmtRate(r) }))}
          />
        </Row>
        {s.engine === 'browser' && (
          <Row label="Pitch">
            <Slider label="Pitch" value={s.pitch} min={0.5} max={1.5} step={0.05} format={fmtX} onChange={(v) => set('pitch', v)} />
          </Row>
        )}
        <Row label="Volume">
          <Slider label="Volume" value={s.volume} min={0.1} max={1} step={0.05} format={fmtPct} onChange={(v) => set('volume', v)} />
        </Row>
      </Group>

      {s.engine === 'browser' ? (
        <BrowserVoices s={s} set={set} previewing={previewing} setPreviewing={setPreviewing} stopPreview={stopPreview} />
      ) : (
        <GeminiVoices
          s={s}
          set={set}
          notify={notify}
          previewing={previewing}
          setPreviewing={setPreviewing}
          stopPreview={stopPreview}
          audio={audio}
        />
      )}
    </div>
  );
}

function PreviewButton({ playing, onClick, busy }: { playing: boolean; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      className={'btn preview' + (playing ? ' primary' : '')}
      disabled={busy}
      data-tip={busy ? 'Getting a sample from Gemini' : playing ? 'Stop the sample' : 'Hear a short sample of this voice'}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {playing ? <I.stop /> : <I.play />}
      {busy ? 'Loading…' : playing ? 'Stop' : 'Preview'}
    </button>
  );
}

function VoiceCard({ active, onSelect, children }: { active: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <div
      className="voice"
      role="radio"
      tabIndex={0}
      aria-checked={active}
      data-tip={active ? 'This voice is in use' : 'Click to use this voice'}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {children}
    </div>
  );
}

function BrowserVoices({
  s,
  set,
  previewing,
  setPreviewing,
  stopPreview,
}: {
  s: Settings;
  set: Set;
  previewing: string | null;
  setPreviewing: (v: string | null) => void;
  stopPreview: () => void;
}) {
  const voices = useVoices();
  const [q, setQ] = useState('');
  const [lang, setLang] = useState(() => navigator.language.slice(0, 2));

  const langs = useMemo(() => {
    const set = new Set(voices.map((v) => v.lang.slice(0, 2)));
    return [...set].sort((a, b) => langName(a).localeCompare(langName(b)));
  }, [voices]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return voices
      .filter((v) => lang === 'all' || v.lang.startsWith(lang))
      .filter((v) => !needle || v.name.toLowerCase().includes(needle) || v.lang.toLowerCase().includes(needle))
      .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
  }, [voices, q, lang]);

  const preview = (v: SpeechSynthesisVoice | null, id: string) => {
    if (previewing === id) return stopPreview();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(SAMPLE);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    }
    u.rate = s.rate;
    u.pitch = s.pitch;
    u.volume = s.volume;
    u.onend = u.onerror = () => setPreviewing(null);
    setPreviewing(id);
    speechSynthesis.speak(u);
  };

  return (
    <>
      <div className="subhead">
        <h3>Chrome voices</h3>
        <span className="badge muted">{voices.length} installed</span>
      </div>
      <div className="toolbar">
        <label className="search">
          <I.search />
          <input className="field" data-tip="Filter voices by name or language code" placeholder="Search voices by name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search voices" />
        </label>
        <Select
          label="Language"
          tip="Show only voices for one language"
          value={lang}
          onChange={setLang}
          options={[{ value: 'all', label: 'All languages' }, ...langs.map((l) => ({ value: l, label: langName(l) }))]}
        />
      </div>
      <div className="voice-list" role="radiogroup" aria-label="Chrome voice">
        <VoiceCard active={!s.browserVoice} onSelect={() => set('browserVoice', '')}>
          <span className="voice-name">
            <span>Automatic</span>
            {!s.browserVoice && (
              <span className="badge active">
                <I.check /> Active
              </span>
            )}
          </span>
          <span className="voice-meta">
            <span>Best voice for each page's language, preferring natural-sounding ones</span>
          </span>
          <PreviewButton playing={previewing === 'auto'} onClick={() => preview(null, 'auto')} />
        </VoiceCard>
        {list.map((v) => {
          const active = s.browserVoice === v.voiceURI;
          return (
            <VoiceCard key={v.voiceURI} active={active} onSelect={() => set('browserVoice', v.voiceURI)}>
              <span className="voice-name">
                <span>{v.name.replace(/^(Microsoft|Google)\s+/, '')}</span>
                {active && (
                  <span className="badge active">
                    <I.check /> Active
                  </span>
                )}
                {!active && /natural|online/i.test(v.name) && <span className="badge gold">Natural</span>}
              </span>
              <span className="voice-meta">
                <span>
                  <I.globe /> {langName(v.lang)} · {v.lang}
                </span>
                <span>
                  {v.localService ? <I.chip /> : <I.cloud />} {v.localService ? 'On this computer' : 'Online voice'}
                </span>
                <span>{v.name.startsWith('Microsoft') ? 'Microsoft' : v.name.startsWith('Google') ? 'Google' : 'System'}</span>
              </span>
              <PreviewButton playing={previewing === v.voiceURI} onClick={() => preview(v, v.voiceURI)} />
            </VoiceCard>
          );
        })}
        {!list.length && (
          <div className="card empty">
            <img src="img/bunny-logo.png" alt="" />
            <strong>No voices match “{q}”</strong>
            <span>Try another name, or pick All languages.</span>
          </div>
        )}
      </div>
    </>
  );
}

function score(v: SpeechSynthesisVoice) {
  return (/natural/i.test(v.name) ? 4 : 0) + (/online/i.test(v.name) ? 2 : 0) + (/google/i.test(v.name) ? 1 : 0);
}

function GeminiVoices({
  s,
  set,
  notify,
  previewing,
  setPreviewing,
  stopPreview,
  audio,
}: {
  s: Settings;
  set: Set;
  notify: Toast;
  previewing: string | null;
  setPreviewing: (v: string | null) => void;
  stopPreview: () => void;
  audio: React.MutableRefObject<HTMLAudioElement | null>;
}) {
  const [key, saveKey] = useLocal<string>(GEMINI_KEY, '');
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ state: 'idle' });
  const [loading, setLoading] = useState<string | null>(null);
  const [model, setModel] = useState(s.geminiModel);
  const [style, setStyle] = useState(s.geminiStyle);

  useEffect(() => setDraft(key), [key]);

  const play = (b64: string, id: string) => {
    const a = (audio.current ??= new Audio());
    a.src = URL.createObjectURL(base64ToAudioBlob(b64));
    a.playbackRate = s.rate;
    a.volume = s.volume;
    a.onended = () => setPreviewing(null);
    setPreviewing(id);
    void a.play();
  };

  const runTest = async () => {
    const k = draft.trim();
    if (!k) return;
    setTest({ state: 'busy' });
    const r = await chrome.runtime.sendMessage<Msg, GeminiReply>({ type: 'gemini-test-key', key: k, model: s.geminiModel });
    if (r?.ok) {
      saveKey(k);
      setTest({ state: 'ok', msg: 'Key works. Saved on this computer only.' });
      play(r.audio, 'test');
    } else setTest({ state: 'err', msg: r?.error ?? 'No answer from Gemini.' });
  };

  const preview = async (name: string) => {
    if (previewing === name) return stopPreview();
    stopPreview();
    if (!key) return notify('Add and test your API key first');
    setLoading(name);
    const r = await chrome.runtime.sendMessage<Msg, GeminiReply>({ type: 'gemini-speak', text: SAMPLE, voice: name });
    setLoading(null);
    if (r?.ok) play(r.audio, name);
    else notify(r?.error ?? 'Gemini did not answer');
  };

  return (
    <>
      <div className="note" style={{ marginBottom: 20 }}>
        <I.warn />
        <div>
          With Gemini, the text of each section you play is sent to Google to make the audio. Don't use it on pages with
          customer data, health data, card numbers or anything confidential unless your security team has approved Gemini.
        </div>
      </div>

      <Group title="Gemini connection">
        <Row label="API key" hint="Stored in this browser only. It never syncs to your other devices." stack>
          <div className="key-row">
            <input
              className="field"
              type={show ? 'text' : 'password'}
              placeholder="Paste your Gemini API key"
              value={draft}
              onChange={(e) => (setDraft(e.target.value), setTest({ state: 'idle' }))}
              aria-label="Gemini API key"
              data-tip="Your key from Google AI Studio. Stays in this browser"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide key' : 'Show key'} data-tip={show ? 'Hide the key' : 'Show the key'}>
              <I.eye />
            </button>
            <button
              className="btn primary"
              data-tip="Checks the key with a short Gemini request, then saves it in this browser"
              onClick={() => void runTest()}
              disabled={!draft.trim() || test.state === 'busy'}
            >
              <I.key /> {test.state === 'busy' ? 'Testing…' : 'Test and save'}
            </button>
            {key && (
              <button className="btn danger" data-tip="Delete the saved key from this browser" onClick={() => (saveKey(''), setDraft(''), setTest({ state: 'idle' }))}>
                Remove
              </button>
            )}
          </div>
          {test.state === 'ok' && <div className="note ok"><I.check /> {test.msg}</div>}
          {test.state === 'err' && <div className="note err"><I.warn /> {test.msg}</div>}
          {!key && test.state === 'idle' && (
            <span className="row-label">
              <span>
                Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" data-tip="Opens Google AI Studio in a new tab">aistudio.google.com/apikey</a>.
              </span>
            </span>
          )}
        </Row>
        <Row label="Model" hint="Change this when Google releases a newer text-to-speech model.">
          <input
            className="field mono"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onBlur={() => model.trim() && set('geminiModel', model.trim())}
            aria-label="Gemini model"
            data-tip="Gemini text-to-speech model name. Saved when you leave the field"
            style={{ width: 230 }}
          />
        </Row>
        <Row label="Reading style" hint="Optional. Describe the delivery, for example “calm and clear, like a narrator”.">
          <input
            className="field"
            value={style}
            placeholder="Natural"
            onChange={(e) => setStyle(e.target.value)}
            onBlur={() => set('geminiStyle', style)}
            aria-label="Reading style"
            data-tip="Tells Gemini how to sound. Saved when you leave the field"
            style={{ width: 260 }}
          />
        </Row>
      </Group>

      <div className="subhead">
        <h3>Gemini voices</h3>
        <span className="badge muted">{GEMINI_VOICES.length} voices</span>
      </div>
      <div className="voice-list" role="radiogroup" aria-label="Gemini voice">
        {GEMINI_VOICES.map((v) => {
          const active = s.geminiVoice === v.name;
          return (
            <VoiceCard key={v.name} active={active} onSelect={() => set('geminiVoice', v.name)}>
              <span className="voice-name">
                <span>{v.name}</span>
                {active && (
                  <span className="badge active">
                    <I.check /> Active
                  </span>
                )}
              </span>
              <span className="voice-meta">
                <span>{v.tone}</span>
                <span>
                  <I.cloud /> Gemini
                </span>
              </span>
              <PreviewButton playing={previewing === v.name} busy={loading === v.name} onClick={() => void preview(v.name)} />
            </VoiceCard>
          );
        })}
      </div>
    </>
  );
}
