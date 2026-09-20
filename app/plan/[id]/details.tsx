import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { addAttendee, searchProfiles, updatePlanDetails } from '@/lib/planQueries';
import { PLAN_TYPES, type PlanType } from '@/lib/plans';
import { usePlanData } from '@/lib/usePlanData';
import { colors, initials } from '@/lib/theme';

type Found = { id: string; display_name: string; avatar_color: string };

export default function Details() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { plan, attendees, loading, reload } = usePlanData(id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PlanType>('hangout');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);
  const [copied, setCopied] = useState(false);

  if (loading || !plan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const isCreator = plan.created_by === session?.user.id;
  const inviteUrl = Linking.createURL(`/join/${plan.invite_token}`);

  function startEdit() {
    setTitle(plan!.title);
    setType(plan!.type as PlanType);
    setEditing(true);
  }

  async function saveEdit() {
    await updatePlanDetails(plan!.id, title.trim() || plan!.title, type);
    setEditing(false);
    await reload();
  }

  async function runSearch(text: string) {
    setQuery(text);
    setResults(await searchProfiles(text, attendees.map((a) => a.user_id)));
  }

  async function invite(userId: string) {
    await addAttendee(plan!.id, userId);
    setQuery('');
    setResults([]);
    await reload();
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {editing ? (
        <View style={styles.editBox}>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={80} />
          <View style={styles.typeRow}>
            {PLAN_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
                <Text style={[styles.chipText, type === t && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.editActions}>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
            <Pressable onPress={saveEdit}>
              <Text style={[styles.link, { fontWeight: '700' }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.title}>{plan.title}</Text>
          <Text style={styles.sub}>{plan.type}</Text>
          {isCreator && (
            <Pressable onPress={startEdit}>
              <Text style={styles.link}>Edit title & type</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invite link</Text>
        <Text style={styles.url} numberOfLines={1}>
          {inviteUrl}
        </Text>
        <Pressable
          style={styles.primary}
          onPress={async () => {
            await Share.share({ message: `Join my plan "${plan.title}" on PlanBot: ${inviteUrl}` });
            setCopied(true);
          }}
        >
          <Text style={styles.primaryText}>{copied ? 'Shared' : 'Share invite'}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add someone on PlanBot</Text>
        <TextInput
          style={styles.input}
          placeholder="Search by name or email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={query}
          onChangeText={runSearch}
        />
        {results.map((r) => (
          <Pressable key={r.id} style={styles.resultRow} onPress={() => invite(r.id)}>
            <View style={[styles.avatar, { backgroundColor: r.avatar_color }]}>
              <Text style={styles.avatarText}>{initials(r.display_name)}</Text>
            </View>
            <Text style={styles.name}>{r.display_name}</Text>
            <Text style={styles.link}>Add</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Going ({attendees.length})</Text>
        {attendees.map((a) => (
          <View key={a.user_id} style={styles.resultRow}>
            <View style={[styles.avatar, { backgroundColor: a.profiles?.avatar_color ?? colors.muted }]}>
              <Text style={styles.avatarText}>{initials(a.profiles?.display_name ?? '?')}</Text>
            </View>
            <Text style={styles.name}>{a.profiles?.display_name ?? 'Someone'}</Text>
            {a.user_id === plan.created_by && <Text style={styles.badge}>creator</Text>}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, textTransform: 'capitalize', marginBottom: 6 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  url: { fontSize: 13, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  name: { flex: 1, fontSize: 15, color: colors.text },
  badge: { fontSize: 12, color: colors.muted },
  link: { color: colors.accent, fontSize: 15 },
  editBox: { gap: 12 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  typeRow: { flexDirection: 'row', gap: 10 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14, textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
});
