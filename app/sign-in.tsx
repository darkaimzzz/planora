import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Input, Text, View } from 'tamagui';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';
import { Body, FadeIn, GhostButton, GradientButton, Muted, Screen, Tappable } from '@/components/ui';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'signin' | 'signup';

export default function SignIn() {
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
      {/* A soft wash behind the top of the screen, so the form isn't floating
          on flat white. */}
      <LinearGradient
        colors={['#ececfb', brand.bg]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 360 }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
          <FadeIn>
            <View alignItems="center" marginBottom={28} gap={6}>
              <MotiView
                from={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14 }}
              >
                <LogoMark />
              </MotiView>
              <Text fontSize={34} fontWeight="800" color={brand.ink} letterSpacing={-1}>
                Planora
              </Text>
              <Muted fontSize={15} textAlign="center">
                Stop saying "we should hang out sometime".
              </Muted>
            </View>
          </FadeIn>

          <FadeIn delay={80}>
            <View gap={12}>
              <Input
                size="$5"
                borderRadius={14}
                backgroundColor={brand.surface}
                borderColor={brand.border}
                focusStyle={{ borderColor: brand.primary }}
                placeholder="Email"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Input
                size="$5"
                borderRadius={14}
                backgroundColor={brand.surface}
                borderColor={brand.border}
                focusStyle={{ borderColor: brand.primary }}
                placeholder="Password"
                autoCapitalize="none"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {error && <Text color={brand.danger} fontSize={14}>{error}</Text>}
              {notice && <Body>{notice}</Body>}

              <GradientButton
                label={mode === 'signup' ? 'Create account' : 'Sign in'}
                onPress={submit}
                busy={busy}
              />

              <View flexDirection="row" alignItems="center" gap={12} marginVertical={6}>
                <View flex={1} height={1} backgroundColor={brand.border} />
                <Muted>or</Muted>
                <View flex={1} height={1} backgroundColor={brand.border} />
              </View>

              <GhostButton label="Continue with Google" onPress={signInWithGoogle} disabled={busy} />

              <Tappable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
                <View alignItems="center" paddingVertical={14}>
                  <Text color={brand.primary} fontSize={14} fontWeight="600">
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

/** The logo's calendar-with-a-tick, drawn in views so there's no asset to ship. */
function LogoMark() {
  return (
    <View
      width={64}
      height={64}
      borderRadius={18}
      borderWidth={3}
      borderColor={brand.primary}
      alignItems="center"
      justifyContent="center"
    >
      <View position="absolute" top={-7} left={16} width={3} height={12} borderRadius={2} backgroundColor={brand.primary} />
      <View position="absolute" top={-7} right={16} width={3} height={12} borderRadius={2} backgroundColor={brand.primary} />
      <View position="absolute" top={13} left={0} right={0} height={3} backgroundColor={brand.primary} />
      <Text color={brand.primary} fontSize={26} fontWeight="800" marginTop={12}>
        ✓
      </Text>
    </View>
  );
}
