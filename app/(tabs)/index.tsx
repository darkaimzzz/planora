import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { bucketPlans, formatSlot, type Plan } from '@/lib/plans';
import { fetchMyPlans } from '@/lib/planQueries';
import { monthGrid, weekGrid, type Day } from '@/lib/calendar';
import { brand } from '@/lib/theme';
import { Avatar, Card, FadeIn, Heading, Muted, Screen, Tappable, Title } from '@/components/ui';

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
    <Screen>
      <LinearGradient
        colors={['#ececfb', brand.bg]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        >
          <FadeIn>
            <View flexDirection="row" alignItems="center" justifyContent="space-between">
              <View>
                <Muted>Welcome back</Muted>
                <Title>{profile?.display_name ?? 'there'}</Title>
              </View>
              <Avatar name={profile?.display_name ?? '?'} color={profile?.avatar_color} size={46} />
            </View>
          </FadeIn>

          <FadeIn delay={60}>
            <Card padding={14}>
              <View flexDirection="row" alignItems="center" justifyContent="space-between">
                <Tappable onPress={() => shift(-1)}>
                  <Ionicons name="chevron-back" size={22} color={brand.primary} />
                </Tappable>
                <Heading>
                  {anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Heading>
                <Tappable onPress={() => shift(1)}>
                  <Ionicons name="chevron-forward" size={22} color={brand.primary} />
                </Tappable>
              </View>

              <View flexDirection="row" alignSelf="center" backgroundColor={brand.sunken} borderRadius={999} padding={3}>
                {(['month', 'week'] as const).map((m) => (
                  <Tappable key={m} onPress={() => setMode(m)}>
                    <View
                      paddingHorizontal={18}
                      paddingVertical={6}
                      borderRadius={999}
                      backgroundColor={mode === m ? brand.surface : 'transparent'}
                    >
                      <Text
                        fontSize={13}
                        textTransform="capitalize"
                        fontWeight={mode === m ? '700' : '500'}
                        color={mode === m ? brand.ink : brand.inkSoft}
                      >
                        {m}
                      </Text>
                    </View>
                  </Tappable>
                ))}
              </View>

              <View flexDirection="row" marginTop={4}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={i} width={`${100 / 7}%`} textAlign="center" fontSize={11} color={brand.inkSoft}>
                    {d}
                  </Text>
                ))}
              </View>

              <View flexDirection="row" flexWrap="wrap">
                {days.map((day) => (
                  <DayCell
                    key={day.date}
                    day={day}
                    onPress={() => router.push(`/plan/${day.plans[0].id}`)}
                  />
                ))}
              </View>
            </Card>
          </FadeIn>

          <Section title="Voting open" plans={votingOpen} delay={120} />
          <Section title="Scheduled" plans={scheduled} delay={160} />
          <Section title="Past" plans={past} delay={200} />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function DayCell({ day, onPress }: { day: Day; onPress: () => void }) {
  const busy = day.plans.length > 0;
  return (
    <View width={`${100 / 7}%`} alignItems="center" paddingVertical={3}>
      <Tappable onPress={busy ? onPress : undefined} disabled={!busy}>
        <View
          width={32}
          height={32}
          borderRadius={16}
          alignItems="center"
          justifyContent="center"
          backgroundColor={busy ? brand.primary : 'transparent'}
          borderWidth={day.isToday && !busy ? 1.5 : 0}
          borderColor={brand.primary}
        >
          <Text
            fontSize={13}
            fontWeight={day.isToday || busy ? '700' : '500'}
            color={busy ? '#fff' : day.inCurrentPeriod ? brand.ink : brand.border}
          >
            {Number(day.date.slice(-2))}
          </Text>
        </View>
      </Tappable>
    </View>
  );
}

function Section({ title, plans, delay }: { title: string; plans: Plan[]; delay: number }) {
  const router = useRouter();
  return (
    <FadeIn delay={delay}>
      <View gap={10}>
        <View flexDirection="row" alignItems="center" gap={8}>
          <Heading>{title}</Heading>
          <View backgroundColor={brand.primarySoft} paddingHorizontal={8} paddingVertical={2} borderRadius={999}>
            <Text fontSize={12} fontWeight="700" color={brand.primary}>
              {plans.length}
            </Text>
          </View>
        </View>

        {plans.length === 0 ? (
          <Muted>Nothing here yet.</Muted>
        ) : (
          plans.map((p) => (
            <Tappable key={p.id} onPress={() => router.push(`/plan/${p.id}`)}>
              <Card>
                <Text fontSize={16} fontWeight="700" color={brand.ink}>
                  {p.title}
                </Text>
                <Muted textTransform="capitalize">
                  {p.type}
                  {p.confirmed_start
                    ? ` · ${formatSlot(p.confirmed_start)}`
                    : ''}
                  {p.location_name ? ` · ${p.location_name}` : ''}
                </Muted>
              </Card>
            </Tappable>
          ))
        )}
      </View>
    </FadeIn>
  );
}
