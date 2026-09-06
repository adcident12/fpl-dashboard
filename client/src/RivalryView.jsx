import { useEffect, useState } from 'react';
import { fetchSquad } from './api.js';
import { useTeamId } from './useTeamId.js';
import { TeamIdInput } from './TeamIdControls.jsx';
import PitchView from './PitchView.jsx';
import LoadingState from './LoadingSpinner.jsx';
import { useLang } from './i18n.jsx';

// The rival slot gets its own localStorage key so it doesn't clobber the
// shared 'fpl-team-id' every other tab reads/writes — "your team" (the
// default key) still prefills from whatever's already saved there.
const RIVAL_STORAGE_KEY = 'fpl-rival-team-id';

// Bragging-rights text generated from the plain points difference this
// gameweek — no server involvement, just a friendly read of two already-
// fetched /api/squad responses.
function banterKey(margin) {
  if (margin === 0) return 'rivalry.tie';
  if (margin >= 20) return 'rivalry.blowout';
  if (margin >= 8) return 'rivalry.win';
  return 'rivalry.close';
}

function computeWinnerLabel(dataA, dataB, t) {
  if (dataA.teamPoints === dataB.teamPoints) return null;
  return dataA.teamPoints > dataB.teamPoints ? t('rivalry.yourTeam') : t('rivalry.rivalTeam');
}

function Side({ label, teamId, setTeamId, data, error, loading, onLoad, t }) {
  return (
    <div className="flex-1 min-w-[280px]">
      <h3 className="font-display text-sm font-bold tracking-[0.02em] uppercase text-muted mb-1.5">{label}</h3>
      <TeamIdInput value={teamId} onChangeValue={setTeamId} onLoad={onLoad} loading={loading} />
      {error && <div className="text-[#ff8a80] text-sm mb-3">{error}</div>}
      {loading && !data && <LoadingState label={t('status.loading')} />}
      {data && (
        <>
          <div className="bg-panel border border-line rounded-md px-3.5 py-3 mb-3.5 shadow-sm text-[13px] text-muted">
            <b className="text-text text-xl font-display">{data.teamPoints ?? '—'}</b> {t('rivalry.pts')}
            {data.value != null && <> · {t('squad.value', { value: data.value.toFixed(1) })}</>}
            {data.rank != null && <> · {t('squad.rank', { rank: data.rank })}</>}
          </div>
          <PitchView squad={data.squad} />
        </>
      )}
    </div>
  );
}

export default function RivalryView() {
  const { t } = useLang();
  const [teamIdA, setTeamIdA] = useTeamId();
  const [teamIdB, setTeamIdB] = useTeamId(RIVAL_STORAGE_KEY);
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [errorA, setErrorA] = useState(null);
  const [errorB, setErrorB] = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  async function loadA(id) {
    const tid = String(id).trim();
    if (!tid) return;
    setTeamIdA(tid);
    setLoadingA(true);
    setErrorA(null);
    try {
      setDataA(await fetchSquad(tid));
    } catch (e) {
      setDataA(null);
      setErrorA(e.message);
    } finally {
      setLoadingA(false);
    }
  }

  async function loadB(id) {
    const tid = String(id).trim();
    if (!tid) return;
    setTeamIdB(tid);
    setLoadingB(true);
    setErrorB(null);
    try {
      setDataB(await fetchSquad(tid));
    } catch (e) {
      setDataB(null);
      setErrorB(e.message);
    } finally {
      setLoadingB(false);
    }
  }

  useEffect(() => {
    if (teamIdA) loadA(teamIdA);
    if (teamIdB) loadB(teamIdB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bothLoaded = dataA?.teamPoints != null && dataB?.teamPoints != null;
  const margin = bothLoaded ? Math.abs(dataA.teamPoints - dataB.teamPoints) : null;
  const winnerLabel = bothLoaded ? computeWinnerLabel(dataA, dataB, t) : null;

  return (
    <div>
      <div className="bg-panel border border-line rounded-md p-4 mb-3.5 shadow-sm">
        <h2 className="m-0 mb-2 font-display text-xl font-bold tracking-[0.01em]">{t('rivalry.title')}</h2>
        <div className="text-[13px] text-muted">{t('rivalry.note')}</div>
      </div>

      {bothLoaded && (
        <div className="bg-panel border border-accent/40 rounded-md p-4 mb-3.5 shadow-sm text-center">
          <div className="font-display text-lg font-bold">
            {t(banterKey(margin), { winner: winnerLabel, margin, points: dataA.teamPoints })}
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-wrap max-sm:flex-col">
        <Side
          label={t('rivalry.yourTeam')}
          teamId={teamIdA}
          setTeamId={setTeamIdA}
          data={dataA}
          error={errorA}
          loading={loadingA}
          onLoad={loadA}
          t={t}
        />
        <Side
          label={t('rivalry.rivalTeam')}
          teamId={teamIdB}
          setTeamId={setTeamIdB}
          data={dataB}
          error={errorB}
          loading={loadingB}
          onLoad={loadB}
          t={t}
        />
      </div>
    </div>
  );
}
