import { useLang } from './i18n.jsx';
import Tooltip from './Tooltip.jsx';

// These badges used to keep native title= tooltips instead of the shared
// Tooltip.jsx component, out of caution: .jersey-badge/.priority-badge rely
// on position:absolute resolving against .jersey-chip's position:relative
// (see the clip-path note below), and this exact area has already had two
// real layout bugs from clip-path/absolute-positioning interactions. Switched
// over after a user screenshot showed the same native-tooltip inconsistency
// already fixed in FixtureGrid.jsx — badges here render as plain, unstyled
// browser tooltips next to every Material-styled Tooltip elsewhere in the
// app, and (as here) the position can end up floating away from the badge
// entirely instead of pointing at it, since the browser — not the page —
// decides where a native tooltip appears. The concern about breaking
// .jersey-chip's position:relative anchoring turned out to be unfounded:
// Tooltip's `className` prop is applied directly to its own single Trigger
// element (see Tooltip.jsx), not to an extra wrapper around the badge, so
// passing the badge's own classes there keeps it a single element in
// exactly the same DOM position as the old title= span — visually verified
// with real screenshots below, not just reasoned about.

// Deterministic team color so every team gets a stable, distinct jersey color
// without maintaining a 20-team lookup table (no team-crest/kit assets in this app).
// Exported so other views (e.g. DreamTeamView's "star of the gameweek" callout)
// can reuse the same color a player's jersey would get here, without a second
// hash function drifting out of sync with this one.
export function teamColor(teamShort) {
  let hash = 0;
  for (let i = 0; i < teamShort.length; i++) {
    hash = (hash * 31 + teamShort.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360}, 55%, 38%)`;
}

// Rank only the players flagged "upgrade" by the squad scan, biggest
// score gap (suggestion − current) first. Everyone else gets no badge.
function priorityRanks(scan) {
  if (!scan) return new Map();
  const upgrades = scan
    .filter((r) => r.verdict === 'upgrade' && r.suggestion)
    .map((r) => ({ id: r.current.id, gap: r.suggestion.score - r.current.score }))
    .sort((a, b) => b.gap - a.gap);
  return new Map(upgrades.map((u, i) => [u.id, i + 1]));
}

// mode 'suggested': swap every "upgrade" starter for its top scan candidate,
// so the pitch matches what the table below is recommending. Bench and
// keep/no-option starters are untouched — the scan only covers the XI.
// Captain/vice-captain badges don't carry over to a swapped-in player (we
// don't know if it'd still be the armband pick), and swapped chips get a
// dashed outline so it reads as "hypothetical", not the real squad.
function applyMode(squad, scan, mode) {
  if (mode !== 'suggested' || !scan) return squad;
  const swapFor = new Map(
    scan.filter((r) => r.verdict === 'upgrade' && r.suggestion).map((r) => [r.current.id, r.suggestion])
  );
  return squad.map((p) => {
    const sub = swapFor.get(p.id);
    if (!sub) return p;
    return {
      id: sub.id,
      name: sub.name,
      teamShort: sub.teamShort,
      positionId: sub.positionId,
      price: sub.price,
      status: sub.status ?? 'a',
      news: sub.news ?? '',
      starting: true,
      slot: p.slot,
      isCaptain: false,
      isViceCaptain: false,
      isSuggested: true,
    };
  });
}

function JerseyChip({ player, priority, t }) {
  return (
    <div className={`jersey-chip${player.isSuggested ? ' suggested' : ''}`}>
      <div className="jersey" style={{ background: teamColor(player.teamShort) }}>
        <span className="jersey-team">{player.teamShort}</span>
      </div>
      {/* Badges are siblings of .jersey, not children — .jersey has a clip-path
          (cuts it into a jersey silhouette), and clip-path clips ALL descendants
          including absolutely-positioned ones, so badges placed inside it never render. */}
      {player.isCaptain && (
        <Tooltip content={t('squad.captain')} className="badge cap jersey-badge">C</Tooltip>
      )}
      {player.isViceCaptain && (
        <Tooltip content={t('squad.viceCaptain')} className="badge vice jersey-badge">VC</Tooltip>
      )}
      {priority && (
        <Tooltip content={t('pitch.priorityTitle', { rank: priority })} className="priority-badge">
          {priority}
        </Tooltip>
      )}
      <div className="jersey-name">
        {player.name}
        {player.status !== 'a' && (
          <Tooltip content={player.news || player.status} className="news">
            {' '}⚑
          </Tooltip>
        )}
      </div>
      <div className="jersey-price">£{player.price.toFixed(1)}m</div>
    </div>
  );
}

/**
 * Visual formation view of a 15-man squad: GK/DEF/MID/FWD rows sized to the
 * team's actual formation, bench below. `scan` (buildSquadScan's `rows`,
 * optional) adds a numbered "priority to transfer" badge on starting players
 * flagged as an upgrade — biggest score gap is #1. `mode="suggested"` swaps
 * every flagged starter for its top candidate instead (see applyMode) —
 * priority badges are hidden in that mode since they'd no longer apply.
 */
export default function PitchView({ squad, scan, mode = 'current' }) {
  const { t } = useLang();
  const effectiveSquad = applyMode(squad, scan, mode);
  const ranks = mode === 'current' ? priorityRanks(scan) : new Map();
  const starting = effectiveSquad.filter((p) => p.starting);
  const bench = [...effectiveSquad.filter((p) => !p.starting)].sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
  const rows = [1, 2, 3, 4]
    .map((posId) => ({ posId, players: starting.filter((p) => p.positionId === posId) }))
    .filter((row) => row.players.length > 0);

  return (
    <div className="pitch-wrap">
      <div className="pitch">
        {rows.map((row) => (
          <div className="pitch-row" key={row.posId}>
            {row.players.map((p) => (
              <JerseyChip key={p.slot} player={p} priority={ranks.get(p.id)} t={t} />
            ))}
          </div>
        ))}
      </div>
      {bench.length > 0 && (
        <div className="bench-row">
          <div className="bench-label">{t('pitch.bench')}</div>
          <div className="bench-players">
            {bench.map((p) => (
              <JerseyChip key={p.slot} player={p} priority={ranks.get(p.id)} t={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
