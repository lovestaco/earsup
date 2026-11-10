import { DEFAULTS, GEMINI_KEY, HISTORY_KEY, saveSettings, type Settings } from '../../shared/settings';
import { I } from '../icons';
import type { Toast } from '../state';
import { Group, Row } from '../ui/controls';

type Set = <K extends keyof Settings>(k: K, v: Settings[K]) => void;

export function About({ s, notify }: { s: Settings; set: Set; notify: Toast }) {
  const version = chrome.runtime.getManifest().version;

  const reset = async () => {
    await saveSettings(DEFAULTS);
    notify('Settings reset');
  };
  const wipe = async () => {
    await chrome.storage.local.remove([GEMINI_KEY, HISTORY_KEY]);
    notify('Key and history removed');
  };

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-copy">
          <h1>Hear any doc, heading by heading.</h1>
          <p>EarsUp adds a play button to the headings on every page and reads that section to you.</p>
        </div>
        <img src="img/bunny-3d.png" alt="EarsUp bunny holding a sign that says: Use EarsUp to hear your docs accurately." />
      </div>

      <section className="group">
        <h2>How it works</h2>
        <ol className="card steps">
          <li>
            <div>
              <strong>
                Press <span className="demo-play"><I.play /></span> next to a heading
              </strong>
              <span>EarsUp reads the heading and everything under it, up to the next heading of the same or a higher level.</span>
            </div>
          </li>
          <li>
            <div>
              <strong>
                The button turns into <span className="demo-play stop"><I.stop /></span>
              </strong>
              <span>Press it again, or press Esc, to stop. Starting another heading stops the current one.</span>
            </div>
          </li>
          <li>
            <div>
              <strong>Use the floating player</strong>
              <span>Pause, skip back or forward, and change the speed without leaving the page.</span>
            </div>
          </li>
        </ol>
      </section>

      <Group title="Privacy">
        <Row label="Chrome voices" hint="Speech is made by Chrome on this computer. EarsUp sends nothing anywhere.">
          <span className="badge muted">Local</span>
        </Row>
        <Row label="Gemini voices" hint="Only when you choose Gemini: the section's text goes to Google's Gemini API with your key.">
          <span className={'badge ' + (s.engine === 'gemini' ? 'gold' : 'muted')}>{s.engine === 'gemini' ? 'In use' : 'Not in use'}</span>
        </Row>
        <Row label="What EarsUp stores" hint="Your settings (synced by Chrome), plus your Gemini key and listening history in this browser only.">
          <button className="btn danger" data-tip="Deletes your Gemini key and listening history from this browser" onClick={() => void wipe()}>
            <I.trash /> Remove key and history
          </button>
        </Row>
      </Group>

      <Group title="About">
        <Row label="Version">
          <span className="mono">v{version}</span>
        </Row>
        <Row label="Reset settings" hint="Puts every setting back to its default. Keeps your key and history.">
          <button className="btn" data-tip="Every setting goes back to its default" onClick={() => void reset()}>
            <I.refresh /> Reset
          </button>
        </Row>
      </Group>
    </div>
  );
}
