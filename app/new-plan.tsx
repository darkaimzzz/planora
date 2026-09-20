import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { createPlan } from '@/lib/planQueries';
import { PLAN_TYPES, type PlanType } from '@/lib/plans';
import { colors } from '@/lib/theme';

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
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>New plan</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.input}
          placeholder="What's the plan?"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
          autoFocus
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {PLAN_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[styles.typeChip, type === t && styles.typeChipActive]}
            >
              <Text style={[styles.typeText, type === t && styles.typeTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create plan</Text>}
        </Pressable>
        <Text style={styles.hint}>You'll get an invite link to share on the next screen.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  cancel: { color: colors.accent, fontSize: 16 },
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
  label: { fontSize: 13, color: colors.muted },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  typeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeText: { color: colors.text, fontSize: 14, textTransform: 'capitalize' },
  typeTextActive: { color: '#fff', fontWeight: '600' },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14 },
});
