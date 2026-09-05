// Inline copy of public/favicon.svg's mini-pitch icon (halfway line + center
// circle, same colors as the app theme). Duplicated here rather than
// referenced by path because favicon.svg is a static asset the browser tab
// loads independently of the app's base path — if the design changes, update
// both this file and public/favicon.svg together.
export default function Logo({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0f1420" />
      <rect x="4" y="4" width="24" height="24" rx="3" fill="#2e7d32" />
      <rect x="4" y="4" width="24" height="24" rx="3" fill="none" stroke="#e8ecf4" strokeWidth="1.6" />
      <line x1="4" y1="16" x2="28" y2="16" stroke="#e8ecf4" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="4.2" fill="none" stroke="#e8ecf4" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="1.4" fill="#4f8cff" />
    </svg>
  );
}
