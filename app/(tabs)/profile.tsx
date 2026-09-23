import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input, Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AVATAR_COLORS, brand, radius } from '@/lib/theme';
import { useAppearance, type AppearanceChoice } from '@/lib/appearance';
import { Avatar, Card, FadeIn, PushButton, Heading, Muted, Screen, Tappable, Title } from '@/components/ui';
import { DeleteAccount } from '@/components/DeleteAccount';

const APPEARANCE_OPTIONS: { key: AppearanceChoice; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const { choice, scheme, setChoice } = useAppearance();
  const { profile, session, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [color, setColor] = useState(profile?.avatar_color ?? AVATAR_COLORS[5]);
  const [saved, setSaved] = useState(false);

  const dirty = name.trim() !== profile?.display_name || color !== profile?.avatar_color;

  async function save() {
    if (!profile || !name.trim()) return;
    await supabase
      .from('profiles')
      .update({ display_name: name.trim(), avatar_color: color })
      .eq('id', profile.id);
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
          <Title>Profile</Title>

          <FadeIn>
            <Card alignItems="center" gap={14} paddingVertical={24}>
              <Avatar name={name} color={color} size={88} />
              <Input
                size="$5"
                width="100%"
                textAlign="center"
                borderRadius={14}
                backgroundColor={brand.sunken}
                borderColor={brand.border}
                focusStyle={{ borderColor: brand.primary }}
                value={name}
                onChangeText={setName}
                maxLength={40}
              />
              <View flexDirection="row" flexWrap="wrap" gap={12} justifyContent="center">
                {AVATAR_COLORS.map((c) => (
                  <Tappable key={c} onPress={() => setColor(c)}>
                    <View
                      width={40}
                      height={40}
                      borderRadius={20}
                      backgroundColor={c}
                      borderWidth={color === c ? 3 : 0}
                      borderColor={brand.ink}
                    />
                  </Tappable>
                ))}
              </View>
            </Card>
          </FadeIn>

          <FadeIn delay={80}>
            <Card gap={12}>
              <Heading>Appearance</Heading>
              <View
                flexDirection="row"
                backgroundColor={brand.sunken}
                borderRadius={radius.pill}
                padding={3}
              >
                {APPEARANCE_OPTIONS.map((opt) => {
                  const active = choice === opt.key;
                  return (
                    <Pressable key={opt.key} onPress={() => setChoice(opt.key)} style={{ flex: 1 }}>
                      <View
                        alignItems="center"
                        justifyContent="center"
                        paddingVertical={9}
                        borderRadius={radius.pill}
                        backgroundColor={active ? brand.surface : 'transparent'}
                      >
                        <Text
                          fontSize={13}
                          fontWeight="800"
                          color={active ? brand.ink : brand.inkSoft}
                        >
                          {opt.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Muted>
                {choice === 'system'
                  ? `Following your device, currently ${scheme}.`
                  : `Always ${choice}.`}
              </Muted>
            </Card>
          </FadeIn>

          <FadeIn delay={120}>
            <Card gap={6}>
              <Heading>Account</Heading>
              <Muted>{session?.user.email}</Muted>
              <Muted>Signed in with {profile?.auth_provider === 'google' ? 'Google' : 'email'}</Muted>
            </Card>
          </FadeIn>

          <PushButton label={saved ? 'Saved' : 'Save changes'} onPress={save} disabled={!dirty} />

          <Tappable onPress={() => supabase.auth.signOut()}>
            <View alignItems="center" paddingVertical={16}>
              <Text color={brand.danger} fontWeight="700" fontSize={15}>
                Sign out
              </Text>
            </View>
          </Tappable>

          <DeleteAccount />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
