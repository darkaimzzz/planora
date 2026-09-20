import { useCallback, useState } from 'react';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'tamagui';
import type { Plan } from '@/lib/plans';
import { fetchMyPlans } from '@/lib/planQueries';
import { brand, tint } from '@/lib/theme';
import { Card, FadeIn, Muted, Screen, Tappable, Title } from '@/components/ui';

const STATUS: Record<Plan['status'], { label: string; tint: ReturnType<typeof tint>; wash: ReturnType<typeof tint> }> = {
  collecting: { label: 'Collecting availability', tint: tint('#f59e0b'), wash: tint('#f59e0b1a') },
  voting: { label: 'Voting', tint: brand.primary, wash: brand.primarySoft },
  decided: { label: 'Confirmed', tint: tint('#16a34a'), wash: tint('#16a34a1a') },
};

export default function Plans() {
  const router = useRouter();
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
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View flexDirection="row" alignItems="center" justifyContent="space-between" paddingHorizontal={20} paddingVertical={12}>
          <Title>Plans</Title>
          <Tappable onPress={() => router.push('/new-plan')}>
            <View
              flexDirection="row"
              alignItems="center"
              gap={6}
              backgroundColor={brand.primary}
              paddingHorizontal={14}
              paddingVertical={10}
              borderRadius={999}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text color="#fff" fontWeight="700" fontSize={14}>
                New
              </Text>
            </View>
          </Tappable>
        </View>

        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          refreshing={refreshing}
          onRefresh={load}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}
          ListEmptyComponent={
            <View alignItems="center" paddingVertical={60} gap={8}>
              <Ionicons name="albums-outline" size={44} color={brand.border} />
              <Muted textAlign="center" fontSize={15}>
                No plans yet. Create one and invite your friends.
              </Muted>
            </View>
          }
          renderItem={({ item, index }) => {
            const s = STATUS[item.status];
            return (
              <FadeIn delay={index * 40}>
                <Tappable onPress={() => router.push(`/plan/${item.id}`)}>
                  <Card>
                    <View flexDirection="row" alignItems="center" justifyContent="space-between" gap={10}>
                      <Text fontSize={17} fontWeight="700" color={brand.ink} flex={1}>
                        {item.title}
                      </Text>
                      <View backgroundColor={s.wash} paddingHorizontal={10} paddingVertical={4} borderRadius={999}>
                        <Text fontSize={11} fontWeight="700" color={s.tint}>
                          {s.label}
                        </Text>
                      </View>
                    </View>
                    <Muted textTransform="capitalize">
                      {item.type}
                      {item.location_name ? ` · ${item.location_name}` : ''}
                    </Muted>
                  </Card>
                </Tappable>
              </FadeIn>
            );
          }}
        />
      </SafeAreaView>
    </Screen>
  );
}
