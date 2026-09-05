import { useEffect, useState } from 'react';
import { fetchSquad, fetchTransfers, fetchCaptain, fetchSquadScan } from './api.js';
import { useTeamId } from './useTeamId.js';
import { TeamIdInput, TeamIdEmptyState, SAMPLE_TEAM_ID } from './TeamIdControls.jsx';
import PitchView from './PitchView.jsx';
import FdrBadges from './FdrBadges.jsx';
import LoadingState, { Spinner } from './LoadingSpinner.jsx';
import { useLang } from './i18n.jsx';

function pct(w) {
  return `${Math.round(w * 100)}%`;
}

// comp.note / breakdown.fixture.note ('blank'/'double', fixture component
// only) means the raw average FDR was overridden — see server/fpl.js's
// scoreTransferComponents — shared by ComponentChip and breakdownTitle so
// both surface it instead of just showing the adjusted number silently.
const FIXTURE_NOTE_LABEL_KEY = { blank: 'sug.blankEventBadge', double: 'sug.dgwEventBadge' };

// One weighted component, shown as "raw → normalized (weight) = points".
function ComponentChip({ label, comp, t }) {
  const noteText = comp.note ? t(FIXTURE_NOTE_LABEL_KEY[comp.note]) : null;
  const noteSuffix = noteText ? ` (${noteText})` : '';
  const title = `${label}: ${comp.raw} → ${comp.normalized} × ${comp.weight} = ${comp.points}${noteSuffix}`;
  return (
    <span className="chip" title={title}>
      <span className="chip-label">{label} {pct(comp.weight)}</span>
      <span className="chip-vals">
        {comp.raw} → {comp.normalized}
        {noteText && <span className="chip-note"> ({noteText})</span>}
      </span>
      <span className="chip-pts">= {comp.points}</span>
    </span>
  );
}

// A Blank/Double Gameweek flag for the gameweek being planned for — the
// scoring already accounts for this (forced to 0 for a blank, +dgwBonus for
// a double, see server/fpl.js), this badge just makes that visible instead
// of a silent number shift.
function EventFlagBadge({ blankEvent, dgwEvent, t }) {
  if (blankEvent) {
    return (
      <span className="badge event-flag blank" title={t('sug.blankEventTitle')}>
        {t('sug.blankEventBadge')}
      </span>
    );
  }
  if (dgwEvent) {
    return (
      <span className="badge event-flag dgw" title={t('sug.dgwEventTitle')}>
        {t('sug.dgwEventBadge')}
      </span>
    );
  }
  return null;
}

// Chance-of-playing flag — only shown when there's an actual doubt (100%/null
// means fully fit, nothing to show). The score itself already applies the
// same percentage as a multiplier (see server/fpl.js's availabilityMultiplier),
// this badge just makes that visible instead of a silent number shift.
function AvailabilityBadge({ availabilityPct, t }) {
  if (availabilityPct == null || availabilityPct >= 100) return null;
  const severity = availabilityPct <= 50 ? 'severe' : 'minor';
  return (
    <span className={`badge event-flag availability-${severity}`} title={t('sug.availabilityTitle', { pct: availabilityPct })}>
      {t('sug.availabilityBadge', { pct: availabilityPct })}
    </span>
  );
}

// First-choice penalty taker — informational only, never weighted into the
// score (how many penalties a team wins is too unpredictable to model).
function PenaltyBadge({ penaltyOrder, t }) {
  if (penaltyOrder !== 1) return null;
  return (
    <span className="badge event-flag penalty" title={t('sug.penaltyTakerTitle')}>
      {t('sug.penaltyTakerBadge')}
    </span>
  );
}

// All per-player flag badges together, so call sites don't need to grow a
// new prop/component every time a badge is added.
function PlayerFlags({ p, t }) {
  return (
    <>
      <EventFlagBadge blankEvent={p.blankEvent} dgwEvent={p.dgwEvent} t={t} />
      <AvailabilityBadge availabilityPct={p.availabilityPct} t={t} />
      <PenaltyBadge penaltyOrder={p.penaltyOrder} t={t} />
    </>
  );
}

