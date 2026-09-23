import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'tamagui';
import { useAppearance } from '@/lib/appearance';
import { useAuth } from '@/lib/auth';
import { bucketPlans, formatSlot, type Plan } from '@/lib/plans';
import { fetchMyPlans } from '@/lib/planQueries';
import { monthGrid, weekGrid, type Day } from '@/lib/calendar';
import { checkForUpdate, type AvailableUpdate } from '@/lib/updates';
import { brand, radius } from '@/lib/theme';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  FadeIn,
  Heading,
  LargeTitle,
  Muted,
  PushButton,
  Screen,
  SectionLabel,
  Tappable,
} from '@/components/ui';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Home() {
  const { profile } = useAuth();
  const { scheme, setChoice } = useAppearance();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  // Once per launch. Never blocks anything; failure is silence.
  useEffect(() => {
    checkForUpdate(Constants.expoConfig?.version).then(setUpdate);
  }, []);

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

  const nothingYet = plans.length === 0;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        >
          <FadeIn>
            <View flexDirection="row" alignItems="center" justifyContent="space-between">
              <View flex={1}>
                <Muted>Welcome back</Muted>
                <LargeTitle>{profile?.display_name ?? 'there'}</LargeTitle>
              </View>

              {/* The full System/Light/Dark control lives in Profile; this is
                  the one-tap version, where people actually look for it. */}
              <View flexDirection="row" alignItems="center" gap={10}>
                <Tappable
                  onPress={() => setChoice(scheme === 'dark' ? 'light' : 'dark')}
                  accessibilityLabel={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  <View
                    width={40}
                    height={40}
                    borderRadius={20}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={brand.sunken}
                    borderWidth={1}
                    borderColor={brand.border}
                  >
                    <Ionicons
                      name={scheme === 'dark' ? 'sunny' : 'moon'}
                      size={18}
                      color={String(brand.inkSoft)}
                    />
                  </View>
                </Tappable>
                <Avatar name={profile?.display_name ?? '?'} color={profile?.avatar_color} size={52} />
              </View>
            </View>
          </FadeIn>

          {/* No app store means nothing tells you a new version exists. */}
          {update && (
            <FadeIn delay={30}>
              <Tappable onPress={() => Linking.openURL(update.url)}>
                <Card
                  padding={14}
                  gap={2}
                  backgroundColor={brand.accentWash}
                  borderColor={brand.accent}
                >
                  <View flexDirection="row" alignItems="center" gap={10}>
                    <Ionicons name="arrow-down-circle" size={20} color={String(brand.accentDeep)} />
                    <View flex={1}>
                      <Text fontWeight="800" color={brand.ink}>
                        Version {update.version} is out
                      </Text>
                      <Muted fontSize={13}>Tap to download it from planora</Muted>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={String(brand.inkSoft)} />
                  </View>
                </Card>
              </Tappable>
            </FadeIn>
          )}

          {/* Three stat tiles, one per base colour, the app's pulse at a glance. */}
          <FadeIn delay={50}>
            <View flexDirection="row" gap={10}>
              <Stat value={votingOpen.length} label="Deciding" tone="accent" emoji="🗳️" />
              <Stat value={scheduled.length} label="Locked in" tone="success" emoji="🎉" />
              <Stat value={past.length} label="Done" tone="primary" emoji="📼" />
            </View>
          </FadeIn>

          <FadeIn delay={100}>
            <Card padding={14} gap={12}>
              <View flexDirection="row" alignItems="center" justifyContent="space-between">
                <Tappable onPress={() => shift(-1)}>
                  <View padding={4}>
                    <Ionicons name="chevron-back" size={22} color={String(brand.primary)} />
                  </View>
                </Tappable>
                <Heading>{anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Heading>
                <Tappable onPress={() => shift(1)}>
                  <View padding={4}>
                    <Ionicons name="chevron-forward" size={22} color={String(brand.primary)} />
                  </View>
                </Tappable>
              </View>

              <View
                flexDirection="row"
                alignSelf="center"
                backgroundColor={brand.sunken}
                borderRadius={radius.pill}
                padding={3}
              >
                {(['month', 'week'] as const).map((m) => (
                  <Tappable key={m} onPress={() => setMode(m)}>
                    <View
                      paddingHorizontal={20}
                      paddingVertical={7}
                      borderRadius={radius.pill}
                      backgroundColor={mode === m ? brand.surface : 'transparent'}
                    >
                      <Text
                        fontSize={13}
                        textTransform="capitalize"
                        fontWeight="800"
                        color={mode === m ? brand.ink : brand.inkSoft}
                      >
                        {m}
                      </Text>
                    </View>
                  </Tappable>
                ))}
              </View>

              <View flexDirection="row">
                {WEEKDAYS.map((d, i) => (
                  <Text
                    key={i}
                    width={`${100 / 7}%`}
                    textAlign="center"
                    fontSize={11}
                    fontWeight="800"
                    color={brand.inkSoft}
                  >
                    {d}
                  </Text>
                ))}
              </View>

              <View flexDirection="row" flexWrap="wrap">
                {days.map((day) => (
                  <DayCell key={day.date} day={day} onPress={() => router.push(`/plan/${day.plans[0].id}`)} />
                ))}
              </View>
            </Card>
          </FadeIn>

          {nothingYet ? (
            <FadeIn delay={150}>
              <EmptyState
                emoji="🌱"
                title="No plans yet"
                body="Start one, invite your friends, and let the group decide the rest."
                action={
                  <View marginTop={8}>
                    <PushButton label="Create a plan" full={false} onPress={() => router.push('/new-plan')} />
                  </View>
                }
              />
            </FadeIn>
          ) : (
            <>
              <Section title="Deciding" plans={votingOpen} delay={150} tone="accent" />
              <Section title="Locked in" plans={scheduled} delay={190} tone="success" />
              <Section title="Done" plans={past} delay={230} tone="primary" />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

function Stat({
  value,
  label,
  tone,
  emoji,
}: {
  value: number;
  label: string;
  tone: 'primary' | 'success' | 'accent';
  emoji: string;
}) {
  const wash =
    tone === 'success' ? brand.successWash : tone === 'accent' ? brand.accentWash : brand.primaryWash;
  const ink = tone === 'success' ? brand.successDeep : tone === 'accent' ? brand.accentDeep : brand.primary;
  return (
    <View flex={1} backgroundColor={wash} borderRadius={radius.lg} padding={14} gap={2}>
      <Text fontSize={18}>{emoji}</Text>
      <Text fontSize={26} fontWeight="800" color={ink}>
        {value}
      </Text>
      <Text fontSize={12} fontWeight="700" color={ink} opacity={0.8}>
        {label}
      </Text>
    </View>
  );
}

function DayCell({ day, onPress }: { day: Day; onPress: () => void }) {
  const busy = day.plans.length > 0;
  return (
    <View width={`${100 / 7}%`} alignItems="center" paddingVertical={3}>
      <Tappable onPress={busy ? onPress : undefined} disabled={!busy}>
        <View
          width={34}
          height={34}
          borderRadius={17}
          alignItems="center"
          justifyContent="center"
          backgroundColor={busy ? brand.success : 'transparent'}
          borderWidth={day.isToday && !busy ? 2 : 0}
          borderColor={brand.primary}
        >
          <Text
            fontSize={13}
            fontWeight={day.isToday || busy ? '800' : '600'}
            color={busy ? '#FFFFFF' : day.inCurrentPeriod ? brand.ink : brand.border}
          >
            {Number(day.date.slice(-2))}
          </Text>
        </View>
      </Tappable>
    </View>
  );
}

function Section({
  title,
  plans,
  delay,
  tone,
}: {
  title: string;
  plans: Plan[];
  delay: number;
  tone: 'primary' | 'success' | 'accent';
}) {
  const router = useRouter();
  if (plans.length === 0) return null;

  return (
    <FadeIn delay={delay}>
      <View gap={10}>
        <SectionLabel>{title}</SectionLabel>
        {plans.map((p) => (
          <Tappable key={p.id} onPress={() => router.push(`/plan/${p.id}`)}>
            <Card flexDirection="row" alignItems="center" gap={12}>
              <View flex={1} gap={3}>
                <Text fontSize={17} fontWeight="800" color={brand.ink}>
                  {p.title}
                </Text>
                <Muted textTransform="capitalize">
                  {p.type}
                  {p.confirmed_start ? ` · ${formatSlot(p.confirmed_start)}` : ''}
                  {p.location_name ? ` · ${p.location_name}` : ''}
                </Muted>
              </View>
              {p.status === 'decided' && <Badge label="Set" tone="success" />}
              <Ionicons name="chevron-forward" size={18} color={String(brand.inkSoft)} />
            </Card>
          </Tappable>
        ))}
      </View>
    </FadeIn>
  );
}
