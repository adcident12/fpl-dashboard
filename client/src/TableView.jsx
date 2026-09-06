import { useEffect, useState } from 'react';
import { fetchTeams, fetchFixturesRaw } from './api.js';
import LoadingState from './LoadingSpinner.jsx';
import Tooltip from './Tooltip.jsx';
import { teamColor } from './PitchView.jsx';
import { fdrBucket, formatKickoff, isMatchday } from './FdrBadges.jsx';
import { useLang } from './i18n.jsx';

// Full Premier League standings, computed entirely client-side from
// /api/fixtures + /api/teams (both already exist — Club H2H uses the exact
// same two calls) rather than a new server endpoint, matching this app's
// established "thin server" precedent (Fixture Swing, Club H2H). Only
// fixtures that have actually finished count — same finished/
// finished_provisional quirk as buildFixtureGrid()'s `done`, since a fully-
// played match can sit at finished=false for up to ~1h while FPL's own
// confirmation catches up.
function computeStandings(teams, fixtures) {
  const stats = new Map(
    teams.map((tm) => [tm.id, { id: tm.id, name: tm.name, shortName: tm.shortName, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, form: [] }])
  );

  const finished = fixtures
    .filter((f) => (f.finished || f.finished_provisional) && f.team_h_score != null && f.team_a_score != null)
    .sort((a, b) => new Date(a.kickoff_time || 0) - new Date(b.kickoff_time || 0));

  for (const f of finished) {
    const home = stats.get(f.team_h);
    const away = stats.get(f.team_a);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.gf += f.team_h_score;
    home.ga += f.team_a_score;
    away.gf += f.team_a_score;
    away.ga += f.team_h_score;
    if (f.team_h_score > f.team_a_score) {
      home.won++;
      away.lost++;
      home.form.push('W');
      away.form.push('L');
    } else if (f.team_h_score < f.team_a_score) {
      away.won++;
      home.lost++;
      home.form.push('L');
      away.form.push('W');
    } else {
      home.drawn++;
      away.drawn++;
      home.form.push('D');
      away.form.push('D');
    }
  }

  const table = [...stats.values()].map((s) => ({
    ...s,
    gd: s.gf - s.ga,
    points: s.won * 3 + s.drawn,
    form: s.form.slice(-5),
  }));

  // Standard PL tiebreak order (points, then goal difference, then goals
  // scored) — head-to-head sub-rules exist too but aren't worth the
  // complexity here; this is a decision-support dashboard, not the
  // authoritative league record.
  table.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name));
  // `rank` is attached once, here, in canonical league order — same pattern
  // as Fixture Swing's `computeFixtureSwing()`, so re-sorting the displayed
  // rows by a different column (below) never renumbers or re-colors a row's
  // actual league position.
  return table.map((row, i) => ({ ...row, rank: i + 1 }));
}

// Each team's next fixture not yet played, straight from the same raw
// fixture list the standings themselves come from — reused for a "what's
// next" column so the table doubles as a jumping-off point into planning,
// not just a static scoreboard.
function nextFixtureForTeam(fixtures, teamId, teamById) {
  const upcoming = fixtures
    .filter((f) => (f.team_h === teamId || f.team_a === teamId) && !(f.finished || f.finished_provisional))
    .sort((a, b) => new Date(a.kickoff_time || 0) - new Date(b.kickoff_time || 0));
  const f = upcoming[0];
  if (!f) return null;
  const home = f.team_h === teamId;
  const oppId = home ? f.team_a : f.team_h;
  const opp = teamById.get(oppId);
  return {
    opponentShort: opp?.shortName ?? '?',
    opponentName: opp?.name ?? '?',
    home,
    difficulty: home ? f.team_h_difficulty : f.team_a_difficulty,
    kickoffTime: f.kickoff_time,
  };
}

// Champions League (top 4) / relegation (bottom 3) zone accents — the two
// zone boundaries that stay true across seasons regardless of cup-winner
// coefficient edge cases (a 5th Europe slot sometimes exists but isn't
// stable enough to color confidently). A thin left border, not a full row
// tint, so it reads as a subtle margin marker rather than competing with
// the form pills/next-fixture badge already doing their own color-coding.
// Real hand-written classes (`.zone-euro`/`.zone-relegation` in styles.css),
// not Tailwind's border-l-* utilities: the mobile card-table rule
// (`table.players tr { border: 1px solid ... }`, styles.css) has higher
// selector specificity than a single Tailwind utility class and was
// silently winning the cascade on a phone, resetting the border back to the
// plain line color — a real, verified-in-browser bug, not a hypothetical.
function zoneAccent(rank, total) {
  if (rank <= 4) return 'zone-euro';
  if (rank > total - 3) return 'zone-relegation';
  return '';
}

const FORM_CLASS = { W: 'bg-easy', D: 'bg-panel-3 border border-line', L: 'bg-hard' };
const FORM_TEXT = { W: 'text-white', D: 'text-muted', L: 'text-white' };

