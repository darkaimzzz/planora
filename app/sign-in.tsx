import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>PlanBot</Text>
        <Text style={styles.tagline}>Stop saying "we should hang out sometime".</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <Pressable style={[styles.primary, busy && styles.disabled]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>{mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.rule} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.rule} />
        </View>

        <Pressable style={[styles.secondary, busy && styles.disabled]} onPress={signInWithGoogle} disabled={busy}>
          <Text style={styles.secondaryText}>Continue with Google</Text>
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} style={styles.switch}>
          <Text style={styles.switchText}>
            {mode === 'signup' ? 'Already have an account? Sign in' : "New here? Create an account"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  logo: { fontSize: 34, fontWeight: '800', color: colors.text },
  tagline: { fontSize: 15, color: colors.muted, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 13 },
  switch: { alignItems: 'center', paddingVertical: 12 },
  switchText: { color: colors.accent, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
  notice: { color: colors.text, fontSize: 14 },
});
