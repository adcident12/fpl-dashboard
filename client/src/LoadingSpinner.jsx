// A minimal ring spinner (Tailwind's own animate-spin, no custom CSS/keyframes
// needed) in the app's accent color — reused everywhere something is loading
// so every wait feels like the same app instead of a different placeholder
// per screen. motion-safe: keeps prefers-reduced-motion users from seeing it
// spin (Spinner alone just sits still for them, which still reads as "busy").
const SIZE = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-9 w-9 border-[3px]',
};

export function Spinner({ size = 'md', className = '' }) {
  // Purely decorative — aria-hidden removes it from the accessibility tree
  // entirely, so no status/live-region role belongs here at all (the actual
  // accessible text is LoadingState's <span>, or a loading button's own label).
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full border-line border-t-accent motion-safe:animate-spin ${SIZE[size]} ${className}`}
    />
  );
}

// Full block used for "nothing to show yet" states — a centered spinner with
// a label underneath, replacing what used to be plain status text (or, in a
// couple of spots, no feedback at all while data was loading).
export default function LoadingState({ label, size = 'lg' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted">
      <Spinner size={size} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
