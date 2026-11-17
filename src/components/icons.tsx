// Small stroke icons, drawn inline so the app needs no icon font or network.
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, "aria-hidden": true } as const;

export const FolderIcon = () => (
  <svg {...base}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);
export const MoonIcon = () => (
  <svg {...base}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
  </svg>
);
export const SunIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...base} strokeWidth={1.8}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const InfoIcon = () => (
  <svg {...base} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01M11 12h1v4h1" />
  </svg>
);
export const ArrowLeft = () => (
  <svg {...base}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const PenIcon = () => (
  <svg {...base}>
    <path d="M4 20l4-1 10-10-3-3L5 16l-1 4Z" />
    <path d="M14 6l3 3" />
  </svg>
);
export const LockIcon = () => (
  <svg {...base}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const ArrowRight = () => (
  <svg {...base}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
