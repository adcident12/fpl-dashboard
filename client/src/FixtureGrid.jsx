import { useEffect, useState } from 'react';
import { fetchFixtureGrid } from './api.js';
import LoadingState from './LoadingSpinner.jsx';
import Tooltip from './Tooltip.jsx';
import FdrBadges, { fdrBucket, formatKickoff, formatKickoffShort, isMatchday } from './FdrBadges.jsx';
import { teamColor } from './PitchView.jsx';
import { useLang } from './i18n.jsx';

// Cells use Tooltip's as="div" (not the default "span") — .cell is a
// block-level flex container, and Tooltip's wrapper needs to be block-level
// too so the DOM stays block-in-block instead of a <div> nested in a <span>.
// This grid used to keep native title= tooltips here specifically (documented
// as a deliberate exemption), but the browser's own tooltip styling/position
// can't be touched via CSS at all — a real, reported inconsistency next to
// the Material-styled Tooltip used everywhere else in the app — so it's
// switched over too now.

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
  const matchday = isMatchday(f.kickoffTime) && !f.done;
  const title = matchday
    ? `${t('fixtures.today')} — vs ${f.opponentName} (${side}) — ${formatKickoff(f.kickoffTime, t)} — FDR ${f.difficulty}/5`
    : `vs ${f.opponentName} (${side}) — ${formatKickoff(f.kickoffTime, t)} — FDR ${f.difficulty}/5`;
  return (
    <Tooltip as="div" content={title}>
      <div
        className={`cell fdr-${f.difficulty}${f.done ? ' done' : ''}${matchday ? ' matchday' : ''}`}
        style={{ background: bg, color: dark ? '#fff' : '#111' }}
      >
        <span className="cell-opp">
          {f.home ? 'v' : '@'} {f.opponentShort}
        </span>
        {f.done ? (
          <span className="cell-score">
            {f.scoreFor}–{f.scoreAgainst}
          </span>
        ) : (
          <span className="cell-kickoff">{formatKickoffShort(f.kickoffTime, t)}</span>
        )}
      </div>
    </Tooltip>
  );
}