// The availability multiplier isn't a normalized/weighted component like
// form/fixture/value/underlying (no "raw → normalized × weight" shape), so
// it gets its own chip — shown only when it actually changed the score.
function AvailabilityChip({ availability, preScore, score, t }) {
  if (availability.multiplier >= 1) return null;
  return (
    <span className="chip chip-availability" title={t('sug.availabilityChipTitle', { pct: availability.pct })}>
      <span className="chip-label">{t('weights.availability')}</span>
      <span className="chip-vals">{preScore} → {score}</span>
      <span className="chip-pts">× {availability.multiplier}</span>
    </span>
  );
}

// A candidate row: main line + an always-visible breakdown line (never a black box).
function CandidateRow({ c, rank, highlight, t }) {
  return (
    <>
      <tr className={highlight ? 'top-pick' : ''}>
        <td className="num rank" data-label={t('sug.rankLabel')}>{rank}</td>
        <td className="name">
          {highlight && <span className="badge cap" title={t('sug.recommended')}>★</span>}
          {c.name}
          <PlayerFlags p={c} t={t} />
        </td>
        <td data-label={t('table.team')}>{c.teamShort}</td>
        <td data-label={t('table.pos')}>
          <span className={`pos pos-${c.positionId ?? posId(c.position)}`}>{c.position}</span>
        </td>
        <td className="num" data-label={t('table.price')}>{c.price.toFixed(2)}</td>
        <td data-label={t('table.nextFixtures')}>
          <FdrBadges fixtures={c.nextFixtures} />
        </td>
        <td className="num" data-label={t('table.score')}>{c.score.toFixed(1)}</td>
      </tr>
      <tr className="breakdown-row">
        <td colSpan={7}>
          <ComponentChip label={t('weights.form')} comp={c.breakdown.form} t={t} />
          <ComponentChip label={t('weights.fixtures')} comp={c.breakdown.fixture} t={t} />
          <ComponentChip label={t('weights.value')} comp={c.breakdown.value} t={t} />
          <ComponentChip label={t('weights.underlying')} comp={c.breakdown.underlying} t={t} />
          <AvailabilityChip availability={c.breakdown.availability} preScore={c.preAvailabilityScore} score={c.score} t={t} />
        </td>
      </tr>
    </>
  );
}

// Fallback position id from the short label (captain rows carry positionId, transfers do too).
function posId(pos) {
  return { GK: 1, DEF: 2, MID: 3, FWD: 4 }[pos] ?? 0;
}

function WeightsEcho({ weights, label }) {
  return (
    <span className="text-xs text-muted">
      <b className="text-text">{label}:</b> {weights.formLabel} {pct(weights.form)} · {weights.fixturesLabel}{' '}
      {pct(weights.fixture)} · {weights.valueLabel} {pct(weights.value)} · {weights.underlyingLabel}{' '}
      {pct(weights.underlying)}
    </span>
  );
}

// Tooltip text for a scan-row entry: same "raw → normalized (weight)" shape as
// ComponentChip, just condensed into one title string since 11 rows of chips
// would be too tall for a quick scan.
function breakdownTitle(entry, t) {
  const b = entry.breakdown;
  const fixtureNote = b.fixture.note ? ` (${t(FIXTURE_NOTE_LABEL_KEY[b.fixture.note])})` : '';
  const availabilitySuffix =
    b.availability.multiplier < 1 ? ` · ${t('sug.availabilityChipTitle', { pct: b.availability.pct })}` : '';
  return (
    `${t('weights.form')} ${pct(b.form.weight)}: ${b.form.raw} → ${b.form.normalized} · ` +
    `${t('weights.fixtures')} ${pct(b.fixture.weight)}: ${b.fixture.raw} → ${b.fixture.normalized}${fixtureNote} · ` +
    `${t('weights.value')} ${pct(b.value.weight)}: ${b.value.raw} → ${b.value.normalized} · ` +
    `${t('weights.underlying')} ${pct(b.underlying.weight)}: ${b.underlying.raw} → ${b.underlying.normalized}${availabilitySuffix} · ` +
    `score = ${entry.score}`
  );
}

