import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { advancePlan } from '@/lib/advance';
import { formatSlot } from '@/lib/plans';
import { brand } from '@/lib/theme';
import { Card, FadeIn, PushButton, Heading, Loader, Muted, Screen, Tappable } from '@/components/ui';

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

export function VotingPanel({ id }: { id: string }) {
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
    await advancePlan(id!); // this vote may be the one that resolves the poll
  }

  if (loading) return <Loader />;

  if (polls.length === 0) {
    return (
      <Screen alignItems="center" justifyContent="center" padding={24} gap={12}>
        <Ionicons name="hourglass-outline" size={44} color={brand.border} />
        <Heading>No polls yet</Heading>
        <Muted textAlign="center" fontSize={15}>
          {myAvailability === 0
            ? 'Mark when you’re free and the time poll opens once everyone has.'
            : 'Waiting for everyone else to mark their availability.'}
        </Muted>
        <PushButton
          full={false}
          label={myAvailability === 0 ? 'Mark availability' : 'Edit availability'}
          onPress={() => router.push(`/plan/${id}/availability`)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {polls.map((poll, pi) => {
          const pollOptions = options.filter((o) => o.poll_id === poll.id);
          const pollVotes = votes.filter((v) => v.poll_id === poll.id);
          const mine = pollVotes.find((v) => v.user_id === session?.user.id);

          return (
            <FadeIn key={poll.id} delay={pi * 60}>
              <Card>
                <View flexDirection="row" alignItems="center" justifyContent="space-between" gap={8}>
                  <Heading flex={1}>{TITLES[poll.poll_type]}</Heading>
                  <View
                    backgroundColor={poll.status === 'closed' ? brand.primaryWash : brand.sunken}
                    paddingHorizontal={10}
                    paddingVertical={4}
                    borderRadius={999}
                  >
                    <Text
                      fontSize={11}
                      fontWeight="700"
                      color={poll.status === 'closed' ? brand.primary : brand.inkSoft}
                    >
                      {poll.status === 'closed' ? 'closed' : `${pollVotes.length}/${attendeeCount} voted`}
                    </Text>
                  </View>
                </View>

                {pollOptions.map((option) => {
                  const count = pollVotes.filter((v) => v.option_id === option.id).length;
                  const pct = pollVotes.length ? (count / pollVotes.length) * 100 : 0;
                  const chosen = mine?.option_id === option.id;
                  const won = poll.winning_option_id === option.id;

                  return (
                    <Tappable
                      key={option.id}
                      onPress={() => vote(poll, option.id)}
                      disabled={poll.status === 'closed'}
                    >
                      <View
                        borderWidth={chosen || won ? 2 : 1}
                        borderColor={chosen || won ? brand.primary : brand.border}
                        borderRadius={14}
                        overflow="hidden"
                        backgroundColor={won ? brand.primaryWash : brand.surface}
                      >
                        {/* The bar grows into place rather than snapping. */}
                        <MotiView
                          animate={{ width: `${pct}%` }}
                          transition={{ type: 'timing', duration: 420 }}
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            backgroundColor: brand.primaryWash,
                          }}
                        />
                        <View flexDirection="row" justifyContent="space-between" padding={14}>
                          <Text
                            fontSize={15}
                            color={brand.ink}
                            flex={1}
                            fontWeight={chosen || won ? '700' : '500'}
                          >
                            {option.label}
                            {won ? '  ✓' : ''}
                          </Text>
                          <Text fontSize={15} color={brand.inkSoft} fontWeight="700">
                            {count}
                          </Text>
                        </View>
                      </View>
                    </Tappable>
                  );
                })}

                {poll.status === 'open' && (
                  <Muted>Closes {formatSlot(poll.deadline, { minute: '2-digit' })} at the latest</Muted>
                )}
              </Card>
            </FadeIn>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
