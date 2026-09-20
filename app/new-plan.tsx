import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Input, Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { createPlan } from '@/lib/planQueries';
import { PLAN_TYPES, type PlanType } from '@/lib/plans';
import { brand } from '@/lib/theme';
import { Chip, FadeIn, PushButton, Muted, Screen, Tappable, Title } from '@/components/ui';

export default function NewPlan() {
  const { session } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PlanType>('hangout');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError('Give the plan a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const plan = await createPlan(title.trim(), type, session!.user.id);
      router.replace(`/plan/${plan.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <View padding={20} gap={16}>
          <View flexDirection="row" alignItems="center" justifyContent="space-between">
            <Title>New plan</Title>
            <Tappable onPress={() => router.back()}>
              <Text color={brand.primary} fontSize={16} fontWeight="600">Cancel</Text>
            </Tappable>
          </View>

          <FadeIn>
            <View gap={16}>
              <Input
                size="$5"
                borderRadius={14}
                backgroundColor={brand.surface}
                borderColor={brand.border}
                focusStyle={{ borderColor: brand.primary }}
                placeholder="What's the plan?"
                value={title}
                onChangeText={setTitle}
                maxLength={80}
                autoFocus
              />

              <View gap={8}>
                <Muted>Type</Muted>
                <View flexDirection="row" gap={10}>
                  {PLAN_TYPES.map((t) => (
                    <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />
                  ))}
                </View>
              </View>

              {error && <Text color={brand.danger} fontSize={14}>{error}</Text>}

              <PushButton label="Create plan" onPress={submit} busy={busy} />
              <Muted textAlign="center">
                You'll set the place and share an invite link on the next screen.
              </Muted>
            </View>
          </FadeIn>
        </View>
      </SafeAreaView>
    </Screen>
  );
}
