import { SafeAreaView } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'tamagui';
import { brand } from '@/lib/theme';
import { Tappable } from '@/components/ui';

/** Per-plan tab set, nested inside the app-level tabs. */
export default function PlanLayout() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: brand.bg }} edges={['top']}>
      <View
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal={14}
        paddingVertical={10}
        borderBottomWidth={1}
        borderBottomColor={brand.border}
        backgroundColor={brand.surface}
      >
        <Tappable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={brand.ink} />
        </Tappable>
        <Text fontSize={16} fontWeight="700" color={brand.ink}>Plan</Text>
        <View width={26} />
      </View>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: brand.primary,
          tabBarInactiveTintColor: brand.inkSoft,
          tabBarStyle: { backgroundColor: brand.surface, borderTopColor: brand.border, height: 60, paddingBottom: 6, paddingTop: 6 },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Roadmap', tabBarIcon: ({ color, size }) => <Ionicons name="git-commit-outline" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="voting"
          options={{ title: 'Voting', tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="chat"
          options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="details"
          options={{ title: 'Details', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }}
        />
        {/* Reached from Roadmap/Voting, not a tab of its own. */}
        <Tabs.Screen name="availability" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}
