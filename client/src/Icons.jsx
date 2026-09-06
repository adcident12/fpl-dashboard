// Minimal line icons for the mobile bottom tab bar (App.jsx) — 24x24,
// stroke-based, currentColor so active/inactive tab text color drives icon
// color automatically. No icon library dependency for 6 glyphs.
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function PlayersIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

export function FixturesIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

export function SquadIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 4 5 6.5 3.5 9.5 6 11v9.5h12V11l2.5-1.5L19 6.5 15.5 4c0 1.7-1.5 3-3.5 3s-3.5-1.3-3.5-3Z" />
    </svg>
  );
}

export function SuggestionsIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.45 1 1.15 1 1.9v.2h5v-.2c0-.75.4-1.45 1-1.9A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

export function ChipsIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="6" width="13" height="9" rx="1.5" />
      <rect x="7.5" y="9.5" width="13" height="9" rx="1.5" fill="none" />
    </svg>
  );
}

export function RivalryIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4h6l1 5-3 3-4-4V4Z" />
      <path d="M20 4h-6l-1 5 3 3 4-4V4Z" />
      <path d="M11 12v8M8 20h6" />
    </svg>
  );
}

export function BonusIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function SetPiecesIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DreamTeamIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 2.5 5.2 5.7.8-4.1 4 1 5.7L12 16l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3Z" />
    </svg>
  );
}

export function GuideIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.8 9.3a2.2 2.2 0 1 1 3.2 2c-.8.5-1.3.9-1.3 2" />
      <circle cx="12" cy="16.3" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
