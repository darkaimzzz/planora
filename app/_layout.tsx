import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/lib/auth';
import { pendingInvite } from '@/lib/pendingInvite';
import { colors } from '@/lib/theme';

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

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AuthGate />
    </AuthProvider>
  );
}
