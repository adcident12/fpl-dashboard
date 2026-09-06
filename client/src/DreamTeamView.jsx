import { useEffect, useState } from 'react';
import { fetchDreamTeam } from './api.js';
import PitchView, { teamColor } from './PitchView.jsx';
import LoadingState from './LoadingSpinner.jsx';
import { useLang } from './i18n.jsx';

export default function DreamTeamView() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchDreamTeam()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="py-10 text-center text-[#ff8a80]">{t('status.error', { message: error })}</div>;
  if (!data) return <LoadingState label={t('dreamTeam.loading')} />;

  const ranked = [...data.dreamTeam].sort((a, b) => b.points - a.points);
  const topScorer = ranked[0];

  return (
    <div>
      <div className="bg-panel border border-line rounded-md p-4 mb-3.5 shadow-sm">
        <h2 className="m-0 mb-2 font-display text-xl font-bold tracking-[0.01em]">
          {t('dreamTeam.title', { event: data.eventId })}
        </h2>
        <div className="text-[13px] text-muted mb-2">{t('dreamTeam.note')}</div>
        <div className="text-sm">
          <b className="text-accent text-lg font-display">{data.totalPoints}</b> {t('dreamTeam.totalPoints')}
        </div>
      </div>

      {topScorer && (
        <div className="flex items-center gap-3 bg-panel border border-accent/40 rounded-md p-3 mb-3.5 shadow-sm">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-white text-xs shrink-0"
            style={{ background: teamColor(topScorer.teamShort) }}
          >
            {topScorer.teamShort}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-accent uppercase tracking-[0.04em] font-semibold">{t('dreamTeam.starOfWeek')}</div>
            <div className="font-display font-bold truncate">{topScorer.name}</div>
          </div>
          <div className="font-display text-2xl font-bold text-accent shrink-0">{topScorer.points}</div>
        </div>
      )}

      <PitchView squad={data.dreamTeam} />

      <div className="bg-panel border border-line rounded-md p-3.5 mt-3.5 shadow-sm">
        <h3 className="m-0 mb-2 font-display text-base font-bold tracking-[0.01em]">{t('dreamTeam.rankingTitle')}</h3>
        <ol className="list-none p-0 m-0 flex flex-col gap-1">
          {ranked.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-2 text-sm rounded-sm px-2 py-1.5 ${i === 0 ? 'bg-accent/10 border border-accent/30' : ''}`}
            >
              <span className="text-muted w-5 text-right shrink-0">{i + 1}</span>
              <span className={`pos pos-${p.positionId}`}>{p.position}</span>
              <span className="flex-1">
                {p.name} <span className="muted">({p.teamShort})</span>
              </span>
              <span className="font-display font-bold text-accent">{p.points}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
