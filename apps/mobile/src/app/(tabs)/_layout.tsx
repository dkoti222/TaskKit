import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUnreadCount } from '@/hooks/use-notifications';
import { colors, fonts } from '@/theme';

// Bottom tabs from the design: Home, Search, Alerts, Profile.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount().data ?? 0;
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
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ focused }) => <TabIcon name="search" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused }) => <TabIcon name="bell" focused={focused} />,
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            fontFamily: fonts.semibold,
            fontSize: 11,
          },
          tabBarAccessibilityLabel: unread > 0 ? `Alerts, ${unread} unread` : 'Alerts',
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

function TabIcon({
  name,
  focused,
}: {
  name: 'grid' | 'search' | 'bell' | 'user';
  focused: boolean;
}) {
  return <Feather name={name} size={22} color={focused ? colors.primary : colors.muted} />;
}
