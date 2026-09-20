import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Text, View } from 'tamagui';
import { formatSlot } from '@/lib/plans';
import { deriveRoadmap } from '@/lib/roadmap';
import { usePlanData } from '@/lib/usePlanData';
import { brand } from '@/lib/theme';
import { Badge, Card, ErrorState, FadeIn, Heading, Loader, Muted, ProgressBar, PushButton, Screen, Title } from '@/components/ui';

export function RoadmapPanel({ id }: { id: string }) {
  const { plan, roadmap, loading, error, reload } = usePlanData(id);
  const router = useRouter();

  if (loading) return <Loader />;
  if (error || !plan) return <ErrorState message={error ?? 'This plan could not be found.'} onRetry={reload} />;

  const steps = deriveRoadmap(roadmap);
  const doneCount = steps.filter((s) => s.state === 'done').length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <FadeIn>
          <View gap={2}>
            <Title>{plan?.title}</Title>
            <Muted textTransform="capitalize">
              {plan?.type}
              {plan?.location_name ? ` · ${plan.location_name}` : ''}
            </Muted>
          </View>
        </FadeIn>

        <FadeIn delay={40}>
          <Card gap={12}>
            <View flexDirection="row" alignItems="center" justifyContent="space-between">
              <Heading>Progress</Heading>
              <Badge
                label={`${doneCount} of ${steps.length}`}
                tone={doneCount === steps.length ? 'success' : 'accent'}
              />
            </View>
            <ProgressBar value={doneCount / steps.length} />
          </Card>
        </FadeIn>

        <FadeIn delay={80}>
          <Card paddingVertical={20}>
            {steps.map((step, i) => (
              <View key={step.stage} flexDirection="row" gap={14}>
                <View alignItems="center" width={18}>
                  <MotiView
                    from={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, delay: i * 70 }}
                  >
                    <View
                      width={14}
                      height={14}
                      borderRadius={7}
                      borderWidth={step.state === 'current' ? 4 : 2}
                      borderColor={step.state === 'pending' ? brand.border : step.state === 'done' ? brand.success : brand.accent}
                      backgroundColor={step.state === 'done' ? brand.success : brand.surface}
                    />
                  </MotiView>
                  {i < steps.length - 1 && (
                    <View
                      flex={1}
                      width={2}
                      minHeight={34}
                      backgroundColor={step.state === 'done' ? brand.success : brand.border}
                    />
                  )}
                </View>
                <View flex={1} paddingBottom={26}>
                  <Text
                    fontSize={16}
                    marginTop={-3}
                    fontWeight={step.state === 'pending' ? '500' : '700'}
                    color={step.state === 'pending' ? brand.inkSoft : brand.ink}
                  >
                    {step.stage}
                  </Text>
                  {step.state === 'current' && step.blocker && (
                    <Muted marginTop={3}>{step.blocker}</Muted>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </FadeIn>

        {plan?.status === 'decided' ? (
          <FadeIn delay={120}>
            <Card backgroundColor={brand.successWash} borderColor={brand.success}>
              <View flexDirection="row" alignItems="center" gap={8}>
                <Ionicons name="checkmark-circle" size={22} color={String(brand.success)} />
                <Text fontWeight="800" fontSize={17} color={brand.successDeep}>It's happening 🎉</Text>
              </View>
              <Text fontSize={15} color={brand.ink}>
                {plan.confirmed_start
                  ? formatSlot(plan.confirmed_start, { weekday: 'long', month: 'long' })
                  : 'Time to be confirmed'}
                {plan.confirmed_venue ? ` · ${plan.confirmed_venue}` : ''}
              </Text>
            </Card>
          </FadeIn>
        ) : (
          <PushButton
            label="Mark my availability"
            onPress={() => router.push(`/plan/${id}/availability`)}
          />
        )}
      </ScrollView>
    </Screen>
  );
}
