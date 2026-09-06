import { useEffect, useState } from 'react';
import { fetchPlayers } from './api.js';
import LoadingState from './LoadingSpinner.jsx';
import { useLang } from './i18n.jsx';

// Groups players by team and, within each team, into the 3 set-piece order
// lists — computed entirely client-side from the already-existing /players
// payload (penaltyOrder/freeKickOrder/cornerOrder), no new server endpoint.
function groupByTeam(players, teams) {
  const byTeam = new Map(teams.map((tm) => [tm.id, { team: tm, penalties: [], freeKicks: [], corners: [] }]));
  for (const p of players) {
    const entry = byTeam.get(p.teamId);
    if (!entry) continue;
    if (p.penaltyOrder != null) entry.penalties.push(p);
    if (p.freeKickOrder != null) entry.freeKicks.push(p);
    if (p.cornerOrder != null) entry.corners.push(p);
  }
  for (const entry of byTeam.values()) {
    entry.penalties.sort((a, b) => a.penaltyOrder - b.penaltyOrder);
    entry.freeKicks.sort((a, b) => a.freeKickOrder - b.freeKickOrder);
    entry.corners.sort((a, b) => a.cornerOrder - b.cornerOrder);
  }
  return [...byTeam.values()]
    .filter((e) => e.penalties.length || e.freeKicks.length || e.corners.length)
    .sort((a, b) => a.team.name.localeCompare(b.team.name));
}

function TakerList({ title, players, orderKey, t }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted uppercase tracking-[0.04em] font-semibold mb-1">{title}</div>
      {players.length === 0 ? (
        <div className="text-muted text-sm">{t('setpieces.none')}</div>
      ) : (
        <ol className="list-none p-0 m-0 flex flex-col gap-1">
          {players.map((p) => (
            <li key={p.id} className="text-sm flex gap-1.5 min-w-0">
              {/* First choice (order 1) picked out in accent — the one
                  detail a fan actually plans around, everyone else is just
                  "who's next in line" reference info. */}
              <span className={`w-3.5 text-right shrink-0 ${p[orderKey] === 1 ? 'text-accent font-bold' : 'text-muted'}`}>
                {p[orderKey]}
              </span>
              <span className={`flex-1 min-w-0 break-words leading-snug ${p[orderKey] === 1 ? 'font-semibold text-text' : 'text-muted'}`}>
                {p.name}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TeamCard({ entry, t }) {
  return (
    <div className="bg-panel border border-line rounded-md p-3.5 shadow-sm transition-shadow hover:shadow-md">
      <h3 className="font-display text-base font-bold mb-2.5">{entry.team.name}</h3>
      <div className="grid grid-cols-3 gap-2.5">
        <TakerList title={t('setpieces.penalties')} players={entry.penalties} orderKey="penaltyOrder" t={t} />
        <TakerList title={t('setpieces.freeKicks')} players={entry.freeKicks} orderKey="freeKickOrder" t={t} />
        <TakerList title={t('setpieces.corners')} players={entry.corners} orderKey="cornerOrder" t={t} />
      </div>
    </div>
  );
}

export default function SetPiecesView() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchPlayers()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="py-10 text-center text-[#ff8a80]">{t('status.error', { message: error })}</div>;
  if (!data) return <LoadingState label={t('setpieces.loading')} />;

  const teams = groupByTeam(data.players, data.teams);

  return (
    <div>
      <div className="bg-panel border border-line rounded-md p-4 mb-3.5 shadow-sm">
        <h2 className="m-0 mb-2 font-display text-xl font-bold tracking-[0.01em]">{t('setpieces.title')}</h2>
        <div className="text-[13px] text-muted">{t('setpieces.note')}</div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {teams.map((entry) => (
          <TeamCard key={entry.team.id} entry={entry} t={t} />
        ))}
      </div>
    </div>
  );
}
