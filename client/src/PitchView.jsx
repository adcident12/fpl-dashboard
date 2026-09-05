import { useLang } from './i18n.jsx';

// Deterministic team color so every team gets a stable, distinct jersey color
// without maintaining a 20-team lookup table (no team-crest/kit assets in this app).
function teamColor(teamShort) {
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
        <span className="badge cap jersey-badge" title={t('squad.captain')}>C</span>
      )}
      {player.isViceCaptain && (
        <span className="badge vice jersey-badge" title={t('squad.viceCaptain')}>VC</span>
      )}
      {priority && (
        <span className="priority-badge" title={t('pitch.priorityTitle', { rank: priority })}>
          {priority}
        </span>
      )}
      <div className="jersey-name">
        {player.name}
        {player.status !== 'a' && <span className="news" title={player.news || player.status}> ⚑</span>}
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
    .map((posId) => starting.filter((p) => p.positionId === posId))
    .filter((row) => row.length > 0);

  return (
    <div className="pitch-wrap">
      <div className="pitch">
        {rows.map((row, i) => (
          <div className="pitch-row" key={i}>
            {row.map((p) => (
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
