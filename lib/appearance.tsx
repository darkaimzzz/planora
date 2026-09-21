import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkPalette, lightPalette, setPalette } from './theme';

export type AppearanceChoice = 'system' | 'light' | 'dark';

const KEY = 'planora.appearance';

type AppearanceState = {
  /** What the user picked. */
  choice: AppearanceChoice;
  /** What that resolves to right now. */
  scheme: 'light' | 'dark';
  setChoice: (next: AppearanceChoice) => void;
};

const AppearanceContext = createContext<AppearanceState | null>(null);

/**
 * Owns the light/dark decision and keeps `brand` pointing at the right palette.
 *
 * This provider sits at the root, so when the choice changes the whole tree
 * re-renders and every `brand.x` read picks up the new value — no subscription
 * needed, and nothing else may mutate the palette.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [choice, setChoiceState] = useState<AppearanceChoice>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setChoiceState(saved);
      })
      .catch(() => {
        // A missing preference isn't worth surfacing; system is a fine default.
      });
  }, []);

  const scheme: 'light' | 'dark' =
    choice === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : choice;

  // Swapped during render, not in an effect, so the first paint after a change
  // already uses the new colours rather than flashing the old ones. It is a
  // plain object mutation — no state update, so it cannot loop.
  setPalette(scheme === 'dark' ? darkPalette : lightPalette);

  const value = useMemo<AppearanceState>(
    () => ({
      choice,
      scheme,
      setChoice: (next) => {
        setChoiceState(next);
        AsyncStorage.setItem(KEY, next).catch(() => {});
      },
    }),
    [choice, scheme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used inside <AppearanceProvider>');
  return ctx;
}
