import { useEffect, useState } from 'react';
import { fetchChipPlan } from './api.js';
import { useTeamId } from './useTeamId.js';
import { TeamIdInput, TeamIdEmptyState, SAMPLE_TEAM_ID } from './TeamIdControls.jsx';
import LoadingState from './LoadingSpinner.jsx';
import { useLang } from './i18n.jsx';

const STATUS_KEY = {
  used: 'chips.statusUsed',
  available: 'chips.statusAvailable',
  expiringSoon: 'chips.statusExpiringSoon',
  upcoming: 'chips.statusUpcoming',
  expired: 'chips.statusExpired',
};

function statusText(w, t) {
  const key = STATUS_KEY[w.status];
  if (w.status === 'used') return t(key, { event: w.used.event });
  if (w.status === 'expiringSoon') return t(key, { n: w.eventsRemaining });
  if (w.status === 'upcoming') return t(key, { event: w.startEvent });
  return t(key);
}

function ChipWindowCard({ w, t }) {
  return (
    <div className={`chip-card chip-status-${w.status}`}>
      <div className="chip-card-name">{t(`chip.${w.name}`)}</div>
      <div className="chip-card-window">{t('chips.window', { start: w.startEvent, stop: w.stopEvent })}</div>
      <div className="chip-card-status">{statusText(w, t)}</div>
    </div>
  );
}

function RecommendationRow({ rec, t }) {
  return (
    <div className="chip-rec-row">
      <span className="chip-rec-label">{t(`chip.${rec.chip}`)}</span>
      <span className="chip-rec-text">
        {t(`chips.reason.${rec.reason}`, {
          ...rec.detail,
          teams: Array.isArray(rec.detail.teams) ? rec.detail.teams.join(', ') : undefined,
        })}
      </span>
    </div>
  );
}

export default function ChipsView() {
  const { t } = useLang();
  const [teamId, setTeamId] = useTeamId();
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadPlan(id) {
    const tid = String(id).trim();
    if (!tid) return;
    setTeamId(tid);
    setLoading(true);
    setError(null);
    try {
      setPlan(await fetchChipPlan(tid));
    } catch (e) {
      setPlan(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (teamId) loadPlan(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const half1 = plan?.windows.filter((w) => w.startEvent < 20) ?? [];
  const half2 = plan?.windows.filter((w) => w.startEvent >= 20) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <TeamIdInput value={teamId} onChangeValue={setTeamId} onLoad={loadPlan} loading={loading} />

      {error && (
        <div className="py-10 text-center text-[#ff8a80]">
          {error}
          <div className="text-muted mt-2">{t('teamId.errorHelp', { teamId: teamId || '…' })}</div>
        </div>
      )}

      {loading && !plan && <LoadingState label={t('chips.loading')} />}

      {!error && plan && (
        <section className="bg-panel border border-line rounded-md p-4">
          <h2 className="m-0 mb-2 font-display text-xl font-bold tracking-[0.01em]">{t('chips.title')}</h2>
          <div className="text-[13px] text-muted mb-3.5">{t('chips.note')}</div>

          <div className="chip-halves">
            <div className="chip-half">
              <div className="chip-half-label">{t('chips.half1')}</div>
              <div className="chip-half-cards">
                {half1.map((w) => (
                  <ChipWindowCard key={w.name + w.startEvent} w={w} t={t} />
                ))}
              </div>
            </div>
            <div className="chip-half">
              <div className="chip-half-label">{t('chips.half2')}</div>
              <div className="chip-half-cards">
                {half2.map((w) => (
                  <ChipWindowCard key={w.name + w.startEvent} w={w} t={t} />
                ))}
              </div>
            </div>
          </div>

          <h3 className="font-display text-base font-bold tracking-[0.01em] mt-5 mb-2.5">
            {t('chips.recommendationsTitle')}
          </h3>
          {plan.recommendations.length === 0 ? (
            <div className="text-muted text-[13px]">{t('chips.noRecommendations')}</div>
          ) : (
            <div className="flex flex-col gap-2">
              {plan.recommendations.map((rec) => (
                <RecommendationRow key={rec.chip} rec={rec} t={t} />
              ))}
            </div>
          )}
        </section>
      )}

      {!error && !plan && !loading && <TeamIdEmptyState onTrySample={() => loadPlan(SAMPLE_TEAM_ID)} />}
    </div>
  );
}
