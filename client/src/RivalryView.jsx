import { useEffect, useState } from 'react';
import { fetchSquad, fetchTeams, fetchFixturesRaw, fetchPlayers } from './api.js';
import { useTeamId } from './useTeamId.js';
import { TeamIdInput } from './TeamIdControls.jsx';
import PitchView, { teamColor } from './PitchView.jsx';
import LoadingState from './LoadingSpinner.jsx';
import Tooltip from './Tooltip.jsx';
import { fdrBucket, formatKickoff, isMatchday } from './FdrBadges.jsx';
import { computeStandings, FormPills } from './TableView.jsx';
import { useLang } from './i18n.jsx';

// The rival slot gets its own localStorage key so it doesn't clobber the
// shared 'fpl-team-id' every other tab reads/writes — "your team" (the
// default key) still prefills from whatever's already saved there.
const RIVAL_STORAGE_KEY = 'fpl-rival-team-id';

// Bragging-rights text — a curated phrase bank, not a live AI/API call.
// A per-view LLM call was considered and deliberately skipped: it would need
// a server-side key (this app has never held one — see CLAUDE.md, "reads
// only the public FPL API"), adds real latency/cost/failure modes to what's
// otherwise an instant, free page, and a hand-picked bank gives more
// consistent comedic quality than a live generation call would per-request
// anyway. Several lines per outcome category instead of just one, picked
// deterministically (see pickBanter below) so the same matchup+score always
// shows the same line — re-renders don't make it flicker between phrases —
// while different matchups/scores do get variety.
const BANTER_PHRASES = {
  en: {
    tie: [
      'Dead even on {{p}} points — bragging rights are still up for grabs.',
      "{{p}}-{{p}}. A perfect stalemate. Somewhere, a neutral fan nods in approval.",
      "Tied at {{p}}. Nobody wins, nobody loses, everybody's mildly unsatisfied.",
      "{{p}} apiece. The football gods couldn't decide either.",
      'Exactly level on {{p}}. Flip a coin, argue about it in the group chat.',
      "{{p}}-{{p}}. A draw so clean it's almost suspicious.",
    ],
    close: [
      '{{w}} just edges it by {{m}} pt(s) — nail-biter.',
      '{{w}} scrapes past by {{m}}. Barely a win, still a win.',
      "{{w}} wins by the width of a bench player's cameo — {{m}} pts.",
      "{{m}} points. That's the margin. {{w}} will take it and say nothing more.",
      "A {{m}}-point squeaker for {{w}} — somebody's bench points are haunting them.",
      '{{w}} sneaks it by {{m}}. Every point mattered this week.',
    ],
    win: [
      '{{w}} takes the week by {{m}} pts.',
      '{{w}} comes out on top, {{m}} points clear — a solid, unarguable win.',
      '{{w}} wins comfortably, {{m}} points to spare.',
      'No drama here — {{w}} by {{m}}, fair and square.',
      '{{w}} put in the work this week. {{m}} points says so.',
      '{{w}} banks the bragging rights, {{m}} points in hand.',
    ],
    blowout: [
      '{{w}} is running away with it this week, {{m}} pts clear. Brutal.',
      "{{w}} didn't just win — {{w}} sent a message. {{m}} points of it.",
      "{{m}} points. That's not a win, that's a statement.",
      '{{w}} obliterated the competition by {{m}}. Screenshot this.',
      'Somebody tell the rival captain to hand in the armband — {{m}} points down.',
      "{{w}} by {{m}}. At this point it's not rivalry, it's a public service announcement.",
    ],
  },
  th: {
    tie: [
      'เสมอกันที่ {{p}} แต้ม — สิทธิ์คุยโวยังไม่มีใครได้ไป',
      '{{p}}-{{p}} เสมอกันเป๊ะ แฟนบอลที่เป็นกลางคงพยักหน้าพอใจ',
      'เสมอที่ {{p}} แต้ม ไม่มีใครแพ้ ไม่มีใครชนะ แต่ทุกคนรู้สึกค้างคาใจนิดๆ',
      '{{p}} แต้มเท่ากันเป๊ะ เทพเจ้าฟุตบอลก็ตัดสินใจไม่ได้เหมือนกัน',
      'เสมอกันที่ {{p}} แต้ม โยนเหรียญตัดสิน แล้วไปเถียงกันในกลุ่มแชทต่อ',
      '{{p}}-{{p}} เสมอกันจนน่าสงสัยว่าจงใจหรือเปล่า',
    ],
    close: [
      '{{w}} เฉือนชนะแค่ {{m}} แต้ม — สูสีสุดๆ',
      '{{w}} ชนะแบบหวุดหวิดแค่ {{m}} แต้ม ชนะก็คือชนะ',
      '{{w}} ชนะด้วยระยะห่างแค่ตัวสำรองโผล่มาเตะไม่กี่นาที — {{m}} แต้ม',
      '{{m}} แต้ม คือส่วนต่างทั้งหมด {{w}} รับไปเงียบๆ',
      'ชนะฉิวเฉียด {{m}} แต้มของ {{w}} — คะแนนตัวสำรองอาจหลอกหลอนใครบางคนอยู่',
      '{{w}} แซงหน้าไปแค่ {{m}} แต้ม ทุกแต้มมีความหมายจริงๆ สัปดาห์นี้',
    ],
    win: [
      '{{w}} ชนะสัปดาห์นี้ด้วยส่วนต่าง {{m}} แต้ม',
      '{{w}} ขึ้นนำอย่างสบายๆ ทิ้งห่าง {{m}} แต้ม — ชนะแบบไม่มีข้อกังขา',
      '{{w}} ชนะแบบสบายๆ เหลือแต้มกันตั้ง {{m}} แต้ม',
      'ไม่มีดราม่า {{w}} ชนะ {{m}} แต้ม ยุติธรรมชัดเจน',
      '{{w}} ทำการบ้านมาดีสัปดาห์นี้ {{m}} แต้มเป็นเครื่องพิสูจน์',
      '{{w}} เก็บสิทธิ์คุยโวไปครอง นำอยู่ {{m}} แต้ม',
    ],
    blowout: [
      '{{w}} ทิ้งห่างสัปดาห์นี้ถึง {{m}} แต้ม โหดจริง',
      '{{w}} ไม่ได้แค่ชนะ — {{w}} ส่งสารเตือน ด้วย {{m}} แต้ม',
      '{{m}} แต้ม นี่ไม่ใช่แค่ชนะ นี่คือการประกาศศักดา',
      '{{w}} ถล่มคู่แข่งไป {{m}} แต้ม แคปหน้าจอเก็บไว้ได้เลย',
      'บอกกัปตันทีมคู่แข่งให้ถอดปลอกแขนได้แล้ว — ตามหลังอยู่ {{m}} แต้ม',
      '{{w}} นำ {{m}} แต้ม ถึงจุดนี้ไม่ใช่ศึกคู่แข่งแล้ว นี่คือประกาศสาธารณะ',
    ],
  },
};

