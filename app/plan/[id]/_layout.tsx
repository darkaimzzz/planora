import { Stack } from 'expo-router';
import { brand } from '@/lib/theme';

/**
 * A plain stack. The plan's sections used to be a nested Tabs navigator, but
 * nested tabs inside a dynamic route broke navigation on web, pressing a tab
 * often changed nothing. The sections are now a segmented control on one
 * screen, so there is only ever one navigator in play.
 */
export default function PlanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: brand.bg },
      }}
    />
  );
}
