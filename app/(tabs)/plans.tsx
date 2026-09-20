import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import type { Plan } from '@/lib/plans';
import { fetchMyPlans } from '@/lib/planQueries';
import { colors } from '@/lib/theme';

const STATUS_LABEL: Record<Plan['status'], string> = {
  collecting: 'Collecting availability',
  voting: 'Voting',
  decided: 'Confirmed',
};

export default function Plans() {
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Plans</Text>
        {/* Creating and opening plans lands with the next milestone. */}
        <Pressable style={styles.newButton} disabled>
          <Text style={styles.newButtonText}>New plan</Text>
        </Pressable>
      </View>

      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        refreshing={refreshing}
        onRefresh={load}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No plans yet. Create one and invite your friends.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {item.type} · {STATUS_LABEL[item.status]}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  newButton: { backgroundColor: colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, opacity: 0.5 },
  newButtonText: { color: '#fff', fontWeight: '600' },
  list: { padding: 20, paddingTop: 4, gap: 10 },
  empty: { color: colors.muted, fontSize: 14 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
});
