import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AVATAR_COLORS, colors, initials } from '@/lib/theme';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useAuth();
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>

        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{initials(name)}</Text>
        </View>

        <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={40} />

        <View style={styles.swatches}>
          {AVATAR_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
            />
          ))}
        </View>

        <Text style={styles.email}>{profile?.email}</Text>
        <Text style={styles.provider}>
          Signed in with {profile?.auth_provider === 'google' ? 'Google' : 'email'}
        </Text>

        <Pressable style={[styles.primary, !dirty && { opacity: 0.4 }]} onPress={save} disabled={!dirty}>
          <Text style={styles.primaryText}>{saved ? 'Saved' : 'Save changes'}</Text>
        </Pressable>

        <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
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
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
  email: { color: colors.muted, fontSize: 14, marginTop: 8 },
  provider: { color: colors.muted, fontSize: 13 },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOut: { alignItems: 'center', paddingVertical: 14 },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
