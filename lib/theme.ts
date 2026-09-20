import type { ColorTokens } from 'tamagui';

// Planora's look: Apple's restraint in layout and type, Duolingo's energy in
// colour and touch. Three base colours carry everything, each with a job:
//
//   indigo  — the brand, and every primary action
//   grass   — progress, and anything settled or confirmed
//   sunbeam — attention: what's waiting on you, counts, highlights
//
// Each has a `deep` shade, used as the pressed-down edge of a button, and a
// `wash` for tinted backgrounds. Nothing else gets to introduce a hue.
//
// Tamagui types colour props as tokens; these are real hex values, so they are
// cast once here rather than at every call site.
const c = (hex: string) => hex as unknown as ColorTokens;

/** Same cast, for one-off colours a screen needs (a stored avatar hex). */
export const tint = c;

export const INDIGO = { base: '#5B5BD6', deep: '#4342AD', wash: '#ECECFB' };
export const GRASS = { base: '#3DC05F', deep: '#2E9349', wash: '#E6F7EB' };
export const SUNBEAM = { base: '#FFB020', deep: '#D78A08', wash: '#FFF4DF' };

export const brand = {
  // surfaces
  bg: c('#FBFAF8'),
  surface: c('#FFFFFF'),
  sunken: c('#F2F1EE'),
  border: c('#E7E5E0'),
  // ink
  ink: c('#1B2A5E'),
  inkSoft: c('#767C96'),
  // the three
  primary: c(INDIGO.base),
  primaryDeep: c(INDIGO.deep),
  primaryWash: c(INDIGO.wash),
  success: c(GRASS.base),
  successDeep: c(GRASS.deep),
  successWash: c(GRASS.wash),
  accent: c(SUNBEAM.base),
  accentDeep: c(SUNBEAM.deep),
  accentWash: c(SUNBEAM.wash),

  danger: c('#E4574C'),
  dangerDeep: c('#B93E35'),
};

/**
 * Apple's type scale, trimmed to what this app uses. Sizes are the HIG
 * defaults; the heavier weights are where Duolingo's voice comes in.
 */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4 },
  headline: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 17, fontWeight: '500' as const },
  callout: { fontSize: 15, fontWeight: '500' as const },
  footnote: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.3 },
};

/** How far a Duolingo-style button sits above its own shadow edge. */
export const PRESS_DEPTH = 4;

export const radius = { sm: 12, md: 16, lg: 20, xl: 28, pill: 999 };

export const AVATAR_COLORS = [
  '#FF6B6B', '#FF9F43', '#FFC800', '#3DC05F',
  '#1CB0F6', '#5B5BD6', '#A855F7', '#EC4899',
] as const;

export function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

/** Kept for the few screens still on StyleSheet. */
export const colors = {
  bg: brand.bg,
  surface: brand.sunken,
  border: brand.border,
  text: brand.ink,
  muted: brand.inkSoft,
  accent: brand.primary,
  danger: brand.danger,
};