function banterCategory(margin) {
  if (margin === 0) return 'tie';
  if (margin >= 20) return 'blowout';
  if (margin >= 8) return 'win';
  return 'close';
}

function interpolate(str, vars) {
  let out = str;
  for (const [key, value] of Object.entries(vars)) out = out.replaceAll(`{{${key}}}`, String(value));
  return out;
}

// Deterministic pick (not Math.random()) so re-rendering the same matchup
// with the same score never swaps the phrase out from under the user —
// only an actually different matchup/score changes which line shows.
function hashSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.codePointAt(i)) >>> 0;
  return hash;
}

function pickBanter(category, lang, seed, vars) {
  const pool = BANTER_PHRASES[lang]?.[category] ?? BANTER_PHRASES.en[category];
  const template = pool[hashSeed(seed) % pool.length];
  return interpolate(template, vars);
}

function computeWinnerLabel(dataA, dataB, t) {
  if (dataA.teamPoints === dataB.teamPoints) return null;
  return dataA.teamPoints > dataB.teamPoints ? t('rivalry.yourTeam') : t('rivalry.rivalTeam');
}

// Copy-to-clipboard with a brief "Copied!" swap (the same pattern Wordle's
// share button popularized) plus a category-driven entrance animation
// (styles.css: .banter-tie/close/win/blowout) so a blowout actually feels
// like one instead of using the same quiet fade as a tie.
function BanterCard({ category, text, t }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can be unavailable (insecure context, denied
      // permission) — this is a nice-to-have convenience action, not worth
      // surfacing an error for; the button just silently does nothing.
    }
  }

  return (
    <div className={`banter-card banter-${category} bg-panel border border-accent/40 rounded-md p-4 mb-3.5 shadow-sm text-center relative`}>
      <div className="font-display text-lg font-bold pr-8">{text}</div>
      <Tooltip content={copied ? t('rivalry.copied') : t('rivalry.copy')}>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t('rivalry.copy')}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-panel-2 border border-line text-muted cursor-pointer transition hover:text-accent hover:border-accent active:scale-95"
        >
          {copied ? '✓' : '⧉'}
        </button>
      </Tooltip>
    </div>
  );
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

