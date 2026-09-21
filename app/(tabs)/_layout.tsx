import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppearance } from '@/lib/appearance';
import { brand } from '@/lib/theme';

/** Content height of the bar, before the device's bottom inset. */
export const TAB_BAR_HEIGHT = 76;

export default function TabsLayout() {
  // The bar has to clear the home indicator, or the labels get clipped.
  const insets = useSafeAreaInsets();
  // React Navigation memoises screen options, so a parent re-render alone does
  // not restyle the bar. Subscribing to the appearance context does.
  const { scheme } = useAppearance();

  return (
    <Tabs
      key={scheme}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: brand.inkSoft,
        tabBarStyle: {
          backgroundColor: brand.surface,
          borderTopColor: brand.border,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom + 12,
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 4, lineHeight: 14 },
        tabBarIconStyle: { marginTop: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'albums' : 'albums-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
