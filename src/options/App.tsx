import { useCallback, useEffect, useRef, useState } from 'react';
import { I } from './icons';
import { useSettings } from './state';
import { General } from './pages/General';
import { Voices } from './pages/Voices';
import { Sites } from './pages/Sites';
import { History } from './pages/History';
import { About } from './pages/About';

const PAGES = [
  { id: 'general', label: 'General', icon: <I.general />, tip: 'Play buttons, highlight, theme and shortcuts' },
  { id: 'voices', label: 'Voices', icon: <I.voice />, tip: 'Pick the reading voice, speed and engine' },
  { id: 'sites', label: 'Sites', icon: <I.sites />, tip: 'Choose which sites show play buttons' },
  { id: 'history', label: 'History', icon: <I.history />, tip: 'Sections you have listened to' },
  { id: 'about', label: 'About', icon: <I.about />, tip: 'How EarsUp works, privacy and reset' },
] as const;
type PageId = (typeof PAGES)[number]['id'];

function fromHash(): { page: PageId; welcome: boolean } {
  const h = location.hash.slice(1);
  if (h === 'welcome') return { page: 'general', welcome: true };
  return { page: (PAGES.find((p) => p.id === h)?.id ?? 'general') as PageId, welcome: false };
}

export function App() {
  const { s, set, ready } = useSettings();
  const [{ page, welcome }, setRoute] = useState(fromHash);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    const on = () => setRoute(fromHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  // Theme: System follows the OS live.
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = s.theme === 'dark' || (s.theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [s.theme]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const go = (id: PageId) => {
    history.replaceState(null, '', '#' + id);
    setRoute({ page: id, welcome: false });
    window.scrollTo({ top: 0 });
  };

  const current = PAGES.find((p) => p.id === page)!;
  useEffect(() => {
    document.title = `${current.label} · EarsUp`;
  }, [current]);

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" data-tip="Ears up! Back to General" href="#general" onClick={(e) => (e.preventDefault(), go('general'))} aria-label="EarsUp home">
          <img src="img/bunny-logo.png" alt="" />
          <span className="wordmark">
            Ears<b>Up</b>
          </span>
        </a>
        <nav className="nav" aria-label="Settings sections">
          {PAGES.map((p) => (
            <button key={p.id} data-tip={p.tip} aria-label={p.label} aria-current={page === p.id ? 'page' : undefined} onClick={() => go(p.id)}>
              {p.icon}
              <span>{p.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <span className={'dot' + (s.enabled ? '' : ' off')} />
          {s.enabled ? 'Listening for headings' : 'Paused everywhere'}
        </div>
      </aside>
      <main className="main">
        {ready &&
          (page === 'general' ? (
            <General s={s} set={set} welcome={welcome} go={go} />
          ) : page === 'voices' ? (
            <Voices s={s} set={set} notify={notify} />
          ) : page === 'sites' ? (
            <Sites s={s} set={set} />
          ) : page === 'history' ? (
            <History s={s} set={set} notify={notify} />
          ) : (
            <About s={s} set={set} notify={notify} />
          ))}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
