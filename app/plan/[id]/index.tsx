import { useState } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'tamagui';
import { RoadmapPanel } from '@/components/plan/RoadmapPanel';
import { VotingPanel } from '@/components/plan/VotingPanel';
import { ChatPanel } from '@/components/plan/ChatPanel';
import { DetailsPanel } from '@/components/plan/DetailsPanel';
import { Loader, Screen, Tappable } from '@/components/ui';
import { brand, radius } from '@/lib/theme';

const SECTIONS = [
  { key: 'roadmap', label: 'Plan', icon: 'git-commit-outline' },
  { key: 'voting', label: 'Vote', icon: 'checkbox-outline' },
  { key: 'chat', label: 'Chat', icon: 'chatbubbles-outline' },
  { key: 'details', label: 'Details', icon: 'people-outline' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

/**
 * One screen for a whole plan. The four sections are a segmented control
 * rather than a tab bar: a nested tab navigator inside this dynamic route
 * broke on web, and a detail view with a handful of sections is what iOS uses
 * a segmented control for anyway.
 */
export default function PlanScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const [section, setSection] = useState<SectionKey>('roadmap');

  if (!id) return <Loader />;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View
          flexDirection="row"
          alignItems="center"
          paddingHorizontal={12}
          paddingVertical={8}
          gap={4}
          backgroundColor={brand.surface}
          borderBottomWidth={1}
          borderBottomColor={brand.border}
        >
          <Tappable onPress={() => router.back()}>
            <View padding={6}>
              <Ionicons name="chevron-back" size={26} color={String(brand.ink)} />
            </View>
          </Tappable>

          {/* Segmented control, iOS style: one sliding pill inside a track. */}
          <View
            flex={1}
            flexDirection="row"
            backgroundColor={brand.sunken}
            borderRadius={radius.pill}
            padding={3}
          >
            {SECTIONS.map((s) => {
              const active = section === s.key;
              return (
                // A plain Pressable, not Tappable: Tappable puts its style on an
                // inner animated view, so the flex never reached the pressable
                // itself. On web the segments still got width from the row; on a
                // device they collapsed to nothing and the bar looked empty.
                // The inner View needs no flex — a View's children stretch to its
                // width by default.
                <Pressable key={s.key} onPress={() => setSection(s.key)} style={{ flex: 1 }}>
                  <View
                    flexDirection="row"
                    gap={5}
                    alignItems="center"
                    justifyContent="center"
                    paddingVertical={9}
                    borderRadius={radius.pill}
                    backgroundColor={active ? brand.surface : 'transparent'}
                    shadowColor={brand.ink}
                    shadowOpacity={active ? 0.08 : 0}
                    shadowRadius={6}
                    shadowOffset={{ width: 0, height: 2 }}
                  >
                    <Ionicons
                      name={s.icon}
                      size={14}
                      color={String(active ? brand.primary : brand.inkSoft)}
                    />
                    <Text fontSize={12} fontWeight="800" color={active ? brand.ink : brand.inkSoft}>
                      {s.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Each panel is mounted only while it is shown, so its queries and
            realtime subscription come and go with it. */}
        <View flex={1}>
          {section === 'roadmap' && <RoadmapPanel id={id} />}
          {section === 'voting' && <VotingPanel id={id} />}
          {section === 'chat' && <ChatPanel id={id} />}
          {section === 'details' && <DetailsPanel id={id} />}
        </View>
      </SafeAreaView>
    </Screen>
  );
}
