import { useState } from 'react';
import { ScrollView, Share } from 'react-native';
import * as Linking from 'expo-linking';
import { useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input, Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { addAttendee, searchProfiles, updatePlanDetails } from '@/lib/planQueries';
import { PLAN_TYPES, type PlanType } from '@/lib/plans';
import { usePlanData } from '@/lib/usePlanData';
import { brand } from '@/lib/theme';
import { Avatar, Card, Chip, ErrorState, FadeIn, PushButton, Heading, Loader, Muted, Screen, Tappable, Title } from '@/components/ui';
import { VenueSection } from '@/components/VenueSection';

type Found = { id: string; display_name: string; avatar_color: string };

export default function Details() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { plan, attendees, loading, error, reload } = usePlanData(id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PlanType>('hangout');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);


  if (loading) return <Loader />;
  if (error || !plan) return <ErrorState message={error ?? 'This plan could not be found.'} onRetry={reload} />;

  const isCreator = plan.created_by === session?.user.id;
  const inviteUrl = Linking.createURL(`/join/${plan.invite_token}`);

  async function saveEdit() {
    await updatePlanDetails(plan!.id, title.trim() || plan!.title, type);
    setEditing(false);
    await reload();
  }

  async function runSearch(text: string) {
    setQuery(text);
    setResults(await searchProfiles(text, attendees.map((a) => a.user_id)));
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
        <FadeIn>
          {editing ? (
            <Card gap={12}>
              <Input
                size="$5"
                borderRadius={12}
                backgroundColor={brand.sunken}
                borderColor={brand.border}
                value={title}
                onChangeText={setTitle}
                maxLength={80}
              />
              <View flexDirection="row" gap={10}>
                {PLAN_TYPES.map((t) => (
                  <Chip key={t} label={t} active={type === t} onPress={() => setType(t)} />
                ))}
              </View>
              <View flexDirection="row" justifyContent="flex-end" gap={20}>
                <Tappable onPress={() => setEditing(false)}>
                  <Text color={brand.inkSoft} fontSize={15}>Cancel</Text>
                </Tappable>
                <Tappable onPress={saveEdit}>
                  <Text color={brand.primary} fontSize={15} fontWeight="700">Save</Text>
                </Tappable>
              </View>
            </Card>
          ) : (
            <View gap={4}>
              <Title>{plan.title}</Title>
              <Muted textTransform="capitalize">{plan.type}</Muted>
              {isCreator && (
                <Tappable
                  onPress={() => {
                    setTitle(plan.title);
                    setType(plan.type as PlanType);
                    setEditing(true);
                  }}
                >
                  <Text color={brand.primary} fontSize={14} fontWeight="600" marginTop={4}>
                    Edit title & type
                  </Text>
                </Tappable>
              )}
            </View>
          )}
        </FadeIn>

        <FadeIn delay={60}>
          <VenueSection plan={plan} isCreator={isCreator} onChanged={reload} />
        </FadeIn>

        {/* ---- Invite ---- */}
        <FadeIn delay={100}>
          <Card>
            <Heading>Invite link</Heading>
            <Muted numberOfLines={1}>{inviteUrl}</Muted>
            <PushButton
              label="Share invite"
              onPress={() =>
                Share.share({ message: `Join my plan "${plan.title}" on Planora: ${inviteUrl}` })
              }
            />
          </Card>
        </FadeIn>

        {/* ---- People ---- */}
        <FadeIn delay={140}>
          <Card>
            <Heading>Add someone on Planora</Heading>
            <Input
              size="$4"
              borderRadius={12}
              backgroundColor={brand.sunken}
              borderColor={brand.border}
              focusStyle={{ borderColor: brand.primary }}
              placeholder="Search by name or email"
              autoCapitalize="none"
              value={query}
              onChangeText={runSearch}
            />
            {results.map((r) => (
              <Tappable
                key={r.id}
                onPress={async () => {
                  await addAttendee(plan.id, r.id);
                  setQuery('');
                  setResults([]);
                  await reload();
                }}
              >
                <View flexDirection="row" alignItems="center" gap={12} paddingVertical={8}>
                  <Avatar name={r.display_name} color={r.avatar_color} />
                  <Text flex={1} fontSize={15} color={brand.ink}>{r.display_name}</Text>
                  <Text color={brand.primary} fontWeight="600">Add</Text>
                </View>
              </Tappable>
            ))}
          </Card>
        </FadeIn>

        <FadeIn delay={180}>
          <Card>
            <Heading>Going ({attendees.length})</Heading>
            {attendees.map((a) => (
              <View key={a.user_id} flexDirection="row" alignItems="center" gap={12} paddingVertical={8}>
                <Avatar name={a.profiles?.display_name ?? '?'} color={a.profiles?.avatar_color} />
                <Text flex={1} fontSize={15} color={brand.ink}>
                  {a.profiles?.display_name ?? 'Someone'}
                </Text>
                {a.user_id === plan.created_by && (
                  <View backgroundColor={brand.primaryWash} paddingHorizontal={8} paddingVertical={3} borderRadius={999}>
                    <Text fontSize={11} fontWeight="700" color={brand.primary}>organiser</Text>
                  </View>
                )}
              </View>
            ))}
          </Card>
        </FadeIn>
      </ScrollView>
    </Screen>
  );
}
