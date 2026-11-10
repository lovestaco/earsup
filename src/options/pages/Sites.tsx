import { useState } from 'react';
import { cleanRule, ruleSampleUrl, type Settings } from '../../shared/settings';
import { I } from '../icons';
import { Group, Row, Segmented } from '../ui/controls';

type Set = <K extends keyof Settings>(k: K, v: Settings[K]) => void;

export function Sites({ s, set }: { s: Settings; set: Set }) {
  const only = s.siteMode === 'only';
  const listKey = only ? 'allowedSites' : 'blockedSites';
  const list = s[listKey];
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    const host = cleanRule(draft);
    if (!host) {
      setError('Enter a site like docs.google.com, or a link pattern like https://claude.ai/chat/*.');
      return;
    }
    if (list.includes(host)) {
      setError(`${host} is already on the list.`);
      return;
    }
    set(listKey, [...list, host]);
    setDraft('');
    setError('');
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Sites</h1>
          <p>Choose where play buttons appear. A domain like example.com covers its subdomains too. A link with <code>*</code>, like https://claude.ai/chat/*, matches only those pages.</p>
        </div>
      </div>

      <Group title="Where EarsUp runs">
        <Row label="Mode" hint={only ? 'Play buttons appear only on the sites below.' : 'Play buttons appear everywhere except the sites below.'}>
          <Segmented
            label="Site mode"
            value={s.siteMode}
            onChange={(v) => set('siteMode', v)}
            options={[
              { value: 'everywhere', label: 'Everywhere except', tip: 'Show play buttons on every site except the list' },
              { value: 'only', label: 'Only on', tip: 'Show play buttons only on the sites in the list' },
            ]}
          />
        </Row>
        <Row label={only ? 'Add an allowed site' : 'Add a blocked site'} stack>
          <form
            className="site-add"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              className="field"
              placeholder="claude.ai or https://docs.google.com/…"
              value={draft}
              onChange={(e) => (setDraft(e.target.value), setError(''))}
              aria-label="Site to add"
              data-tip="A domain, or a link with * as a wildcard"
              aria-invalid={!!error}
            />
            <button className="btn primary" type="submit" disabled={!draft.trim()} data-tip={only ? 'Allow play buttons on this site' : 'Hide play buttons on this site'}>
              <I.plus /> Add
            </button>
          </form>
          {error && (
            <div className="note err" role="alert">
              <I.warn /> {error}
            </div>
          )}
        </Row>
      </Group>

      <section className="group">
        <h2>{only ? 'Allowed sites' : 'Blocked sites'}</h2>
        <div className="card">
          {list.length ? (
            <ul className="site-list">
              {list.map((h) => (
                <li key={h}>
                  <Favicon rule={h} />
                  <span className="host">{h}</span>
                  <button className="icon-btn danger" aria-label={`Remove ${h}`} data-tip={`Remove ${h} from the list`} onClick={() => set(listKey, list.filter((x) => x !== h))}>
                    <I.trash />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              <img src="img/bunny-logo.png" alt="" />
              <strong>{only ? 'No sites yet, so EarsUp is quiet everywhere' : 'Nothing blocked'}</strong>
              <span>
                {only
                  ? 'Add the sites where you want play buttons, such as claude.ai.'
                  : 'Add a site here if the buttons get in the way on it.'}
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Favicon({ rule }: { rule: string }) {
  const [failed, setFailed] = useState(false);
  // Chrome's own favicon cache (the "favicon" permission): no network request.
  const src = `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(ruleSampleUrl(rule))}&size=32`;
  return failed ? (
    <span className="fav fallback">
      <I.globe />
    </span>
  ) : (
    <img className="fav" src={src} alt="" width={16} height={16} onError={() => setFailed(true)} />
  );
}