function FormPills({ form, t }) {
  if (form.length === 0) return <span className="text-muted text-xs">—</span>;
  return (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <Tooltip key={`${i}-${r}`} content={t(`table.form${r}`)}>
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${FORM_CLASS[r]} ${FORM_TEXT[r]}`}>
            {r}
          </span>
        </Tooltip>
      ))}
    </span>
  );
}

function NextFixtureBadge({ next, t }) {
  if (!next) return <span className="text-muted text-xs">—</span>;
  const bucket = fdrBucket(next.difficulty);
  const matchday = isMatchday(next.kickoffTime);
  const side = next.home ? t('fixtures.home') : t('fixtures.away');
  const title = t('table.nextFixtureTooltip', {
    opponent: next.opponentName,
    side,
    kickoff: formatKickoff(next.kickoffTime, t),
    fdr: next.difficulty,
    label: t(`fdr.${bucket}`),
  });
  return (
    <Tooltip content={title}>
      <span className={`fdr-badge fdr-${bucket}${matchday ? ' matchday' : ''}`}>
        {next.home ? 'v' : '@'} {next.opponentShort}
      </span>
    </Tooltip>
  );
}

const SORTABLE_COLUMNS = [
  { key: 'rank', label: '#' },
  { key: 'name', label: 'table.club' },
  { key: 'played', label: 'table.played' },
  { key: 'won', label: 'table.won' },
  { key: 'drawn', label: 'table.drawn' },
  { key: 'lost', label: 'table.lost' },
  { key: 'gf', label: 'table.gf' },
  { key: 'ga', label: 'table.ga' },
  { key: 'gd', label: 'table.gd' },
  { key: 'points', label: 'table.pts' },
];

// Rank/club name make more sense to start ascending (1st place, A-Z); the
// numeric stat columns make more sense starting descending (most goals/
// points first) — the same asymmetry App.jsx's own Players-table sort uses.
// Module scope, not defined inside the component: it doesn't close over any
// component state, so recreating it every render would buy nothing.
function defaultSortDir(key) {
  if (key === 'name' || key === 'rank') return 'asc';
  return 'desc';
}

export default function TableView() {
  const { t } = useLang();
  const [teams, setTeams] = useState(null);
  const [fixtures, setFixtures] = useState(null);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('rank');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    let alive = true;
    Promise.all([fetchTeams(), fetchFixturesRaw()])
      .then(([teamsRes, fixturesRes]) => {
        if (!alive) return;
        setTeams(teamsRes.teams);
        setFixtures(fixturesRes);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="py-10 text-center text-[#ff8a80]">{t('status.error', { message: error })}</div>;
  if (!teams || !fixtures) return <LoadingState label={t('status.loading')} />;

  const teamById = new Map(teams.map((tm) => [tm.id, tm]));
  const standings = computeStandings(teams, fixtures);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(defaultSortDir(key));
    }
  }

  const dir = sortDir === 'asc' ? 1 : -1;
  const rows = [...standings].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  });

  return (
    <div>
      <div className="bg-panel border border-line rounded-md p-4 mb-3.5 shadow-sm">
        <h2 className="m-0 mb-2 font-display text-xl font-bold tracking-[0.01em]">{t('table.title')}</h2>
        <div className="text-[13px] text-muted">{t('table.note')}</div>
      </div>

      <div className="overflow-auto border border-line rounded-md max-h-[72vh] shadow-sm max-sm:max-h-none max-sm:overflow-visible">
        <table className="players table-standings">
          <thead>
            <tr>
              {SORTABLE_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="sortable"
                  onClick={() => toggleSort(c.key)}
                >
                  {c.key === 'rank' ? c.label : t(c.label)}
                  {sortKey === c.key && <span className="arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
              <th>{t('table.form')}</th>
              <th>{t('table.next')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={zoneAccent(row.rank, standings.length)}>
                <td className="num" data-label="#">{row.rank}</td>
                <td className="name" data-label={t('table.club')}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-display font-bold text-white shrink-0"
                      style={{ background: teamColor(row.shortName) }}
                    >
                      {row.shortName}
                    </span>
                    {row.name}
                  </span>
                </td>
                <td className="num" data-label={t('table.played')}>{row.played}</td>
                <td className="num" data-label={t('table.won')}>{row.won}</td>
                <td className="num" data-label={t('table.drawn')}>{row.drawn}</td>
                <td className="num" data-label={t('table.lost')}>{row.lost}</td>
                <td className="num" data-label={t('table.gf')}>{row.gf}</td>
                <td className="num" data-label={t('table.ga')}>{row.ga}</td>
                <td className="num" data-label={t('table.gd')}>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                <td className="num" data-label={t('table.pts')}><b>{row.points}</b></td>
                <td data-label={t('table.form')}>
                  <FormPills form={row.form} t={t} />
                </td>
                <td data-label={t('table.next')}>
                  <NextFixtureBadge next={nextFixtureForTeam(fixtures, row.id, teamById)} t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="legend">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-easy inline-block" /> {t('table.zoneEuro')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-hard inline-block" /> {t('table.zoneRelegation')}
        </span>
        <span className="muted">{t('table.footnote')}</span>
      </footer>
    </div>
  );
}