const VERDICT_LABEL_KEY = { upgrade: 'sug.verdictUpgrade', keep: 'sug.verdictKeep', 'no-option': 'sug.verdictNone' };

function ScanRow({ row, t }) {
  const { current, suggestion, verdict } = row;
  return (
    <tr className={verdict === 'upgrade' ? 'top-pick' : ''}>
      <td data-label={t('table.pos')}>
        <span className={`pos pos-${posId(current.position)}`}>{current.position}</span>
      </td>
      <td className="name" title={breakdownTitle(current, t)} data-label={t('sug.scanCurrent')}>
        {current.name} <span className="muted">£{current.price.toFixed(2)}m</span>
        <PlayerFlags p={current} t={t} />
      </td>
      <td className="num" data-label={t('sug.currentScore')}>{current.score.toFixed(1)}</td>
      <td className="arrow-cell">→</td>
      {suggestion ? (
        <>
          <td className="name" title={breakdownTitle(suggestion, t)} data-label={t('sug.scanSuggested')}>
            {suggestion.name} <span className="muted">({suggestion.teamShort}, £{suggestion.price.toFixed(2)}m)</span>
            <PlayerFlags p={suggestion} t={t} />
          </td>
          <td className="num" data-label={t('sug.suggestedScore')}>{suggestion.score.toFixed(1)}</td>
          <td data-label={t('table.next3fdr')}>
            <FdrBadges fixtures={suggestion.nextFixtures} />
          </td>
        </>
      ) : (
        <td colSpan={3} className="muted">{t('sug.scanNoOption')}</td>
      )}
      <td data-label={t('sug.verdictColumn')}>
        <span className={`badge verdict-${verdict}`}>{t(VERDICT_LABEL_KEY[verdict])}</span>
      </td>
    </tr>
  );
}

