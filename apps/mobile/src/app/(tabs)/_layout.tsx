import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

// Bottom tabs from the design. Search and Alerts are added once their APIs exist.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
        // Explicit height so icon + label fit; keep room for the home indicator.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.divider,
          height: 64 + insets.bottom,
          paddingTop: 2,
          paddingBottom: insets.bottom + 4,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, focused }: { name: 'grid' | 'user'; focused: boolean }) {
  return <Feather name={name} size={22} color={focused ? colors.primary : colors.muted} />;
}
