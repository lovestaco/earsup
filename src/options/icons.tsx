// One stroke family (1.75, round joins) for every UI icon.
import type { ReactNode } from 'react';

const S = ({ children, fill }: { children: ReactNode; fill?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={fill ? 'currentColor' : 'none'}
    stroke={fill ? 'none' : 'currentColor'}
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const I = {
  general: () => (
    <S>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </S>
  ),
  voice: () => (
    <S>
      <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />
    </S>
  ),
  sites: () => (
    <S>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5Z" />
    </S>
  ),
  history: () => (
    <S>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
      <path d="M3.5 4v4.5H8M12 7.5V12l3 2" />
    </S>
  ),
  about: () => (
    <S>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 7.6v.1" />
    </S>
  ),
  chevron: () => (
    <S>
      <path d="m6 9 6 6 6-6" />
    </S>
  ),
  search: () => (
    <S>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </S>
  ),
  play: () => (
    <S fill>
      <path d="M8 5.3v13.4c0 .7.8 1.1 1.4.7l10-6.7a.8.8 0 0 0 0-1.4l-10-6.7C8.8 4.2 8 4.6 8 5.3Z" />
    </S>
  ),
  stop: () => (
    <S fill>
      <rect x="6" y="6" width="12" height="12" rx="2.2" />
    </S>
  ),
  trash: () => (
    <S>
      <path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5h9L17.5 7M9 7V4.5h6V7" />
    </S>
  ),
  external: () => (
    <S>
      <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 14v5.5H4.5V7H10" />
    </S>
  ),
  copy: () => (
    <S>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5v-3a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />
    </S>
  ),
  check: () => (
    <S>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </S>
  ),
  plus: () => (
    <S>
      <path d="M12 5v14M5 12h14" />
    </S>
  ),
  globe: () => (
    <S>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
    </S>
  ),
  cloud: () => (
    <S>
      <path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.6A3.8 3.8 0 0 1 17.5 18.5Z" />
    </S>
  ),
  chip: () => (
    <S>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </S>
  ),
  warn: () => (
    <S>
      <path d="M12 4 2.8 19.5h18.4Z" />
      <path d="M12 10v4.5M12 17v.1" />
    </S>
  ),
  key: () => (
    <S>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7M16.5 6.5l2.5 2.5M14 9l2 2" />
    </S>
  ),
  eye: () => (
    <S>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </S>
  ),
  sun: () => (
    <S>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </S>
  ),
  moon: () => (
    <S>
      <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
    </S>
  ),
  monitor: () => (
    <S>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </S>
  ),
  keyboard: () => (
    <S>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.5 10h.1M10 10h.1M13.5 10h.1M17 10h.1M8 14h8" />
    </S>
  ),
  refresh: () => (
    <S>
      <path d="M20 11.5A8 8 0 0 0 6.2 6.4L4 8.5M4 4v4.5h4.5M4 12.5a8 8 0 0 0 13.8 5.1L20 15.5M20 20v-4.5h-4.5" />
    </S>
  ),
};
