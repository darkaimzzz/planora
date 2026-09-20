import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Input, Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AVATAR_COLORS, brand } from '@/lib/theme';
import { Avatar, FadeIn, PushButton, Muted, Screen, Tappable, Title } from '@/components/ui';

export default function Onboarding() {
  const { session, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [color, setColor] = useState<string>(AVATAR_COLORS[5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Pick a display name so your friends know who you are.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed, avatar_color: color, onboarded: true })
      .eq('id', session!.user.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    await refreshProfile();
  }

  return (
    <Screen>
      <LinearGradient
        colors={['#ececfb', brand.bg]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
      />
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <FadeIn>
          <View gap={16}>
            <View gap={4}>
              <Title>Set up your profile</Title>
              <Muted fontSize={15}>This is how you'll show up in plans.</Muted>
            </View>

            <View alignItems="center" paddingVertical={10}>
              <Avatar name={name} color={color} size={96} />
            </View>

            <Input
              size="$5"
              borderRadius={14}
              backgroundColor={brand.surface}
              borderColor={brand.border}
              focusStyle={{ borderColor: brand.primary }}
              placeholder="Display name"
              value={name}
              onChangeText={setName}
              maxLength={40}
            />

            <Muted>Avatar colour</Muted>
            <View flexDirection="row" flexWrap="wrap" gap={12}>
              {AVATAR_COLORS.map((c) => (
                <Tappable key={c} onPress={() => setColor(c)}>
                  <View
                    width={44}
                    height={44}
                    borderRadius={22}
                    backgroundColor={c}
                    borderWidth={color === c ? 3 : 0}
                    borderColor={brand.ink}
                  />
                </Tappable>
              ))}
            </View>

            {error && <Text color={brand.danger} fontSize={14}>{error}</Text>}

            <PushButton label="Continue" onPress={save} busy={busy} />
          </View>
        </FadeIn>
      </SafeAreaView>
    </Screen>
  );
}
