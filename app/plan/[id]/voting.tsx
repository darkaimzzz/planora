import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { advancePlan } from '@/lib/advance';
import { colors } from '@/lib/theme';

type Poll = {
  id: string;
  poll_type: 'time' | 'venue' | 'adhoc';
  status: 'open' | 'closed';
  deadline: string;
  winning_option_id: string | null;
};
type Option = { id: string; poll_id: string; label: string };
type Vote = { poll_id: string; option_id: string; user_id: string };

const TITLES: Record<Poll['poll_type'], string> = {
  time: 'When are we doing this?',
  venue: 'Where are we going?',
  adhoc: 'Question',
};

export default function Voting() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();

  const [polls, setPolls] = useState<Poll[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [myAvailability, setMyAvailability] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !session) return;
    const [pollRes, attendeeRes, availRes] = await Promise.all([
      supabase.from('polls').select('*').eq('plan_id', id).order('created_at'),
      supabase.from('plan_attendees').select('user_id', { count: 'exact' }).eq('plan_id', id),
      supabase
        .from('availability')
        .select('id', { count: 'exact', head: true })
        .eq('plan_id', id)
        .eq('user_id', session.user.id),
    ]);

    const pollRows = (pollRes.data ?? []) as Poll[];
    setPolls(pollRows);
    setAttendeeCount(attendeeRes.count ?? 0);
    setMyAvailability(availRes.count ?? 0);

    if (pollRows.length) {
      const ids = pollRows.map((p) => p.id);
      const [optRes, voteRes] = await Promise.all([
        supabase.from('poll_options').select('id, poll_id, label').in('poll_id', ids),
        supabase.from('votes').select('poll_id, option_id, user_id').in('poll_id', ids),
      ]);
      setOptions((optRes.data ?? []) as Option[]);
      setVotes((voteRes.data ?? []) as Vote[]);
    } else {
      setOptions([]);
      setVotes([]);
    }
    setLoading(false);
  }, [id, session]);

  useEffect(() => {
    load();
    if (!id) return;
    const channel = supabase
      .channel(`voting-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `plan_id=eq.${id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  async function vote(poll: Poll, optionId: string) {
    if (!session || poll.status === 'closed') return;
    // One vote per person per poll; changing your mind updates it.
    await supabase
      .from('votes')
      .upsert(
        { poll_id: poll.id, option_id: optionId, user_id: session.user.id },
        { onConflict: 'poll_id,user_id' },
      );
    await load();
    // A vote may be the one that resolves the poll.
    await advancePlan(id!);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (polls.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No polls yet</Text>
        <Text style={styles.empty}>
          {myAvailability === 0
            ? 'Mark when you’re free and the time poll opens once everyone has.'
            : 'Waiting for everyone else to mark their availability.'}
        </Text>
        <Pressable style={styles.primary} onPress={() => router.push(`/plan/${id}/availability`)}>
          <Text style={styles.primaryText}>
            {myAvailability === 0 ? 'Mark availability' : 'Edit my availability'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {polls.map((poll) => {
        const pollOptions = options.filter((o) => o.poll_id === poll.id);
        const pollVotes = votes.filter((v) => v.poll_id === poll.id);
        const mine = pollVotes.find((v) => v.user_id === session?.user.id);

        return (
          <View key={poll.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{TITLES[poll.poll_type]}</Text>
              <Text style={[styles.status, poll.status === 'closed' && styles.statusClosed]}>
                {poll.status === 'closed' ? 'closed' : `${pollVotes.length}/${attendeeCount} voted`}
              </Text>
            </View>

            {pollOptions.map((option) => {
              const count = pollVotes.filter((v) => v.option_id === option.id).length;
              const pct = pollVotes.length ? (count / pollVotes.length) * 100 : 0;
              const chosen = mine?.option_id === option.id;
              const won = poll.winning_option_id === option.id;

              return (
                <Pressable
                  key={option.id}
                  onPress={() => vote(poll, option.id)}
                  disabled={poll.status === 'closed'}
                  style={[styles.option, chosen && styles.optionChosen, won && styles.optionWon]}
                >
                  <View style={[styles.bar, { width: `${pct}%` }]} />
                  <View style={styles.optionRow}>
                    <Text style={styles.optionLabel}>
                      {option.label}
                      {won ? '  ✓' : ''}
                    </Text>
                    <Text style={styles.optionCount}>{count}</Text>
                  </View>
                </Pressable>
              );
            })}

            {poll.status === 'open' && (
              <Text style={styles.deadline}>
                Closes {new Date(poll.deadline).toLocaleString()} at the latest
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  empty: { color: colors.muted, textAlign: 'center', fontSize: 15 },
  content: { padding: 16, gap: 16 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  status: { fontSize: 12, color: colors.muted },
  statusClosed: { color: colors.accent, fontWeight: '600' },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  optionChosen: { borderColor: colors.accent, borderWidth: 2 },
  optionWon: { borderColor: colors.accent, backgroundColor: '#eef2ff' },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#eef2ff' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  optionLabel: { fontSize: 15, color: colors.text, flex: 1 },
  optionCount: { fontSize: 15, color: colors.muted, fontWeight: '600' },
  deadline: { fontSize: 12, color: colors.muted },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, marginTop: 8 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
