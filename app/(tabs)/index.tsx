import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { bucketPlans, type Plan } from '@/lib/plans';
import { fetchMyPlans } from '@/lib/planQueries';
import { monthGrid, weekGrid, type Day } from '@/lib/calendar';
import { colors } from '@/lib/theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Home() {
  const { profile } = useAuth();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [anchor, setAnchor] = useState(new Date());

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
  const days = mode === 'month' ? monthGrid(anchor, plans) : weekGrid(anchor, plans);

  function shift(direction: -1 | 1) {
    const next = new Date(anchor);
    if (mode === 'month') next.setMonth(anchor.getMonth() + direction);
    else next.setDate(anchor.getDate() + direction * 7);
    setAnchor(next);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      >
        <Text style={styles.greeting}>Hey {profile?.display_name ?? 'there'}</Text>

        <View style={styles.calendar}>
          <View style={styles.calHeader}>
            <Pressable onPress={() => shift(-1)} hitSlop={10}>
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>
              {anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable onPress={() => shift(1)} hitSlop={10}>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          <View style={styles.toggle}>
            {(['month', 'week'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((d, i) => (
              <Text key={i} style={styles.weekday}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((day) => (
              <DayCell key={day.date} day={day} onPress={() => router.push(`/plan/${day.plans[0].id}`)} />
            ))}
          </View>
        </View>

        <Section title="Voting open" plans={votingOpen} />
        <Section title="Scheduled" plans={scheduled} />
        <Section title="Past" plans={past} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DayCell({ day, onPress }: { day: Day; onPress: () => void }) {
  const busy = day.plans.length > 0;
  return (
    <Pressable style={styles.dayCell} onPress={busy ? onPress : undefined} disabled={!busy}>
      <View style={[styles.dayInner, day.isToday && styles.dayToday, busy && styles.dayBusy]}>
        <Text
          style={[
            styles.dayNum,
            !day.inCurrentPeriod && styles.dayNumMuted,
            (day.isToday || busy) && styles.dayNumStrong,
            busy && styles.dayNumOnAccent,
          ]}
        >
          {Number(day.date.slice(-2))}
        </Text>
      </View>
      {busy && <View style={styles.dot} />}
    </Pressable>
  );
}

function Section({ title, plans }: { title: string; plans: Plan[] }) {
  const router = useRouter();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title} <Text style={styles.count}>{plans.length}</Text>
      </Text>
      {plans.length === 0 ? (
        <Text style={styles.empty}>Nothing here yet.</Text>
      ) : (
        plans.map((p) => (
          <Pressable key={p.id} style={styles.card} onPress={() => router.push(`/plan/${p.id}`)}>
            <Text style={styles.cardTitle}>{p.title}</Text>
            <Text style={styles.cardMeta}>
              {p.type}
              {p.confirmed_start ? ` · ${new Date(p.confirmed_start).toLocaleString()}` : ''}
              {p.confirmed_venue ? ` · ${p.confirmed_venue}` : ''}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  greeting: { fontSize: 26, fontWeight: '800', color: colors.text },
  calendar: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 10 },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navArrow: { fontSize: 26, color: colors.accent, paddingHorizontal: 10, marginTop: -4 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  toggle: { flexDirection: 'row', alignSelf: 'center', backgroundColor: colors.border, borderRadius: 999, padding: 2 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 999 },
  toggleBtnActive: { backgroundColor: colors.bg },
  toggleText: { fontSize: 13, color: colors.muted, textTransform: 'capitalize' },
  toggleTextActive: { color: colors.text, fontWeight: '600' },
  weekRow: { flexDirection: 'row' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  dayInner: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1.5, borderColor: colors.accent },
  dayBusy: { backgroundColor: colors.accent },
  dayNum: { fontSize: 13, color: colors.text },
  dayNumMuted: { color: colors.border },
  dayNumStrong: { fontWeight: '700' },
  dayNumOnAccent: { color: '#fff' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginTop: 2 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  count: { color: colors.muted, fontWeight: '500' },
  empty: { color: colors.muted, fontSize: 14 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
});
