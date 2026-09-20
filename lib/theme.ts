import type { ColorTokens } from 'tamagui';

// Planora brand, taken from the logo: indigo mark, navy wordmark, warm off-white.
//
// Tamagui types colour props as tokens. These are real hex values, not tokens,
// so they are cast once here rather than at every call site.
const c = (hex: string) => hex as unknown as ColorTokens;

/** Same cast, for one-off colours a screen needs (status tints, washes). */
export const tint = c;
export const brand = {
  bg: c('#fbfaf8'),
  surface: c('#ffffff'),
  sunken: c('#f3f2ee'),
  border: c('#e6e4df'),
  ink: c('#1b2a5e'),
  inkSoft: c('#6b7291'),
  primary: c('#4f52d1'),
  primarySoft: c('#ececfb'),
  danger: c('#d64545'),
  gradient: ['#4f52d1', '#7b5ce0'] as const,
};

/** Kept for screens still on StyleSheet. */
export const colors = {
  bg: brand.bg,
  surface: brand.sunken,
  border: brand.border,
  text: brand.ink,
  muted: brand.inkSoft,
  accent: brand.primary,
  danger: brand.danger,
};

export const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
] as const;

export function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}
