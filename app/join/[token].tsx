import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { joinPlanByToken, previewPlan } from '@/lib/planQueries';
import { pendingInvite } from '@/lib/pendingInvite';
import { colors } from '@/lib/theme';

type Preview = { id: string; title: string; type: string; attendee_count: number };

/**
 * Invite landing screen (PRD §7.2). Signed in: join and drop straight into the
 * plan. Signed out: park the token, send them through sign-up, and the root
 * layout bounces them back here once they have a session.
 */
export default function JoinPlan() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    previewPlan(token)
      .then((p) => {
        if (!p) setError('That invite link is no longer valid.');
        else setPreview(p);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  // Signed out: remember the token, then hand off to sign-in.
  useEffect(() => {
    if (loading || session || !token) return;
    pendingInvite.set(token).then(() => router.replace('/sign-in'));
  }, [loading, session, token, router]);

  // Signed in and onboarded: join without making them tap anything.
  useEffect(() => {
    if (loading || !session || !profile?.onboarded || !token || joining || error) return;
    setJoining(true);
    joinPlanByToken(token)
      .then(async (planId) => {
        await pendingInvite.clear();
        router.replace(`/plan/${planId}`);
      })
      .catch((e) => {
        setError(e.message);
        setJoining(false);
      });
  }, [loading, session, profile?.onboarded, token, joining, error, router]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Can't open this invite</Text>
        <Text style={styles.sub}>{error}</Text>
        <Pressable style={styles.primary} onPress={() => router.replace('/')}>
          <Text style={styles.primaryText}>Go to my plans</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.title}>{preview ? preview.title : 'Opening invite…'}</Text>
      {preview && (
        <Text style={styles.sub}>
          {preview.type} · {preview.attendee_count} going
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
