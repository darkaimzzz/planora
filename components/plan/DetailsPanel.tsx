import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input, Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { addAttendee, searchProfiles, updatePlanDetails } from '@/lib/planQueries';
import { PLAN_TYPES, type PlanType } from '@/lib/plans';
import { copyInvite, inviteLinkIsPublic, inviteUrl, shareInvite } from '@/lib/invite';
import { usePlanData } from '@/lib/usePlanData';
import { brand } from '@/lib/theme';
import { Avatar, Card, Chip, ErrorState, FadeIn, PushButton, Heading, Loader, Muted, Screen, Tappable, Title } from '@/components/ui';
import { VenueSection } from '@/components/VenueSection';

type Found = { id: string; display_name: string; avatar_color: string };

export function DetailsPanel({ id }: { id: string }) {
  const { session } = useAuth();
  const { plan, attendees, loading, error, reload } = usePlanData(id);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<PlanType>('hangout');
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Found[]>([]);


  if (loading) return <Loader />;
  if (error || !plan) return <ErrorState message={error ?? 'This plan could not be found.'} onRetry={reload} />;

  const isCreator = plan.created_by === session?.user.id;
  const link = inviteUrl(plan.invite_token);

  function flashCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
            <View flexDirection="row" alignItems="center" gap={8}>
              <Ionicons name="link-outline" size={18} color={String(brand.primary)} />
              <Heading>Invite link</Heading>
            </View>
            <Muted>Anyone with this link joins the plan — no account needed up front.</Muted>

            <View
              backgroundColor={brand.sunken}
              borderRadius={12}
              paddingHorizontal={12}
              paddingVertical={10}
            >
              <Text fontSize={13} color={brand.inkSoft} numberOfLines={1}>
                {link}
              </Text>
            </View>

            <View flexDirection="row" gap={10}>
              <View flex={1}>
                <PushButton
                  label={copied ? 'Copied ✓' : 'Copy link'}
                  tone={copied ? 'success' : 'primary'}
                  onPress={async () => {
                    if (await copyInvite(link)) flashCopied();
                  }}
                />
              </View>
              <View flex={1}>
                <PushButton
                  label="Share"
                  tone="neutral"
                  onPress={async () => {
                    // Falls back to the clipboard where there's no share sheet.
                    if ((await shareInvite(plan.title, link)) === 'copied') flashCopied();
                  }}
                />
              </View>
            </View>

            {!inviteLinkIsPublic && (
              <Muted>
                This is a local address, so it only opens on this machine. Set
                EXPO_PUBLIC_APP_URL to your deployed web address to send real links.
              </Muted>
            )}
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
