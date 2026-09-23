import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { MotiView } from 'moti';
import { Input, Text, View } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { brand, radius } from '@/lib/theme';
import { Logo } from '@/components/Logo';
import { FadeIn, LargeTitle, Muted, PushButton, Screen, Tappable } from '@/components/ui';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'signin' | 'signup';

const inputStyle = {
  size: '$5',
  borderRadius: radius.md,
  borderWidth: 2,
  backgroundColor: brand.surface,
  borderColor: brand.border,
  focusStyle: { borderColor: brand.primary },
} as const;

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError('Enter an email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    const creds = { email: email.trim(), password };
    const { data, error } =
      mode === 'signup'
        ? await supabase.auth.signUp(creds)
        : await supabase.auth.signInWithPassword(creds);
    setBusy(false);

    if (error) {
      setError(error.message);
      return;
    }
    // Email confirmation on => no session yet. Say so instead of hanging.
    if (mode === 'signup' && !data.session) {
      setNotice('Check your email to confirm your account, then sign in.');
      setMode('signin');
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setBusy(true);
    const redirectTo = Linking.createURL('/sign-in');

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      setBusy(false);
      setError(error?.message ?? 'Could not start Google sign-in.');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      setBusy(false);
      return; // user cancelled
    }

    // Supabase returns either ?code= (PKCE) or a #access_token fragment.
    const url = result.url;
    const code = Linking.parse(url).queryParams?.code;
    if (typeof code === 'string') {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) setError(error.message);
    } else {
      const fragment = url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) setError(error.message);
      } else {
        setError('Google sign-in did not return a session.');
      }
    }
    setBusy(false);
  }

  return (
    <Screen>
      {/* Three soft blobs in the brand colours, the only decoration, kept
          behind everything so the form stays the focus. */}
      <Blob color={brand.primaryWash} size={320} top={-110} left={-90} />
      <Blob color={brand.accentWash} size={220} top={40} right={-80} />
      <Blob color={brand.successWash} size={260} bottom={-120} left={-60} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: 24,
            paddingTop: 24 + insets.top,
            paddingBottom: 24 + insets.bottom,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <FadeIn>
            <View alignItems="center" marginBottom={32} gap={10}>
              <MotiView
                from={{ scale: 0.6, rotate: '-12deg' }}
                animate={{ scale: 1, rotate: '0deg' }}
                transition={{ type: 'spring', damping: 11, stiffness: 120 }}
              >
                <Logo size={76} />
              </MotiView>
              <LargeTitle>Planora</LargeTitle>
              <Muted fontSize={16} textAlign="center" maxWidth={280}>
                Stop saying "we should hang out sometime".
              </Muted>
            </View>
          </FadeIn>

          <FadeIn delay={90}>
            <View gap={12}>
              <Input
                {...inputStyle}
                placeholder="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Input
                {...inputStyle}
                placeholder="Password"
                autoCapitalize="none"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {error && (
                <View backgroundColor="#FDECEA" borderRadius={radius.sm} padding={12}>
                  <Text color={brand.dangerDeep} fontSize={14} fontWeight="600">
                    {error}
                  </Text>
                </View>
              )}
              {notice && (
                <View backgroundColor={brand.successWash} borderRadius={radius.sm} padding={12}>
                  <Text color={brand.successDeep} fontSize={14} fontWeight="600">
                    {notice}
                  </Text>
                </View>
              )}

              <View marginTop={4}>
                <PushButton
                  label={mode === 'signup' ? 'Create account' : 'Sign in'}
                  onPress={submit}
                  busy={busy}
                />
              </View>

              <View flexDirection="row" alignItems="center" gap={12} marginVertical={6}>
                <View flex={1} height={2} backgroundColor={brand.border} borderRadius={2} />
                <Muted>OR</Muted>
                <View flex={1} height={2} backgroundColor={brand.border} borderRadius={2} />
              </View>

              <PushButton label="Continue with Google" tone="neutral" onPress={signInWithGoogle} disabled={busy} />

              <Tappable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
                <View alignItems="center" paddingVertical={16}>
                  <Text color={brand.primary} fontSize={15} fontWeight="700">
                    {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
                  </Text>
                </View>
              </Tappable>
            </View>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Blob({
  color,
  size,
  ...pos
}: {
  color: any;
  size: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}) {
  return (
    <View
      position="absolute"
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor={color}
      opacity={0.75}
      {...pos}
    />
  );
}
