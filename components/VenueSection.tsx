import { useEffect, useState } from 'react';
import { Linking as RNLinking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input, Text, View } from 'tamagui';
import { advancePlan } from '@/lib/advance';
import { proposeVenues, updatePlanLocation } from '@/lib/planQueries';
import { searchPlaces, type PlaceResult } from '@/lib/places';
import { mapsUrl, type Plan } from '@/lib/plans';
import { supabase } from '@/lib/supabase';
import { brand } from '@/lib/theme';
import { Card, NeutralButton, PushButton, Heading, Muted, Tappable } from '@/components/ui';

/**
 * The venue half of a plan. The creator proposes two or three places and the
 * group votes on them in the Voting tab; proposing just one skips the vote and
 * sets it directly. Everyone else sees whatever has been decided so far.
 */
export function VenueSection({
  plan,
  isCreator,
  onChanged,
}: {
  plan: Plan;
  isCreator: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  // Optimistic: assume search works until the server says it has no key, so
  // the field does not flash the fallback wording on every open.
  const [placesEnabled, setPlacesEnabled] = useState(true);
  const [shortlist, setShortlist] = useState<PlaceResult[]>([]);
  const [venueVoteOpen, setVenueVoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether a venue vote is already running decides what this card offers.
  useEffect(() => {
    supabase
      .from('polls')
      .select('status')
      .eq('plan_id', plan.id)
      .eq('poll_type', 'venue')
      .maybeSingle()
      .then(({ data }) => setVenueVoteOpen(data?.status === 'open'));
  }, [plan.id, plan.location_name]);

  const mapLink = mapsUrl(plan);

  // Typing fires a request per keystroke otherwise, which wastes quota on
  // every provider and costs real money on Google. Wait for a pause, and
  // ignore a response that arrives after the query has moved on.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      const { places, configured } = await searchPlaces(q);
      if (!current) return;
      setResults(places);
      setPlacesEnabled(configured);
    }, 350);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  function addToShortlist(place: PlaceResult) {
    setError(null);
    if (shortlist.length >= 3) {
      setError('Three is the most you can put to a vote.');
      return;
    }
    if (shortlist.some((p) => (p.placeId ?? p.name) === (place.placeId ?? place.name))) return;
    setShortlist([...shortlist, place]);
    setQuery('');
    setResults([]);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (shortlist.length === 1) {
        // One place isn't a choice, so there is nothing to vote on.
        await updatePlanLocation(plan.id, shortlist[0]);
      } else {
        await proposeVenues(plan.id, shortlist);
      }
      setShortlist([]);
      setPicking(false);
      await onChanged();
      await advancePlan(plan.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View flexDirection="row" alignItems="center" gap={8}>
        <Ionicons name="location-outline" size={18} color={brand.primary} />
        <Heading>Where</Heading>
      </View>

      {/* Decided */}
      {plan.location_name && !picking && (
        <View gap={6}>
          <Text fontSize={16} fontWeight="700" color={brand.ink}>
            {plan.location_name}
          </Text>
          {plan.location_address && <Muted>{plan.location_address}</Muted>}
          <View flexDirection="row" gap={18} marginTop={4}>
            {mapLink && (
              <Tappable onPress={() => RNLinking.openURL(mapLink)}>
                <Text color={brand.primary} fontWeight="600" fontSize={14}>
                  Open in Maps
                </Text>
              </Tappable>
            )}
            {isCreator && plan.status !== 'decided' && (
              <Tappable onPress={() => setPicking(true)}>
                <Text color={brand.primary} fontWeight="600" fontSize={14}>
                  Change
                </Text>
              </Tappable>
            )}
          </View>
        </View>
      )}

      {/* Put to a vote, not yet resolved */}
      {!plan.location_name && venueVoteOpen && !picking && (
        <View gap={8}>
          <Muted>The places are up for a vote — head to the Voting tab.</Muted>
          {isCreator && (
            <Tappable onPress={() => setPicking(true)}>
              <Text color={brand.primary} fontWeight="600" fontSize={14}>
                Change the options
              </Text>
            </Tappable>
          )}
        </View>
      )}

      {/* Nothing yet */}
      {!plan.location_name && !venueVoteOpen && !picking && (
        isCreator ? (
          <View gap={10}>
            <Muted>Propose two or three places and let everyone vote.</Muted>
            <PushButton label="Propose places" onPress={() => setPicking(true)} />
          </View>
        ) : (
          <Muted>The organiser hasn't proposed anywhere yet.</Muted>
        )
      )}

      {/* Picking */}
      {picking && (
        <View gap={10}>
          <Muted>
            {placesEnabled
              ? 'Search and add two or three places. Add just one to skip the vote.'
              : 'Type a place and add it. Two or three go to a vote; one skips it. Add a Google Maps key to search real places.'}
          </Muted>

          {shortlist.map((p, i) => (
            <View
              key={p.placeId ?? p.name}
              flexDirection="row"
              alignItems="center"
              gap={10}
              backgroundColor={brand.sunken}
              borderRadius={12}
              padding={12}
            >
              <View
                width={22}
                height={22}
                borderRadius={11}
                backgroundColor={brand.primary}
                alignItems="center"
                justifyContent="center"
              >
                <Text color="#fff" fontSize={12} fontWeight="700">
                  {i + 1}
                </Text>
              </View>
              <View flex={1}>
                <Text fontSize={15} fontWeight="600" color={brand.ink}>
                  {p.name}
                </Text>
                {p.address && <Muted numberOfLines={1}>{p.address}</Muted>}
              </View>
              <Tappable onPress={() => setShortlist(shortlist.filter((_, j) => j !== i))}>
                <Ionicons name="close" size={18} color={brand.inkSoft} />
              </Tappable>
            </View>
          ))}

          {shortlist.length < 3 && (
            <Input
              size="$4"
              borderRadius={12}
              backgroundColor={brand.sunken}
              borderColor={brand.border}
              focusStyle={{ borderColor: brand.primary }}
              placeholder={placesEnabled ? 'Search a place…' : 'e.g. Dosa Corner'}
              value={query}
              onChangeText={setQuery}
            />
          )}

          {results.map((p) => (
            <Tappable key={p.placeId ?? p.name} onPress={() => addToShortlist(p)}>
              <View paddingVertical={10} borderBottomWidth={1} borderBottomColor={brand.border}>
                <Text fontSize={15} fontWeight="600" color={brand.ink}>
                  {p.name}
                </Text>
                {p.address && <Muted>{p.address}</Muted>}
              </View>
            </Tappable>
          ))}

          {/* Without a Places key, or when nothing matched, the typed text is
              still a perfectly good option. */}
          {query.trim().length > 0 && results.length === 0 && shortlist.length < 3 && (
            <NeutralButton
              label={`Add "${query.trim()}"`}
              onPress={() =>
                addToShortlist({ name: query.trim(), address: null, placeId: null, lat: null, lng: null })
              }
            />
          )}

          {error && <Text color={brand.danger} fontSize={14}>{error}</Text>}

          {shortlist.length > 0 && (
            <PushButton
              label={shortlist.length === 1 ? `Set "${shortlist[0].name}"` : `Put ${shortlist.length} places to a vote`}
              onPress={submit}
              busy={busy}
            />
          )}

          <Tappable
            onPress={() => {
              setPicking(false);
              setShortlist([]);
              setQuery('');
              setResults([]);
              setError(null);
            }}
          >
            <Text color={brand.inkSoft} fontSize={14} textAlign="center">
              Cancel
            </Text>
          </Tappable>
        </View>
      )}
    </Card>
  );
}
