import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { bucketPlans, type Plan } from '@/lib/plans';
import { fetchMyPlans } from '@/lib/planQueries';
import { colors } from '@/lib/theme';

export default function Home() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setPlans(await fetchMyPlans());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const { votingOpen, scheduled, past } = bucketPlans(plans);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <Text style={styles.greeting}>Hey {profile?.display_name ?? 'there'}</Text>

        {/* The month/week calendar lands with the confirmed-plan milestone; until
            plans have confirmed times there is nothing to draw on it. */}
        <View style={styles.calendarStub}>
          <Text style={styles.calendarStubText}>
            Your calendar fills in as plans get confirmed.
          </Text>
        </View>

        <Section title="Voting open" plans={votingOpen} />
        <Section title="Scheduled" plans={scheduled} />
        <Section title="Past" plans={past} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, plans }: { title: string; plans: Plan[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title} <Text style={styles.count}>{plans.length}</Text>
      </Text>
      {plans.length === 0 ? (
        <Text style={styles.empty}>Nothing here yet.</Text>
      ) : (
        plans.map((p) => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.cardTitle}>{p.title}</Text>
            <Text style={styles.cardMeta}>
              {p.type}
              {p.confirmed_start ? ` · ${new Date(p.confirmed_start).toLocaleString()}` : ''}
              {p.confirmed_venue ? ` · ${p.confirmed_venue}` : ''}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text },
  calendarStub: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  calendarStubText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  count: { color: colors.muted, fontWeight: '500' },
  empty: { color: colors.muted, fontSize: 14 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
});
