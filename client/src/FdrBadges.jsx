import { useLang } from './i18n.jsx';
import Tooltip from './Tooltip.jsx';

// FPL fixture difficulty is a 1-5 scale (1=easiest, 5=hardest).
// Bucket into 3 for display: 1-2 easy, 3 medium, 4-5 hard.
export function fdrBucket(d) {
  if (d <= 2) return 'easy';
  if (d === 3) return 'med';
  return 'hard';
}

const FDR_LABEL_KEY = { easy: 'fdr.easy', med: 'fdr.med', hard: 'fdr.hard' };

// Kickoff times come from the API as ISO 8601 UTC (or null when FPL hasn't
// confirmed one yet); toLocaleString() with no locale/timeZone argument
// converts to the viewer's own browser locale/timezone, matching how the
// app already formats every other date (App.jsx's deadline/freshness
// tooltips) — so "when do I watch this" is answered in local time, not UTC.
// Exported so FixtureGrid.jsx's own tooltip (the one place fixtures render
// outside this shared component) can show the exact same wording.
export function formatKickoff(iso, t) {
  if (!iso) return t('fdr.kickoffTbc');
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// A terser variant for FixtureGrid.jsx's own cell face (not just its
// tooltip) — the grid's own gameweek columns already narrow things down to
// a specific week, so weekday+time (no month/day) is enough to answer
// "which day, what time" without crowding an already-small cell.
export function formatKickoffShort(iso, t) {
  if (!iso) return t('fdr.kickoffTbc');
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

// Shared by the Players table, My Squad, and Suggestions (transfer/captain
// candidates + quick squad scan) — one fixture-difficulty badge row per player.
export default function FdrBadges({ fixtures }) {
  const { t } = useLang();
  if (!fixtures || fixtures.length === 0) return <span className="muted">{t('fdr.none')}</span>;
  return (
    <span className="inline-flex gap-1">
      {fixtures.map((f) => {
        const bucket = fdrBucket(f.difficulty);
        const title = t('fdr.tooltip', {
          event: f.event,
          opponent: f.opponentName,
          side: f.home ? t('fdr.home') : t('fdr.away'),
          kickoff: formatKickoff(f.kickoffTime, t),
          fdr: f.difficulty,
          label: t(FDR_LABEL_KEY[bucket]),
        });
        return (
          // event alone isn't a unique key here: a Double Gameweek's two legs
          // share the same event id (captain suggestions now pass the target
          // gameweek's actual fixtures, which can be 2 for a DGW) — pair it
          // with opponentId, which always differs between the two legs.
          <Tooltip key={`${f.event}-${f.opponentId}`} content={title}>
            <span className={`fdr-badge fdr-${bucket}`}>{f.opponentShort}</span>
          </Tooltip>
        );
      })}
    </span>
  );
}
