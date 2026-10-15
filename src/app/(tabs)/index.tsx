import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { currentStreak, listDreams, topElements } from '@/lib/db';
import { weeklyInsight } from '@/lib/insights';
import { usePremium } from '@/lib/purchases';
import type { Dream } from '@/lib/types';
import { colors, space } from '@/lib/theme';
import { DreamRow } from '@/components/DreamRow';
import { Body, Button, Card, H1, H2, Row, Screen, Small } from '@/components/ui';
import { daysAgo } from '@/lib/dates';

export default function Home() {
  const db = useSQLiteContext();
  const { isPremium } = usePremium();
  const [recent, setRecent] = useState<Dream[]>([]);
  const [streak, setStreak] = useState(0);
  const [insight, setInsight] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [r, s, week, weekDreams] = await Promise.all([
          listDreams(db, { limit: 5 }),
          currentStreak(db),
          topElements(db, 7),
          listDreams(db).then((all) => all.filter((d) => d.dreamDate > daysAgo(7)).length),
        ]);
        setRecent(r);
        setStreak(s);
        setInsight(weeklyInsight(week, weekDreams));
      })();
    }, [db]),
  );

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>Good morning</H1>
        {streak > 0 && <Text style={s.streak}>🔥 {streak} day{streak === 1 ? '' : 's'}</Text>}
      </Row>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Record last night's dream"
        onPress={() => router.push({ pathname: '/capture', params: { voice: '1' } })}
        style={({ pressed }) => [s.capture, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        <Text style={{ fontSize: 56 }}>🎙️</Text>
        <Text style={s.captureTitle}>Last night's dream</Text>
        <Text style={s.captureSub}>Tap and speak before it fades</Text>
      </Pressable>
      <Button title="Type it instead" variant="ghost" onPress={() => router.push('/capture')} />

      {insight && (
        <Card>
          <H2>This week</H2>
          {isPremium ? (
            <Body>{insight}</Body>
          ) : (
            <>
              <Body dim>Your weekly insight is ready.</Body>
              <Button title="Unlock weekly insights" variant="secondary" onPress={() => router.push('/paywall')} />
            </>
          )}
        </Card>
      )}

      {recent.length > 0 && (
        <View style={{ gap: space.sm }}>
          <H2>Recent dreams</H2>
          {recent.map((d) => (
            <DreamRow key={d.id} dream={d} />
          ))}
        </View>
      )}
      {recent.length === 0 && <Small style={{ textAlign: 'center' }}>Your dreams will appear here.</Small>}
    </Screen>
  );
}

const s = StyleSheet.create({
  streak: { color: colors.gold, fontSize: 16, fontWeight: '600' },
  capture: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 28,
    paddingVertical: space.xxl,
    alignItems: 'center',
    gap: space.sm,
  },
  captureTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  captureSub: { color: colors.textDim, fontSize: 15 },
});
