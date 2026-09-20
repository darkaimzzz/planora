import { ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Text, View } from 'tamagui';
import { formatSlot } from '@/lib/plans';
import { deriveRoadmap } from '@/lib/roadmap';
import { usePlanData } from '@/lib/usePlanData';
import { brand } from '@/lib/theme';
import { Card, FadeIn, GradientButton, Loader, Muted, Screen, Title } from '@/components/ui';

export default function Roadmap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plan, roadmap, loading } = usePlanData(id);
  const router = useRouter();

  if (loading) return <Loader />;

  const steps = deriveRoadmap(roadmap);

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

        <FadeIn delay={60}>
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
                      borderColor={step.state === 'pending' ? brand.border : brand.primary}
                      backgroundColor={step.state === 'done' ? brand.primary : brand.surface}
                    />
                  </MotiView>
                  {i < steps.length - 1 && (
                    <View
                      flex={1}
                      width={2}
                      minHeight={34}
                      backgroundColor={step.state === 'done' ? brand.primary : brand.border}
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
            <Card backgroundColor={brand.primarySoft} borderColor={brand.primary}>
              <View flexDirection="row" alignItems="center" gap={8}>
                <Ionicons name="checkmark-circle" size={20} color={brand.primary} />
                <Text fontWeight="700" color={brand.primary}>It's happening</Text>
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
          <GradientButton
            label="Mark my availability"
            onPress={() => router.push(`/plan/${id}/availability`)}
          />
        )}
      </ScrollView>
    </Screen>
  );
}
