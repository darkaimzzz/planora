import { defaultConfig } from '@tamagui/config/v4';
import { createTamagui } from 'tamagui';

/**
 * Planora's theme: the indigo from the logo, on warm off-white.
 *
 * Two settings are relaxed from the v4 defaults on purpose:
 * `onlyAllowShorthands: false` keeps React Native's familiar longhand props
 * (paddingHorizontal, alignItems) working, and `allowedStyleValues: 'loose'`
 * lets brand hex values be passed directly instead of forcing every colour
 * through a token.
 */
export const config = createTamagui({
  ...defaultConfig,
  settings: {
    ...defaultConfig.settings,
    onlyAllowShorthands: false,
    allowedStyleValues: 'somewhat-strict',
  },
  themes: {
    ...defaultConfig.themes,
    light: {
      ...defaultConfig.themes.light,
      background: '#FBFAF8',
      color: '#1B2A5E',
      borderColor: '#E7E5E0',
      placeholderColor: '#767C96',
    },
    dark: {
      ...defaultConfig.themes.dark,
      background: '#12131A',
      color: '#F2F3F8',
      borderColor: '#32364A',
      placeholderColor: '#9AA0B8',
    },
  },
});

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config;