export default function SuggestionsView() {
  const { t } = useLang();
  const [teamId, setTeamId] = useTeamId();
  const [squad, setSquad] = useState(null);
  const [squadError, setSquadError] = useState(null);
  const [squadLoading, setSquadLoading] = useState(false);

  const [replaceId, setReplaceId] = useState(null);
  const [transfers, setTransfers] = useState(null);
  const [transferError, setTransferError] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);

  const [captain, setCaptain] = useState(null);
  const [captainError, setCaptainError] = useState(null);
  const [captainLoading, setCaptainLoading] = useState(false);

  const [scan, setScan] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [pitchMode, setPitchMode] = useState('current');

  async function loadSquad(id) {
    const tid = String(id).trim();
    if (!tid) return;
    setTeamId(tid);
    setSquadLoading(true);
    setSquadError(null);
    setTransfers(null);
    setCaptain(null);
    setScan(null);
    setReplaceId(null);
    try {
      const s = await fetchSquad(tid);
      setSquad(s);
      // Captain suggestions and the squad scan only depend on the squad
      // itself, so load them right away without asking the user to pick anything.
      loadCaptain(tid);
      loadScan(tid);
    } catch (e) {
      setSquad(null);
      setSquadError(e.message);
    } finally {
      setSquadLoading(false);
    }
  }

  async function loadCaptain(id) {
    setCaptainLoading(true);
    setCaptainError(null);
    try {
      setCaptain(await fetchCaptain(id));
    } catch (e) {
      setCaptain(null);
      setCaptainError(e.message);
    } finally {
      setCaptainLoading(false);
    }
  }

  async function loadScan(id) {
    setScanLoading(true);
    setScanError(null);
    try {
      setScan(await fetchSquadScan(id));
    } catch (e) {
      setScan(null);
      setScanError(e.message);
    } finally {
      setScanLoading(false);
    }
  }

  async function loadTransfers() {
    if (!replaceId) return;
    setTransferLoading(true);
    setTransferError(null);
    try {
      setTransfers(await fetchTransfers(teamId, replaceId));
    } catch (e) {
      setTransfers(null);
      setTransferError(e.message);
    } finally {
      setTransferLoading(false);
    }
  }

  useEffect(() => {
    if (teamId) loadSquad(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const squadPlayers = squad?.squad ?? [];
  const weightsLabels = {
    formLabel: t('weights.form'),
    fixturesLabel: t('weights.fixtures'),
    valueLabel: t('weights.value'),
    underlyingLabel: t('weights.underlying'),
  };

  return (
    <div className="flex flex-col gap-6">
      <TeamIdInput value={teamId} onChangeValue={setTeamId} onLoad={loadSquad} loading={squadLoading} />
      {squad && (
        <div className="flex flex-wrap items-center gap-3 bg-panel border border-line rounded-md px-3.5 py-3">
          <span className="text-muted text-[13px]">
            {squad.eventName} · bank £{(scan?.bank ?? transfers?.bank ?? 0).toFixed(2)}m
          </span>
        </div>
      )}

      {squadError && (
        <div className="py-10 text-center text-[#ff8a80]">
          {squadError}
          <div className="text-muted mt-2">
            {t('teamId.errorHelp', { teamId: teamId || '…' })}
          </div>
        </div>
      )}

      {squadLoading && !squad && <LoadingState label={t('squad.loading')} />}

      {!squadError && squad && (
        <>
          {/* ---- Quick squad scan ---- */}
          <section className="bg-panel border border-line rounded-md p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
              <h2 className="m-0 font-display text-xl font-bold tracking-[0.01em]">{t('sug.quickScan')}</h2>
              {scan && <WeightsEcho weights={{ ...scan.weights, ...weightsLabels }} label={t('weights.label')} />}
            </div>

            <div className="text-[13px] text-muted mb-2.5">{t('sug.quickScanNote')}</div>

            {scan && (
              <>
                <div className="inline-flex gap-1 bg-panel border border-line rounded-lg p-[3px] mb-2.5">
                  <button
                    type="button"
                    className={`font-display text-[13px] font-bold tracking-[0.02em] uppercase px-3.5 py-1.5 rounded-sm cursor-pointer transition-colors ${pitchMode === 'current' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
                    onClick={() => setPitchMode('current')}
                  >
                    {t('sug.pitchCurrent')}
                  </button>
                  <button
                    type="button"
                    className={`font-display text-[13px] font-bold tracking-[0.02em] uppercase px-3.5 py-1.5 rounded-sm cursor-pointer transition-colors ${pitchMode === 'suggested' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
                    onClick={() => setPitchMode('suggested')}
                  >
                    {t('sug.pitchSuggested')}
                  </button>
                </div>
                {pitchMode === 'suggested' && (
                  <div className="text-[13px] text-muted mb-2.5">{t('sug.pitchSuggestedNote')}</div>
                )}
                <PitchView squad={squadPlayers} scan={scan.rows} mode={pitchMode} />
              </>
            )}

            {scanLoading && <LoadingState size="md" label={t('sug.scanning')} />}
            {scanError && <div className="py-10 text-center text-[#ff8a80]">{scanError}</div>}

            {scan && (
              <div className="overflow-auto border border-line rounded-md max-h-[72vh]">
                <table className="players sug scan">
                  <thead>
                    <tr>
                      <th>{t('table.pos')}</th>
                      <th>{t('sug.scanCurrent')}</th>
                      <th className="num">{t('table.score')}</th>
                      <th></th>
                      <th>{t('sug.scanSuggested')}</th>
                      <th className="num">{t('table.score')}</th>
                      <th>{t('table.next3fdr')}</th>
                      <th>{t('sug.verdictColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scan.rows.map((row) => (
                      <ScanRow key={row.current.id} row={row} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ---- Transfers ---- */}
          <section className="bg-panel border border-line rounded-md p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
              <h2 className="m-0 font-display text-xl font-bold tracking-[0.01em]">{t('sug.transferTitle')}</h2>
              {transfers && <WeightsEcho weights={{ ...transfers.weights, ...weightsLabels }} label={t('weights.label')} />}
            </div>

            <div className="sug-controls flex items-end gap-3 flex-wrap mb-3 max-sm:flex-col max-sm:items-stretch">
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('sug.sell')}
                <select
                  value={replaceId ?? ''}
                  onChange={(e) => setReplaceId(e.target.value ? Number(e.target.value) : null)}
                  className="min-w-[260px] max-[900px]:min-w-0 max-[900px]:flex-1 max-[900px]:basis-[200px] max-sm:w-full"
                >
                  <option value="">{t('sug.sellPlaceholder')}</option>
                  {squadPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.position}, £{p.price.toFixed(2)}m)
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={loadTransfers}
                disabled={!replaceId || transferLoading}
                className="self-end flex items-center justify-center gap-2 bg-accent text-white rounded-sm px-4 py-2 font-semibold cursor-pointer transition enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:opacity-60 disabled:cursor-default max-sm:self-stretch max-sm:text-center"
              >
                {transferLoading && <Spinner size="sm" className="border-white/30 border-t-white" />}
                {transferLoading ? t('sug.scoring') : t('sug.findReplacements')}
              </button>
            </div>

            {transferError && <div className="py-10 text-center text-[#ff8a80]">{transferError}</div>}

            {transfers && (
              <>
                <div className="text-[13px] text-muted mb-2.5">
                  {t('sug.sellingNote', {
                    name: transfers.replaced.name,
                    price: transfers.replaced.price.toFixed(2),
                    bank: transfers.bank.toFixed(2),
                  })}
                </div>
                <div className="overflow-auto border border-line rounded-md max-h-[72vh]">
                  <table className="players sug">
                    <thead>
                      <tr>
                        <th>{t('sug.rank')}</th>
                        <th>{t('table.player')}</th>
                        <th>{t('table.team')}</th>
                        <th>{t('table.pos')}</th>
                        <th>{t('table.price')}</th>
                        <th>{t('table.nextFixtures')}</th>
                        <th>{t('table.score')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transfers.candidates.length === 0 && (
                        <tr>
                          <td colSpan={7} className="muted">
                            {t('sug.noCandidates')}
                          </td>
                        </tr>
                      )}
                      {transfers.candidates.map((c, i) => (
                        <CandidateRow key={c.id} c={c} rank={i + 1} highlight={i === 0} t={t} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {/* ---- Captain ---- */}
          <section className="bg-panel border border-line rounded-md p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
              <h2 className="m-0 font-display text-xl font-bold tracking-[0.01em]">{t('sug.captainTitle')}</h2>
              {captain && <WeightsEcho weights={{ ...captain.weights, ...weightsLabels }} label={t('weights.label')} />}
            </div>

            {captainLoading && <LoadingState size="md" label={t('sug.captainScoring')} />}
            {captainError && <div className="py-10 text-center text-[#ff8a80]">{captainError}</div>}

            {captain && (
              <>
                <div className="text-[13px] text-muted mb-2.5">{t('sug.captainNote')}</div>
                <div className="overflow-auto border border-line rounded-md max-h-[72vh]">
                  <table className="players sug">
                    <thead>
                      <tr>
                        <th>{t('sug.rank')}</th>
                        <th>{t('table.player')}</th>
                        <th>{t('table.team')}</th>
                        <th>{t('table.pos')}</th>
                        <th>{t('table.price')}</th>
                        <th>{t('table.nextFixtures')}</th>
                        <th>{t('table.score')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {captain.candidates.map((c, i) => (
                        <CandidateRow key={c.id} c={c} rank={i + 1} highlight={i === 0} t={t} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}

      {!squadError && !squad && !squadLoading && (
        <TeamIdEmptyState onTrySample={() => loadSquad(SAMPLE_TEAM_ID)} />
      )}
    </div>
  );
}
