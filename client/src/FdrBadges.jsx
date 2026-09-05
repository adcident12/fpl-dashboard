import { useLang } from './i18n.jsx';

// FPL fixture difficulty is a 1-5 scale (1=easiest, 5=hardest).
// Bucket into 3 for display: 1-2 easy, 3 medium, 4-5 hard.
export function fdrBucket(d) {
  if (d <= 2) return 'easy';
  if (d === 3) return 'med';
  return 'hard';
}

const FDR_LABEL_KEY = { easy: 'fdr.easy', med: 'fdr.med', hard: 'fdr.hard' };

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
          fdr: f.difficulty,
          label: t(FDR_LABEL_KEY[bucket]),
        });
        return (
          <span key={f.event} className={`fdr-badge fdr-${bucket}`} title={title}>
            {f.opponentShort}
          </span>
        );
      })}
    </span>
  );
}
