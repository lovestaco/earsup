import { useEffect, useState } from 'react';
import type { HeadingLevel, Settings } from '../../shared/settings';
import { I } from '../icons';
import { Group, Row, Segmented, Select, Toggle } from '../ui/controls';

type Set = <K extends keyof Settings>(k: K, v: Settings[K]) => void;

export function General({
  s,
  set,
  welcome,
  go,
}: {
  s: Settings;
  set: Set;
  welcome: boolean;
  go: (id: 'voices' | 'about') => void;
}) {
  const [shortcuts, setShortcuts] = useState<chrome.commands.Command[]>([]);
  useEffect(() => {
    void chrome.commands.getAll().then(setShortcuts);
  }, []);
  const key = (name: string) => shortcuts.find((c) => c.name === name)?.shortcut || 'Not set';

  const toggleLevel = (l: HeadingLevel) => {
    const next = s.levels.includes(l) ? s.levels.filter((x) => x !== l) : [...s.levels, l].sort();
    if (next.length) set('levels', next);
  };

  return (
    <div className="page">
      {welcome && (
        <div className="hero">
          <div className="hero-copy">
            <h1>Ears up! You're all set.</h1>
            <p>
              Open any page and look for the round <span className="demo-play"><I.play /></span> beside its headings. Press it
              and EarsUp reads that section aloud. Press <span className="demo-play stop"><I.stop /></span> to stop.
            </p>
            <button className="btn" data-tip="Choose who reads to you" onClick={() => go('voices')}>
              <I.voice /> Pick a voice
            </button>
          </div>
          <img src="img/bunny-3d.png" alt="EarsUp bunny holding a sign that says: Welcome to your story. Listen carefully." />
        </div>
      )}
      {!welcome && (
        <div className="page-head">
          <div>
            <h1>General</h1>
            <p>Where the play buttons appear and how reading looks on the page.</p>
          </div>
        </div>
      )}

      <Group title="Reading">
        <Row label="EarsUp on" hint="Turn off to hide every play button on every site.">
          <Toggle label="EarsUp on" checked={s.enabled} onChange={(v) => set('enabled', v)} />
        </Row>
        <Row label="Headings" hint="Which heading levels get a play button. At least one stays on.">
          <div className="chips" role="group" aria-label="Heading levels">
            {([1, 2, 3, 4] as HeadingLevel[]).map((l) => (
              <button
                key={l}
                className="chip"
                aria-pressed={s.levels.includes(l)}
                data-tip={
                  s.levels.includes(l)
                    ? s.levels.length === 1
                      ? `H${l} is the last level on, so it stays on`
                      : `Hide play buttons on H${l} headings`
                    : `Show play buttons on H${l} headings`
                }
                onClick={() => toggleLevel(l)}
              >
                H{l}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Button position" hint="Falls back to the other side when there is no room.">
          <Segmented
            label="Button position"
            value={s.buttonSide}
            onChange={(v) => set('buttonSide', v)}
            options={[
              { value: 'left', label: 'Left', tip: 'Put the play button before the heading' },
              { value: 'right', label: 'Right', tip: 'Put the play button after the heading' },
            ]}
          />
        </Row>
        <Row label="Show buttons" hint="Hover keeps pages clean until you point at a heading.">
          <Select
            label="Show buttons"
            tip="Always visible, or only when you point at a heading"
            value={s.buttonVisibility}
            onChange={(v) => set('buttonVisibility', v)}
            options={[
              { value: 'always', label: 'Always' },
              { value: 'hover', label: 'On hover' },
            ]}
          />
        </Row>
        <Row label="Highlight section" hint="Outline the part being read so you can follow along.">
          <Toggle label="Highlight section" checked={s.highlight} onChange={(v) => set('highlight', v)} />
        </Row>
        <Row label="Follow along" hint="Lights up the word being spoken. Exact with Windows voices; estimated for online and Gemini voices.">
          <Select
            label="Follow along"
            tip="What lights up on the page as EarsUp reads"
            value={s.followAlong}
            onChange={(v) => set('followAlong', v)}
            options={[
              { value: 'sentence', label: 'Word and sentence' },
              { value: 'word', label: 'Word only' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Row>
        {s.followAlong !== 'off' && (
          <Row label="Highlight colour" hint="On dark pages the word turns this colour; on light pages it gets a marker.">
            <div className="swatches" role="radiogroup" aria-label="Highlight colour">
              {(
                [
                  ['yellow', '#ffd84d'],
                  ['green', '#7ee787'],
                  ['pink', '#ff8fc8'],
                  ['cyan', '#6fe3ff'],
                ] as const
              ).map(([name, hex]) => (
                <button
                  key={name}
                  role="radio"
                  aria-checked={s.followColor === name}
                  aria-label={name}
                  data-tip={s.followColor === name ? `${name[0].toUpperCase() + name.slice(1)} (selected)` : `Use ${name}`}
                  className="swatch"
                  style={{ ['--sw' as string]: hex }}
                  onClick={() => set('followColor', name)}
                >
                  <span>Aa</span>
                </button>
              ))}
            </div>
          </Row>
        )}
        <Row label="Floating player" hint="Pause, skip and change speed from a small bar at the bottom of the page.">
          <Toggle label="Floating player" checked={s.miniPlayer} onChange={(v) => set('miniPlayer', v)} />
        </Row>
      </Group>

      <Group title="Appearance">
        <Row label="Theme" hint="System follows your Windows light or dark setting.">
          <Segmented
            label="Theme"
            value={s.theme}
            onChange={(v) => set('theme', v)}
            options={[
              { value: 'system', label: 'System', icon: <I.monitor />, tip: 'Match your Windows light or dark setting' },
              { value: 'light', label: 'Light', icon: <I.sun />, tip: 'Always light' },
              { value: 'dark', label: 'Dark', icon: <I.moon />, tip: 'Always dark' },
            ]}
          />
        </Row>
      </Group>

      <Group title="Shortcuts">
        <Row label="Stop key" hint="Press it on the page to stop reading. Pick Off or Shift + Esc if Esc keeps stopping it by mistake.">
          <Select
            label="Stop key"
            tip="The key that stops reading on the page"
            value={s.stopKey}
            onChange={(v) => set('stopKey', v)}
            options={[
              { value: 'Escape', label: 'Esc' },
              { value: 'Shift+Escape', label: 'Shift + Esc' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Row>
        <Row label="Stop from anywhere" hint="A Chrome shortcut. Works even when the page doesn't have focus.">
          <kbd data-tip="Stops reading on the current tab">{key('stop-reading')}</kbd>
        </Row>
        <Row label="Pause key" hint="Space pauses and resumes while EarsUp is reading. It never fires while you type.">
          <Select
            label="Pause key"
            tip="The key that pauses and resumes reading on the page"
            value={s.pauseKey}
            onChange={(v) => set('pauseKey', v)}
            options={[
              { value: 'Space', label: 'Space' },
              { value: 'off', label: 'Off' },
            ]}
          />
        </Row>
        <Row label="Pause from anywhere" hint="A Chrome shortcut. Works even when the page doesn't have focus.">
          <kbd data-tip="Pauses or resumes reading on the current tab">{key('toggle-pause')}</kbd>
        </Row>
        <Row label="Change shortcuts" hint="Chrome manages extension shortcuts on its own page.">
          <button
            className="btn"
            data-tip="Opens Chrome's shortcut settings in a new tab"
            onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
          >
            <I.keyboard /> Open Chrome shortcuts
          </button>
        </Row>
      </Group>
    </div>
  );
}
