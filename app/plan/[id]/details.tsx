import { useState } from 'react';
import { Linking as RNLinking, ScrollView, Share } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Input, Text, View } from 'tamagui';
import { useAuth } from '@/lib/auth';
import { addAttendee, searchProfiles, updatePlanDetails, updatePlanLocation } from '@/lib/planQueries';
import { PLAN_TYPES, type PlanType } from '@/lib/plans';
import { mapsUrl, placesEnabled, searchPlaces, type PlaceResult } from '@/lib/places';
import { usePlanData } from '@/lib/usePlanData';
import { brand } from '@/lib/theme';
import { Avatar, Card, Chip, FadeIn, GradientButton, Heading, Loader, Muted, Screen, Tappable, Title } from '@/components/ui';

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

  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [editingPlace, setEditingPlace] = useState(false);

  if (loading || !plan) return <Loader />;

  const isCreator = plan.created_by === session?.user.id;
  const inviteUrl = Linking.createURL(`/join/${plan.invite_token}`);
  const mapLink = mapsUrl(plan);

  async function saveEdit() {
    await updatePlanDetails(plan!.id, title.trim() || plan!.title, type);
    setEditing(false);
    await reload();
  }

  async function runSearch(text: string) {
    setQuery(text);
    setResults(await searchProfiles(text, attendees.map((a) => a.user_id)));
  }

  async function runPlaceSearch(text: string) {
    setPlaceQuery(text);
    setPlaceResults(await searchPlaces(text));
  }

  async function choosePlace(place: PlaceResult | null) {
    await updatePlanLocation(plan!.id, place);
    setEditingPlace(false);
    setPlaceQuery('');
    setPlaceResults([]);
    await reload();
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

        {/* ---- Location: set by the creator, not voted on ---- */}
        <FadeIn delay={60}>
          <Card>
            <View flexDirection="row" alignItems="center" gap={8}>
              <Ionicons name="location-outline" size={18} color={brand.primary} />
              <Heading>Where</Heading>
            </View>

            {plan.location_name && !editingPlace ? (
              <View gap={6}>
                <Text fontSize={16} fontWeight="700" color={brand.ink}>
                  {plan.location_name}
                </Text>
                {plan.location_address && <Muted>{plan.location_address}</Muted>}
                <View flexDirection="row" gap={18} marginTop={4}>
                  {mapLink && (
                    <Tappable onPress={() => RNLinking.openURL(mapLink)}>
                      <Text color={brand.primary} fontWeight="600" fontSize={14}>Open in Maps</Text>
                    </Tappable>
                  )}
                  {isCreator && (
                    <Tappable onPress={() => setEditingPlace(true)}>
                      <Text color={brand.primary} fontWeight="600" fontSize={14}>Change</Text>
                    </Tappable>
                  )}
                </View>
              </View>
            ) : isCreator ? (
              <View gap={10}>
                <Muted>
                  {placesEnabled
                    ? 'Search for a place — the address and map link are saved with the plan.'
                    : 'Type where you’re meeting. Add a Google Maps key to search real places.'}
                </Muted>
                <Input
                  size="$4"
                  borderRadius={12}
                  backgroundColor={brand.sunken}
                  borderColor={brand.border}
                  focusStyle={{ borderColor: brand.primary }}
                  placeholder={placesEnabled ? 'Search a place…' : 'e.g. Dosa Corner'}
                  value={placeQuery}
                  onChangeText={runPlaceSearch}
                />

                {placeResults.map((p) => (
                  <Tappable key={p.placeId ?? p.name} onPress={() => choosePlace(p)}>
                    <View paddingVertical={10} borderBottomWidth={1} borderBottomColor={brand.border}>
                      <Text fontSize={15} fontWeight="600" color={brand.ink}>{p.name}</Text>
                      {p.address && <Muted>{p.address}</Muted>}
                    </View>
                  </Tappable>
                ))}

                {/* Without a Places key (or if nothing matched) the typed text
                    is still a perfectly good answer. */}
                {placeQuery.trim().length > 0 && placeResults.length === 0 && (
                  <GradientButton
                    label={`Use "${placeQuery.trim()}"`}
                    onPress={() => choosePlace({ name: placeQuery.trim(), address: null, placeId: null, lat: null, lng: null })}
                  />
                )}

                {editingPlace && (
                  <Tappable onPress={() => setEditingPlace(false)}>
                    <Text color={brand.inkSoft} fontSize={14} textAlign="center">Cancel</Text>
                  </Tappable>
                )}
              </View>
            ) : (
              <Muted>The organiser hasn't set a place yet.</Muted>
            )}
          </Card>
        </FadeIn>

        {/* ---- Invite ---- */}
        <FadeIn delay={100}>
          <Card>
            <Heading>Invite link</Heading>
            <Muted numberOfLines={1}>{inviteUrl}</Muted>
            <GradientButton
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
                  <View backgroundColor={brand.primarySoft} paddingHorizontal={8} paddingVertical={3} borderRadius={999}>
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
