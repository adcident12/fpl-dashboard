import { useEffect, useState } from 'react';
import { fetchSquad, fetchSquadScan } from './api.js';
import { useTeamId } from './useTeamId.js';
import { TeamIdInput, TeamIdEmptyState, SAMPLE_TEAM_ID } from './TeamIdControls.jsx';
import PitchView from './PitchView.jsx';
import FdrBadges from './FdrBadges.jsx';
import LoadingState from './LoadingSpinner.jsx';
import { useLang } from './i18n.jsx';

function PlayerRow({ p, t }) {
  return (
    <tr className={p.starting ? '' : 'bench'}>
      <td className="name">
        {p.isCaptain && <span className="badge cap" title={t('squad.captain')}>C</span>}
        {p.isViceCaptain && <span className="badge vice" title={t('squad.viceCaptain')}>VC</span>}
        {p.name}
        {p.status !== 'a' && <span className="news" title={p.news || p.status}> ⚑</span>}
      </td>
      <td data-label={t('table.team')}>{p.teamShort}</td>
      <td data-label={t('table.pos')}>
        <span className={`pos pos-${p.positionId}`}>{p.position}</span>
      </td>
      <td className="num" data-label={t('table.price')}>{p.price.toFixed(2)}</td>
      <td className="num" data-label={t('table.form')}>{p.form.toFixed(1)}</td>
      <td className="num" data-label={t('table.pts')}>{p.totalPoints}</td>
      <td className="num gw-pts" data-label={t('table.gwPts')}>{p.points}</td>
      <td data-label={t('table.next3fdr')}>
        <FdrBadges fixtures={p.nextFixtures} />
      </td>
    </tr>
  );
}

export default function SquadView() {
  const { t } = useLang();
  const [teamId, setTeamId] = useTeamId();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // Priority badges on the pitch view are a nice-to-have — a scan failure
  // shouldn't block the squad itself from showing, so its errors stay silent.
  const [scan, setScan] = useState(null);

  async function load(id) {
    const tid = String(id).trim();
    if (!tid) return;
    setTeamId(tid);
    setLoading(true);
    setError(null);
    setScan(null);
    try {
      setData(await fetchSquad(tid));
      fetchSquadScan(tid).then(setScan).catch(() => setScan(null));
    } catch (e) {
      setData(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (teamId) load(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const starting = data?.squad.filter((p) => p.starting) ?? [];
  const bench = data?.squad.filter((p) => !p.starting) ?? [];

  return (
    <div>
      <TeamIdInput value={teamId} onChangeValue={setTeamId} onLoad={load} loading={loading} />
      {data && (
        <div className="flex flex-wrap items-center gap-3 bg-panel border border-line rounded-md px-3.5 py-3 mb-3.5">
          <span className="text-muted text-[13px]">
            {t('meta.eventPlayers', { event: data.eventName, count: data.squad.length })}
            {data.teamPoints != null && <> · <b className="text-text">{data.teamPoints}</b> {t('squad.ptsThisGw')}</>}
            {data.value != null && <> · {t('squad.value', { value: data.value.toFixed(1) })}</>}
            {data.rank != null && <> · {t('squad.rank', { rank: data.rank })}</>}
          </span>
        </div>
      )}

      {error && (
        <div className="py-10 text-center text-[#ff8a80]">
          {error}
          <div className="text-muted mt-2">
            {t('teamId.errorHelp', { teamId: teamId || '…' })}
          </div>
        </div>
      )}

      {loading && !data && <LoadingState label={t('squad.loading')} />}

      {!error && data && <PitchView squad={data.squad} scan={scan?.rows} />}

      {!error && data && (
        <div className="overflow-auto border border-line rounded-md max-h-[72vh]">
          <table className="players squad">
            <thead>
              <tr>
                <th>{t('table.player')}</th>
                <th>{t('table.team')}</th>
                <th>{t('table.pos')}</th>
                <th>{t('table.price')}</th>
                <th>{t('table.form')}</th>
                <th>{t('table.pts')}</th>
                <th>{t('table.gwPts')}</th>
                <th>{t('table.next3fdr')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="group-head">
                <td colSpan={8}>{t('squad.startingXI')}</td>
              </tr>
              {starting.map((p) => (
                <PlayerRow key={p.id} p={p} t={t} />
              ))}
              <tr className="group-head">
                <td colSpan={8}>{t('squad.bench')}</td>
              </tr>
              {bench.map((p) => (
                <PlayerRow key={p.id} p={p} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && !data && !loading && <TeamIdEmptyState onTrySample={() => load(SAMPLE_TEAM_ID)} />}
    </div>
  );
}
