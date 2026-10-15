import { useEffect, useState } from 'react';
import { Text, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting } from '@/lib/db';
import { colors } from '@/lib/theme';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => (
  <Text style={{ fontSize: 20, color }}>{glyph}</Text>
);

export default function TabsLayout() {
  const db = useSQLiteContext();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    getSetting(db, 'onboarded').then((v) => setOnboarded(v === '1'));
  }, [db]);

  if (onboarded === null) return null;
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('🌙') }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('📖') }} />
      <Tabs.Screen name="patterns" options={{ title: 'Patterns', tabBarIcon: icon('✦') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('⚙︎') }} />
    </Tabs>
  );
}