function Cell({ fixtures, t }) {
  if (fixtures.length === 0) {
    return (
      <Tooltip as="div" content={t('fixtures.blank')}>
        <div className="cell empty blank-cell">{t('fixtures.blank')}</div>
      </Tooltip>
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

// Fan feature — teams ranked by average fixture difficulty over the same
// visible window as the grid above, easiest run first. Computed entirely
// client-side from the grid's own data (no new server endpoint): flattens
// each team's per-gameweek fixture arrays (0+ each, so a Blank Gameweek just
// contributes nothing to the average rather than skewing it, and a Double
// Gameweek's two legs both count individually). `rank` is fixed at the
// canonical easiest-first order regardless of the display toggle below, so
// the top/bottom-3 accent coloring never moves when the list is reversed.
function computeFixtureSwing(data) {
  return data.teams
    .map((team) => {
      const flat = team.fixtures.flat();
      const avgFDR = flat.length ? flat.reduce((s, f) => s + f.difficulty, 0) / flat.length : null;
      return { id: team.id, name: team.name, shortName: team.shortName, avgFDR, fixtures: flat };
    })
    .sort((a, b) => (a.avgFDR ?? 99) - (b.avgFDR ?? 99))
    .map((team, i) => ({ ...team, rank: i }));
}

// Top/bottom 3 get their rank number colored — same green/red vocabulary as
// the FDR badges themselves, so "easiest run" / "hardest run" reads at a
// glance without a full-row border/tint competing with the meter bar's own
// per-row coloring right next to it.
function swingRankClass(rank, total) {
  if (rank < 3) return 'text-easy';
  if (rank >= total - 3) return 'text-hard';
  return 'text-muted';
}

// A compact fill-bar next to the average — the same "read the run at a
// glance without reading the number" idea real FPL fixture-ticker tools use
// (Fantasy Football Scout / Fantasy Football Pundit both pair a numeric
// difficulty total with a color scale). Bucketed into the same 3 tones as
// FdrBadges (easy/med/hard) rather than a 5-stop gradient, so it reads with
// the same vocabulary as every other FDR indicator in the app.
// Written as a lookup of COMPLETE class-name strings, not `bg-${bucket}` —
// Tailwind's compiler statically scans source for whole class-name strings,
// so a template-built name is invisible to it (the exact trap CLAUDE.md
// documents for pos-${positionId}/fdr-${bucket}); `bg-${bucket}` here would
// only "work" by accident for whichever bucket name happens to already
// appear literally elsewhere in the codebase (bg-easy/bg-hard do, from the
// sort-toggle buttons below — bg-med doesn't appear anywhere else, so every
// medium-difficulty bar silently rendered with no fill color at all).
const METER_FILL_CLASS = { easy: 'bg-easy', med: 'bg-med', hard: 'bg-hard' };

function DifficultyMeter({ avgFDR }) {
  if (avgFDR == null) return <div className="w-14 shrink-0" />;
  const pct = Math.max(6, Math.min(100, ((5 - avgFDR) / 4) * 100));
  const bucket = fdrBucket(Math.round(avgFDR));
  return (
    <div className="w-14 h-1.5 rounded-full bg-panel-3 overflow-hidden shrink-0">
      <div className={`h-full rounded-full ${METER_FILL_CLASS[bucket]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FixtureSwingRow({ team, total, t }) {
  return (
    <div className="flex items-center gap-3 px-2.5 py-1.5 rounded-sm transition-colors hover:bg-panel-2 max-sm:flex-col max-sm:items-stretch max-sm:gap-1.5 max-sm:py-2">
      <div className="flex items-center gap-2.5 shrink-0 min-w-0">
        <span className={`text-xs w-5 shrink-0 text-right font-bold ${swingRankClass(team.rank, total)}`}>{team.rank + 1}</span>
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-display font-bold text-white shrink-0"
          style={{ background: teamColor(team.shortName) }}
        >
          {team.shortName}
        </span>
        <span className="font-display text-[13px] font-bold w-[110px] shrink-0 truncate">{team.name}</span>
        <DifficultyMeter avgFDR={team.avgFDR} />
        <span className="text-xs text-muted w-7 shrink-0 tabular-nums">
          {team.avgFDR != null ? team.avgFDR.toFixed(1) : '—'}
        </span>
      </div>
      <div className="max-sm:pl-8 flex-1 min-w-0 flex justify-end max-sm:justify-start">
        <FdrBadges fixtures={team.fixtures} />
      </div>
    </div>
  );
}

function FixtureSwing({ data, t }) {
  const [sortDir, setSortDir] = useState('asc');
  const ranked = computeFixtureSwing(data);
  const ordered = sortDir === 'asc' ? ranked : [...ranked].reverse();
  return (
    <div className="bg-panel border border-line rounded-md p-3.5 mb-3.5 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h3 className="m-0 font-display text-base font-bold tracking-[0.01em]">{t('fixtures.swingTitle')}</h3>
        <div className="inline-flex gap-1 bg-panel-2 border border-line rounded-full p-[3px] shrink-0">
          <button
            type="button"
            onClick={() => setSortDir('asc')}
            className={`font-display text-[11px] font-bold tracking-[0.02em] uppercase px-3 py-1 rounded-full cursor-pointer transition ${sortDir === 'asc' ? 'bg-easy text-white' : 'bg-transparent text-muted hover:text-text'}`}
          >
            {t('fixtures.swingEasiest')}
          </button>
          <button
            type="button"
            onClick={() => setSortDir('desc')}
            className={`font-display text-[11px] font-bold tracking-[0.02em] uppercase px-3 py-1 rounded-full cursor-pointer transition ${sortDir === 'desc' ? 'bg-hard text-white' : 'bg-transparent text-muted hover:text-text'}`}
          >
            {t('fixtures.swingHardest')}
          </button>
        </div>
      </div>
      <div className="text-[13px] text-muted mb-3">{t('fixtures.swingNote')}</div>
      <div className="flex flex-col gap-1">
        {ordered.map((team) => (
          <FixtureSwingRow key={team.id} team={team} total={ranked.length} t={t} />
        ))}
      </div>
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
      <FixtureSwing data={data} t={t} />

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
