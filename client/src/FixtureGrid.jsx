import { useEffect, useState } from 'react';
import { fetchFixtureGrid } from './api.js';
import LoadingState from './LoadingSpinner.jsx';
import { useLang } from './i18n.jsx';

// FDR is a 1-5 scale (1=easiest, 5=hardest). One color per level so the
// grid is scannable at a glance.
const FDR_BG = { 1: '#1b5e20', 2: '#558b2f', 3: '#f9a825', 4: '#ef6c00', 5: '#b71c1c' };
const FDR_LABEL_KEY = { 1: 'fixtures.fdr1', 2: 'fixtures.fdr2', 3: 'fixtures.fdr3', 4: 'fixtures.fdr4', 5: 'fixtures.fdr5' };

// A cell now holds an ARRAY of fixtures (0 = blank gameweek, 1 = normal,
// 2+ = double gameweek) — see buildFixtureGrid() in server/fpl.js.
function FixtureRow({ f, t }) {
  const bg = FDR_BG[f.difficulty] ?? '#37474f';
  const dark = f.difficulty >= 4;
  const side = f.home ? t('fixtures.home') : t('fixtures.away');
  const title = `vs ${f.opponentName} (${side}) — FDR ${f.difficulty}/5`;
  return (
    <div
      className={`cell fdr-${f.difficulty}${f.done ? ' done' : ''}`}
      style={{ background: bg, color: dark ? '#fff' : '#111' }}
      title={title}
    >
      <span className="cell-opp">
        {f.home ? 'v' : '@'} {f.opponentShort}
      </span>
      {f.done && (
        <span className="cell-score">
          {f.scoreFor}–{f.scoreAgainst}
        </span>
      )}
    </div>
  );
}

function Cell({ fixtures, t }) {
  if (fixtures.length === 0) {
    return (
      <div className="cell empty blank-cell" title={t('fixtures.blank')}>
        {t('fixtures.blank')}
      </div>
    );
  }
  if (fixtures.length === 1) {
    return <FixtureRow f={fixtures[0]} t={t} />;
  }
  return (
    <div className="cell-dgw">
      <span className="dgw-tag">{t('fixtures.dgwTag')}</span>
      {fixtures.map((f) => (
        <FixtureRow key={f.opponentId} f={f} t={t} />
      ))}
    </div>
  );
}

function groupByEvent(items, gameweeks) {
  const byEvent = new Map();
  for (const item of items) {
    if (!byEvent.has(item.event)) byEvent.set(item.event, []);
    byEvent.get(item.event).push(item.teamShort);
  }
  return [...byEvent.entries()].map(([event, teams]) => ({
    event,
    gwName: gameweeks.find((gw) => gw.id === event)?.name.replace('Gameweek ', 'GW') ?? `GW${event}`,
    teams,
  }));
}

function DgwBgwBanner({ data, t }) {
  if (data.doubles.length === 0 && data.blanks.length === 0) return null;
  const doubleGroups = groupByEvent(data.doubles, data.gameweeks);
  const blankGroups = groupByEvent(data.blanks, data.gameweeks);
  return (
    <div className="dgw-bgw-banner">
      {doubleGroups.map((g) => (
        <div key={`d-${g.event}`} className="banner-row banner-double">
          {t('fixtures.doublesBanner', { teams: g.teams.join(', '), gw: g.gwName })}
        </div>
      ))}
      {blankGroups.map((g) => (
        <div key={`b-${g.event}`} className="banner-row banner-blank">
          {t('fixtures.blanksBanner', { teams: g.teams.join(', '), gw: g.gwName })}
        </div>
      ))}
    </div>
  );
}

export default function FixtureGrid() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchFixtureGrid()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="py-10 text-center text-[#ff8a80]">{t('status.error', { message: error })}</div>;
  if (!data) return <LoadingState label={t('fixtures.loading')} />;

  return (
    <div>
      <DgwBgwBanner data={data} t={t} />

      <div className="table-wrap">
        <table className="fixture-grid">
          <thead>
            <tr>
              <th className="team-col">{t('fixtures.teamCol')}</th>
              {data.gameweeks.map((gw) => (
                <th key={gw.id} className={gw.id === data.currentEventId ? 'current-gw' : ''}>
                  {gw.name.replace('Gameweek ', 'GW')}
                  {gw.id === data.currentEventId && <span className="gw-tag">{t('fixtures.now')}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.teams.map((team) => (
              <tr key={team.id}>
                <td className="team-col">{team.name}</td>
                {team.fixtures.map((fixtures, i) => (
                  <td key={data.gameweeks[i].id} className="cell-td">
                    <Cell fixtures={fixtures} t={t} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="legend">
        {[1, 2, 3, 4, 5].map((d) => (
          <span key={d} className="fdr-badge" style={{ background: FDR_BG[d], color: d >= 4 ? '#fff' : '#111' }}>
            {t(FDR_LABEL_KEY[d])}
          </span>
        ))}
        <span className="muted">{t('fixtures.note')}</span>
      </footer>
    </div>
  );
}