// Every fixture between two specific clubs this season (usually 2 — home
// leg + away leg — but computed generically rather than assumed, in case a
// season is mid-way or has an unusual schedule). Raw FPL fixture fields
// (team_h/team_a/etc.) straight from /api/fixtures, not buildData()'s
// per-player nextFixtures shape — this is a club-vs-club lookup, not tied to
// any one player.
function clubMeetings(fixtures, idA, idB) {
  return fixtures
    .filter((f) => (f.team_h === idA && f.team_a === idB) || (f.team_h === idB && f.team_a === idA))
    .sort((a, b) => a.event - b.event)
    .map((f) => ({
      id: f.id,
      event: f.event,
      kickoffTime: f.kickoff_time,
      // Same finished/finished_provisional quirk as buildFixtureGrid()'s
      // `done` — a fully-played match can sit at finished=false for up to
      // ~1h while FPL's own confirmation catches up.
      done: f.finished || f.finished_provisional,
      homeTeamId: f.team_h,
      awayTeamId: f.team_a,
      homeScore: f.team_h_score,
      awayScore: f.team_a_score,
      homeDifficulty: f.team_h_difficulty,
      awayDifficulty: f.team_a_difficulty,
    }));
}

// Wins/draws for club A vs club B across only the meetings that have
// actually finished — an upcoming or in-progress leg contributes nothing
// yet (no score to judge).
function seriesRecord(meetings, idA) {
  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  for (const m of meetings) {
    if (!m.done || m.homeScore == null || m.awayScore == null) continue;
    const scoreA = m.homeTeamId === idA ? m.homeScore : m.awayScore;
    const scoreB = m.homeTeamId === idA ? m.awayScore : m.homeScore;
    if (scoreA > scoreB) winsA++;
    else if (scoreB > scoreA) winsB++;
    else draws++;
  }
  return { winsA, winsB, draws, played: winsA + winsB + draws };
}

// Season-standings snapshot for both clubs, side by side, above the meeting
// list — a user picking two clubs wants "how are these two doing right now"
// before drilling into individual legs. Reuses TableView's own
// computeStandings() (same /api/teams + /api/fixtures this tab already
// fetches) rather than a second, parallel league-table calculation, and its
// FormPills so a club's last-5 reads identically here and on the Table tab.
function ClubFormStrip({ standings, teamA, teamB, t }) {
  const rowA = standings.find((r) => r.id === teamA.id);
  const rowB = standings.find((r) => r.id === teamB.id);
  if (!rowA || !rowB) return null;
  return (
    <div className="bg-panel border border-line rounded-md p-4 mb-3.5 shadow-sm grid grid-cols-2 gap-4 max-sm:grid-cols-1">
      {[
        { club: teamA, row: rowA },
        { club: teamB, row: rowB },
      ].map(({ club, row }) => (
        <div key={club.id} className="flex items-center gap-3 flex-wrap">
          <ClubAvatar shortName={club.shortName} />
          <div className="flex-1 min-w-[120px]">
            <div className="font-display text-sm font-bold">{club.name}</div>
            <div className="text-xs text-muted">
              #{row.rank} · {row.points} {t('table.pts')} · {row.gd > 0 ? `+${row.gd}` : row.gd} {t('table.gd')}
            </div>
          </div>
          <FormPills form={row.form} t={t} />
        </div>
      ))}
    </div>
  );
}

function ClubAvatar({ shortName }) {
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-display font-bold text-white shrink-0"
      style={{ background: teamColor(shortName) }}
    >
      {shortName}
    </span>
  );
}

