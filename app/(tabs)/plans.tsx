import { useCallback, useState } from 'react';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'tamagui';
import { formatSlot, type Plan } from '@/lib/plans';
import { fetchMyPlans } from '@/lib/planQueries';
import { brand, radius } from '@/lib/theme';
import {
  Badge,
  Card,
  EmptyState,
  FadeIn,
  LargeTitle,
  Muted,
  PushButton,
  Screen,
  Tappable,
  type Tone,
} from '@/components/ui';

const STATUS: Record<Plan['status'], { label: string; tone: Tone; emoji: string }> = {
  collecting: { label: 'Free times', tone: 'accent', emoji: '🗓️' },
  voting: { label: 'Voting', tone: 'primary', emoji: '🗳️' },
  decided: { label: 'Locked in', tone: 'success', emoji: '🎉' },
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
        <View
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal={20}
          paddingVertical={12}
        >
          <LargeTitle>Plans</LargeTitle>
          <PushButton
            label="New"
            size="sm"
            full={false}
            onPress={() => router.push('/new-plan')}
            icon={<Ionicons name="add" size={18} color="#fff" />}
          />
        </View>

        <FlatList
          data={plans}
          keyExtractor={(p) => p.id}
          refreshing={refreshing}
          onRefresh={load}
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}
          ListEmptyComponent={
            <EmptyState
              emoji="🌱"
              title="Nothing planned"
              body="Create a plan and share the link — everyone votes, nobody argues."
              action={
                <View marginTop={8}>
                  <PushButton label="Create a plan" full={false} onPress={() => router.push('/new-plan')} />
                </View>
              }
            />
          }
          renderItem={({ item, index }) => {
            const s = STATUS[item.status];
            return (
              <FadeIn delay={index * 45}>
                <Tappable onPress={() => router.push(`/plan/${item.id}`)}>
                  <Card gap={12}>
                    <View flexDirection="row" alignItems="center" gap={12}>
                      <View
                        width={46}
                        height={46}
                        borderRadius={radius.sm}
                        backgroundColor={brand.sunken}
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Text fontSize={22}>{s.emoji}</Text>
                      </View>
                      <View flex={1} gap={2}>
                        <Text fontSize={17} fontWeight="800" color={brand.ink}>
                          {item.title}
                        </Text>
                        <Muted textTransform="capitalize">
                          {item.type}
                          {item.confirmed_start ? ` · ${formatSlot(item.confirmed_start)}` : ''}
                        </Muted>
                      </View>
                      <Badge label={s.label} tone={s.tone} />
                    </View>
                    {item.location_name && (
                      <View flexDirection="row" alignItems="center" gap={6}>
                        <Ionicons name="location" size={14} color={String(brand.inkSoft)} />
                        <Muted>{item.location_name}</Muted>
                      </View>
                    )}
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
