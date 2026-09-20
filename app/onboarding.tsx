import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AVATAR_COLORS, colors, initials } from '@/lib/theme';

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
    <View style={styles.container}>
      <Text style={styles.heading}>Set up your profile</Text>
      <Text style={styles.sub}>This is how you'll show up in plans.</Text>

      <View style={[styles.avatar, { backgroundColor: color }]}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Display name"
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
        maxLength={40}
      />

      <Text style={styles.label}>Avatar colour</Text>
      <View style={styles.swatches}>
        {AVATAR_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
          />
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continue</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center', gap: 14 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginBottom: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: '700' },
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
  label: { fontSize: 13, color: colors.muted, marginTop: 4 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: 22 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 14 },
});
