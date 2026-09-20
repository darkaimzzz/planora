import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider } from 'tamagui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { pendingInvite } from '@/lib/pendingInvite';
import { Loader } from '@/components/ui';
import { brand } from '@/lib/theme';
import config from '@/tamagui.config';

/**
 * Sends the user wherever their auth state says they belong:
 * signed out -> /sign-in, signed in but unonboarded -> /onboarding, else the tabs.
 * Invite links (/join/[token]) are left alone; that screen handles its own
 * sign-in detour so the token survives the round trip.
 */
function AuthGate() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const top = segments[0];
    if (top === 'join') return;

    if (!session) {
      if (top !== 'sign-in') router.replace('/sign-in');
    } else if (profile && !profile.onboarded) {
      if (top !== 'onboarding') router.replace('/onboarding');
    } else if (top === 'sign-in' || top === 'onboarding') {
      // A token parked before sign-up means they arrived from an invite link:
      // finish that journey instead of dumping them on Home.
      pendingInvite.get().then((token) => router.replace(token ? `/join/${token}` : '/'));
    }
  }, [loading, session, profile, segments, router]);

  if (loading) return <Loader />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: brand.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="new-plan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <AuthProvider>
        <StatusBar style="dark" />
        <AuthGate />
      </AuthProvider>
    </TamaguiProvider>
  );
}
