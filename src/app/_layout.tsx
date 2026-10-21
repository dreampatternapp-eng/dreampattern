import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DB_NAME, migrate } from '@/lib/db';
import { PremiumProvider } from '@/lib/purchases';
import { LockGate } from '@/components/LockGate';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
        <PremiumProvider>
          <LockGate>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
              <Stack.Screen name="capture" options={{ presentation: 'modal', title: "Last night's dream" }} />
              <Stack.Screen name="entry/[id]" options={{ title: '', headerBackButtonDisplayMode: 'minimal' }} />
              <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
            </Stack>
          </LockGate>
        </PremiumProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
