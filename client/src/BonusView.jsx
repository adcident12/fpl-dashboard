import { useEffect, useState } from 'react';
import { fetchBonusPredictor } from './api.js';
import LoadingState from './LoadingSpinner.jsx';
import Tooltip from './Tooltip.jsx';
import { useLang } from './i18n.jsx';

// Matches the server's own live-data cache TTL (LIVE_BONUS_TTL_MS in
// server/fpl.js) — polling faster than that would just re-read the same
// cached response, and polling much slower would show stale BPS during play.
const REFRESH_MS = 60 * 1000;

function BonusBadge({ value, finished, t }) {
  if (value === 0) return <span className="text-muted">—</span>;
  return (
    <Tooltip content={finished ? t('bonus.confirmedTitle') : t('bonus.predictedTitle')}>
      <span className={`badge bonus-${value}`}>{value}</span>
    </Tooltip>
  );
}

function FixtureCard({ fixture, t }) {
  return (
    <div className="bonus-fixture-card">
      <div className="bonus-fixture-header">
        <span className="bonus-fixture-teams">
          {fixture.homeTeamShort} {fixture.homeScore ?? 0}–{fixture.awayScore ?? 0} {fixture.awayTeamShort}
        </span>
        <span className={`bonus-live-tag ${fixture.finished ? 'final' : 'live'}`}>
          {fixture.finished ? t('bonus.finalTag') : t('bonus.liveTag')}
        </span>
      </div>
      <table className="bonus-player-table">
        <thead>
          <tr>
            <th></th>
            <th className="num">{t('bonus.bpsCol')}</th>
            <th className="num">{t('bonus.bonusCol')}</th>
          </tr>
        </thead>
        <tbody>
          {fixture.players.slice(0, 8).map((p) => (
            <tr key={p.id}>
              <td>
                <span className={`pos pos-${p.positionId}`}>{p.position}</span> {p.name}
                <span className="muted"> ({p.teamShort})</span>
              </td>
              <td className="num">{p.bps}</td>
              <td className="num">
                <BonusBadge value={fixture.finished ? p.confirmedBonus : p.predictedBonus} finished={fixture.finished} t={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BonusView() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    function load() {
      fetchBonusPredictor()
        .then((d) => alive && setData(d))
        .catch((e) => alive && setError(e.message));
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (error) return <div className="py-10 text-center text-[#ff8a80]">{t('status.error', { message: error })}</div>;
  if (!data) return <LoadingState label={t('bonus.loading')} />;

  const started = data.fixtures.filter((f) => f.players.length > 0);

  return (
    <section className="bg-panel border border-line rounded-md p-4 shadow-sm">
      <h2 className="m-0 mb-2 font-display text-xl font-bold tracking-[0.01em]">{t('bonus.title')}</h2>
      <div className="text-[13px] text-muted mb-1">{t('bonus.note')}</div>
      <div className="text-xs text-muted mb-3.5">{t('bonus.refreshNote')}</div>

      {started.length === 0 ? (
        <div className="py-10 text-center text-muted">{t('bonus.empty')}</div>
      ) : (
        <div className="bonus-fixture-grid">
          {started.map((f) => (
            <FixtureCard key={f.fixtureId} fixture={f} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}
