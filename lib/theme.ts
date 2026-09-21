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

export type Palette = {
  /** Lets a component pick a shade that reads well on the current ground. */
  isDark: boolean;
  bg: ColorTokens;
  surface: ColorTokens;
  sunken: ColorTokens;
  border: ColorTokens;
  ink: ColorTokens;
  inkSoft: ColorTokens;
  primary: ColorTokens;
  primaryDeep: ColorTokens;
  primaryWash: ColorTokens;
  success: ColorTokens;
  successDeep: ColorTokens;
  successWash: ColorTokens;
  accent: ColorTokens;
  accentDeep: ColorTokens;
  accentWash: ColorTokens;
  danger: ColorTokens;
  dangerDeep: ColorTokens;
};

export const lightPalette: Palette = {
  isDark: false,
  bg: c('#FBFAF8'),
  surface: c('#FFFFFF'),
  sunken: c('#F2F1EE'),
  border: c('#E7E5E0'),
  ink: c('#1B2A5E'),
  inkSoft: c('#767C96'),
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
 * Dark is not the light palette inverted. Surfaces lift as they come forward
 * (bg darkest, cards lighter) the way iOS elevates in the dark, the three hues
 * are brightened so they keep their punch against a dark ground, and the
 * "wash" tints become low-opacity versions of their hue rather than pale
 * pastels, which would glow.
 */
export const darkPalette: Palette = {
  isDark: true,
  bg: c('#12131A'),
  surface: c('#1C1E27'),
  sunken: c('#262935'),
  border: c('#32364A'),
  ink: c('#F2F3F8'),
  inkSoft: c('#9AA0B8'),
  primary: c('#8B8BF0'),
  primaryDeep: c('#5B5BD6'),
  primaryWash: c('#262a4d'),
  success: c('#4FD97A'),
  successDeep: c('#2E9349'),
  successWash: c('#1B3527'),
  accent: c('#FFC24D'),
  accentDeep: c('#D78A08'),
  accentWash: c('#3A2E12'),
  danger: c('#FF7A6E'),
  dangerDeep: c('#B93E35'),
};

/**
 * The live palette.
 *
 * It is a mutable object rather than a value returned from a hook, because
 * ~200 call sites across twenty files read `brand.primary` directly. Swapping
 * the contents in place means the theme can change without rewriting all of
 * them. AppearanceProvider sits at the root, so swapping it re-renders the
 * whole tree with the new values. The rule this relies on: never destructure
 * or capture `brand.x` at module scope — read it during render. That is why
 * there are no `StyleSheet.create` colour values and no `styled()` defaults
 * left in the app.
 */
export const brand: Palette = { ...lightPalette };

/** Swap the live palette in place. Only AppearanceProvider should call this. */
export function setPalette(next: Palette) {
  Object.assign(brand, next);
}

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