function ClubSelect({ label, value, onChange, teams, otherValue, t }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('rivalry.selectClub')}</option>
        {teams.map((tm) => (
          <option key={tm.id} value={tm.id} disabled={String(tm.id) === otherValue}>
            {tm.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// Top N players for one club. Sorted by season total points by default (a
// proxy for "who's actually likely to start and matter" without needing a
// real lineup prediction); the 'goals' metric instead ranks by goals+assists
// so the same list can answer "who's actually been scoring for this club",
// which total points alone can hide (a high-point defender vs. a
// goal-poor-but-creative forward look identical under the points sort).
function topPlayersForClub(players, teamId, metric = 'points', limit = 5) {
  const list = players.filter((p) => p.teamId === teamId);
  if (metric === 'goals') {
    return list.sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.goals - a.goals).slice(0, limit);
  }
  return list.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, limit);
}

// One reference row inside the accordion — the same core columns as the
// Players table (price/form/pts/ownership) so the numbers mean the same
// thing a user already knows from there, plus the two flags that matter
// most for THIS specific match: fitness doubt and set-piece duty. The
// 'goals' metric swaps form+points for goals+assists (rather than adding two
// more columns on top) since both views are trying to answer a different
// question, not layer more numbers into the same one.
function PlayerRefRow({ p, metric, t }) {
  return (
    <div className="flex items-center gap-2 text-xs py-1 border-b border-line last:border-b-0">
      <span className={`pos pos-${p.positionId}`}>{p.position}</span>
      <span className="flex-1 min-w-0 truncate">
        {p.name}
        {p.status !== 'a' && (
          <Tooltip content={p.news || p.status}>
            <span className="news"> ⚑</span>
          </Tooltip>
        )}
      </span>
      {p.penaltyOrder === 1 && (
        <Tooltip content={t('sug.penaltyTakerTitle')}>
          <span className="badge event-flag penalty">{t('sug.penaltyTakerBadge')}</span>
        </Tooltip>
      )}
      <span className="text-muted w-12 text-right shrink-0">£{p.price.toFixed(1)}m</span>
      {metric === 'goals' ? (
        <>
          <span className="text-muted w-16 text-right shrink-0 whitespace-nowrap">{t('rivalry.goals')} {p.goals}</span>
          <span className="text-muted w-16 text-right shrink-0 whitespace-nowrap">{t('rivalry.assists')} {p.assists}</span>
        </>
      ) : (
        <>
          <span className="text-muted w-10 text-right shrink-0">{t('table.form')} {p.form.toFixed(1)}</span>
          <span className="font-bold w-8 text-right shrink-0">{p.totalPoints}</span>
        </>
      )}
      <span className="text-muted w-12 text-right shrink-0">{p.ownership.toFixed(1)}%</span>
    </div>
  );
}

// Accordion body — top players from each club, side by side, so a user
// deciding a transfer/captain call around this fixture has the actual
// numbers (price, form, total points, ownership, fitness, set-piece order)
// to analyze rather than just the scoreline.
function ClubPlayersPanel({ home, away, homePlayers, awayPlayers, metric, onMetricChange, t }) {
  return (
    <div className="pt-3 mt-3 border-t border-line">
      <div className="inline-flex gap-1 bg-panel-2 border border-line rounded-full p-[3px] mb-3">
        <button
          type="button"
          onClick={() => onMetricChange('points')}
          className={`font-display text-[11px] font-bold tracking-[0.02em] uppercase px-3 py-1 rounded-full cursor-pointer transition ${metric === 'points' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
        >
          {t('rivalry.topByPoints')}
        </button>
        <button
          type="button"
          onClick={() => onMetricChange('goals')}
          className={`font-display text-[11px] font-bold tracking-[0.02em] uppercase px-3 py-1 rounded-full cursor-pointer transition ${metric === 'goals' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
        >
          {t('rivalry.topScorers')}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        {[
          { side: 'home', club: home, list: homePlayers },
          { side: 'away', club: away, list: awayPlayers },
        ].map(({ side, club, list }) => (
          <div key={side}>
            <div className="flex items-center gap-2 mb-1.5">
              <ClubAvatar shortName={club?.shortName ?? '?'} />
              <span className="font-display text-sm font-bold">{club?.name ?? '?'}</span>
            </div>
            {list.length === 0 ? (
              <div className="text-muted text-xs">{t('fdr.none')}</div>
            ) : (
              list.map((p) => <PlayerRefRow key={p.id} p={p} metric={metric} t={t} />)
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MeetingCard({ meeting, teamById, idA, players, expanded, onToggle, metric, onMetricChange, t }) {
  const home = teamById.get(meeting.homeTeamId);
  const away = teamById.get(meeting.awayTeamId);
  const matchday = isMatchday(meeting.kickoffTime) && !meeting.done;
  const homeIsA = meeting.homeTeamId === idA;
  const homePlayers = players ? topPlayersForClub(players, meeting.homeTeamId, metric) : [];
  const awayPlayers = players ? topPlayersForClub(players, meeting.awayTeamId, metric) : [];
  return (
    <div className={`bg-panel border border-line rounded-md p-3.5 shadow-sm${matchday ? ' matchday' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 flex-wrap cursor-pointer text-left bg-transparent"
      >
        <span className="font-display text-xs font-bold text-muted w-14 shrink-0">GW{meeting.event}</span>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <ClubAvatar shortName={home?.shortName ?? '?'} />
          <span className={`text-sm ${homeIsA ? 'font-bold' : ''}`}>{home?.name ?? '?'}</span>
          {meeting.done && meeting.homeScore != null ? (
            <span className="font-display text-lg font-bold px-2">{meeting.homeScore}–{meeting.awayScore}</span>
          ) : (
            <span className="text-muted text-xs px-2">{t('rivalry.vs')}</span>
          )}
          <span className={`text-sm ${!homeIsA ? 'font-bold' : ''}`}>{away?.name ?? '?'}</span>
          <ClubAvatar shortName={away?.shortName ?? '?'} />
        </div>
        <div className="text-xs text-muted shrink-0">
          {meeting.done ? t('rivalry.final') : formatKickoff(meeting.kickoffTime, t)}
        </div>
        <div className="flex gap-1 shrink-0 items-center">
          <Tooltip content={t('rivalry.fdrForTitle', { team: home?.shortName ?? '?' })}>
            <span className={`fdr-badge fdr-${fdrBucket(meeting.homeDifficulty)}`}>{meeting.homeDifficulty}</span>
          </Tooltip>
          <Tooltip content={t('rivalry.fdrForTitle', { team: away?.shortName ?? '?' })}>
            <span className={`fdr-badge fdr-${fdrBucket(meeting.awayDifficulty)}`}>{meeting.awayDifficulty}</span>
          </Tooltip>
          <span className={`text-muted text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </div>
      </button>
      {expanded && (
        <ClubPlayersPanel
          home={home}
          away={away}
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          metric={metric}
          onMetricChange={onMetricChange}
          t={t}
        />
      )}
    </div>
  );
}

// Club-vs-club H2H — user-picked clubs (not derived from anyone's squad),
// sourced from the season's actual fixture list rather than a new server
// endpoint (/api/teams + /api/fixtures already exist and this is a pure
// client-side filter/join over them, same "thin server" precedent as
// Fixture Swing and the manager-vs-manager side of this same tab).
function ClubH2H({ t }) {
  const [teams, setTeams] = useState(null);
  const [fixtures, setFixtures] = useState(null);
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState(null);
  const [clubA, setClubA] = useState('');
  const [clubB, setClubB] = useState('');
  // Which meeting card's accordion is open — at most one at a time, keyed by
  // fixture id (not an index), so it doesn't shift if the meetings list ever
  // reorders. Starts closed; player reference data is only worth the extra
  // screen space once a user asks for it.
  const [expandedId, setExpandedId] = useState(null);
  // Shared across every open accordion rather than per-card state — a user
  // comparing "who's actually scoring" wants that lens applied consistently
  // if they check more than one leg, not reset back to points each time.
  const [metric, setMetric] = useState('points');

  useEffect(() => {
    let alive = true;
    Promise.all([fetchTeams(), fetchFixturesRaw(), fetchPlayers()])
      .then(([teamsRes, fixturesRes, playersRes]) => {
        if (!alive) return;
        setTeams(teamsRes.teams);
        setFixtures(fixturesRes);
        setPlayers(playersRes.players);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="py-10 text-center text-[#ff8a80]">{t('status.error', { message: error })}</div>;
  if (!teams || !fixtures || !players) return <LoadingState label={t('status.loading')} />;

  const teamById = new Map(teams.map((tm) => [tm.id, tm]));
  const idA = clubA ? Number(clubA) : null;
  const idB = clubB ? Number(clubB) : null;
  const bothPicked = idA != null && idB != null && idA !== idB;
  const meetings = bothPicked ? clubMeetings(fixtures, idA, idB) : [];
  const record = bothPicked ? seriesRecord(meetings, idA) : null;
  const standings = bothPicked ? computeStandings(teams, fixtures) : null;

  return (
    <div>
      <div className="filters flex flex-wrap items-center gap-4 bg-panel border border-line rounded-md px-3.5 py-3 mb-3.5 shadow-sm max-sm:flex-col max-sm:items-stretch">
        <ClubSelect label={t('rivalry.clubA')} value={clubA} onChange={setClubA} teams={teams} otherValue={clubB} t={t} />
        <ClubSelect label={t('rivalry.clubB')} value={clubB} onChange={setClubB} teams={teams} otherValue={clubA} t={t} />
      </div>

      {!bothPicked && <div className="py-10 text-center text-muted">{t('rivalry.pickBothClubs')}</div>}

      {bothPicked && standings && (
        <ClubFormStrip standings={standings} teamA={teamById.get(idA)} teamB={teamById.get(idB)} t={t} />
      )}

      {bothPicked && record && (
        <div className="bg-panel border border-line rounded-md p-4 mb-3.5 shadow-sm text-center">
          {record.played === 0 ? (
            <div className="text-muted">{t('rivalry.notPlayedYet')}</div>
          ) : (
            <div className="font-display text-lg font-bold">
              {teamById.get(idA)?.name} {record.winsA} – {record.draws} – {record.winsB} {teamById.get(idB)?.name}
            </div>
          )}
        </div>
      )}

      {bothPicked && meetings.length === 0 && (
        <div className="py-10 text-center text-muted">{t('rivalry.noMeetings')}</div>
      )}

      {bothPicked && meetings.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              teamById={teamById}
              idA={idA}
              players={players}
              expanded={expandedId === m.id}
              onToggle={() => setExpandedId((cur) => (cur === m.id ? null : m.id))}
              metric={metric}
              onMetricChange={setMetric}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RivalryView() {
  const { t, lang } = useLang();
  const [mode, setMode] = useState('managers');
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
  const banterCat = bothLoaded ? banterCategory(margin) : null;
  // Seeded by the two team IDs + both scores: the same matchup at the same
  // score always shows the same line (stable across re-renders), but a
  // different gameweek's score for the same two teams picks a fresh one.
  const banterText = bothLoaded
    ? pickBanter(banterCat, lang, `${teamIdA}-${teamIdB}-${dataA.teamPoints}-${dataB.teamPoints}`, {
        w: winnerLabel,
        m: margin,
        p: dataA.teamPoints,
      })
    : null;

  return (
    <div>
      <div className="bg-panel border border-line rounded-md p-4 mb-3.5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <h2 className="m-0 font-display text-xl font-bold tracking-[0.01em]">{t('rivalry.title')}</h2>
          <div className="inline-flex gap-1 bg-panel-2 border border-line rounded-full p-[3px] shrink-0">
            <button
              type="button"
              onClick={() => setMode('managers')}
              className={`font-display text-[11px] font-bold tracking-[0.02em] uppercase px-3 py-1 rounded-full cursor-pointer transition ${mode === 'managers' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
            >
              {t('rivalry.modeManagers')}
            </button>
            <button
              type="button"
              onClick={() => setMode('clubs')}
              className={`font-display text-[11px] font-bold tracking-[0.02em] uppercase px-3 py-1 rounded-full cursor-pointer transition ${mode === 'clubs' ? 'bg-accent text-white' : 'bg-transparent text-muted hover:text-text'}`}
            >
              {t('rivalry.modeClubs')}
            </button>
          </div>
        </div>
        <div className="text-[13px] text-muted">{mode === 'managers' ? t('rivalry.note') : t('rivalry.clubNote')}</div>
      </div>

      {mode === 'managers' ? (
        <>
          {bothLoaded && <BanterCard key={banterText} category={banterCat} text={banterText} t={t} />}

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
        </>
      ) : (
        <ClubH2H t={t} />
      )}
    </div>
  );
}
