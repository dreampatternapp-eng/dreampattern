import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { interpretedDreamCount, listDreams, topElements } from '@/lib/db';
import { cap, weeklyInsight } from '@/lib/insights';
import { usePremium } from '@/lib/purchases';
import { FREE_PATTERN_ITEMS } from '@/lib/config';
import type { PatternItem } from '@/lib/types';
import { colors, radius, space } from '@/lib/theme';
import { daysAgo } from '@/lib/dates';
import { Body, Button, Card, Chip, H1, H2, Row, Screen, Small } from '@/components/ui';

const SECTIONS: { kind: PatternItem['kind']; title: string }[] = [
  { kind: 'symbol', title: 'Symbols' },
  { kind: 'person', title: 'People' },
  { kind: 'place', title: 'Places' },
  { kind: 'emotion', title: 'Emotions' },
];

export default function Patterns() {
  const db = useSQLiteContext();
  const { isPremium } = usePremium();
  const [days, setDays] = useState<30 | 90>(30);
  const [items, setItems] = useState<PatternItem[]>([]);
  const [count, setCount] = useState(0);
  const [insight, setInsight] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [all, n, week, weekDreams] = await Promise.all([
          topElements(db, days, 80),
          interpretedDreamCount(db, days),
          topElements(db, 7),
          listDreams(db).then((ds) => ds.filter((d) => d.dreamDate > daysAgo(7)).length),
        ]);
        setItems(all);
        setCount(n);
        setInsight(weeklyInsight(week, weekDreams));
      })();
    }, [db, days]),
  );

  const max = Math.max(1, ...items.map((i) => i.count));

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>Patterns</H1>
        <Row>
          <Chip label="30 days" selected={days === 30} onPress={() => setDays(30)} />
          <Chip label="90 days" selected={days === 90} onPress={() => setDays(90)} />
        </Row>
      </Row>
      <Small>
        Based on {count} interpreted dream{count === 1 ? '' : 's'} in the last {days} days.
      </Small>

      {count === 0 && (
        <Card>
          <Body dim>Interpret a few dreams and your recurring symbols, people, places and feelings will show here.</Body>
        </Card>
      )}

      {isPremium && insight && (
        <Card style={{ borderColor: colors.gold }}>
          <H2 style={{ color: colors.gold }}>Weekly insight</H2>
          <Body>{insight}</Body>
        </Card>
      )}

      {SECTIONS.map(({ kind, title }) => {
        const list = items.filter((i) => i.kind === kind);
        if (!list.length) return null;
        // Free tier: top-3 symbols only, other sections locked.
        const visible = isPremium ? list.slice(0, 10) : kind === 'symbol' ? list.slice(0, FREE_PATTERN_ITEMS) : [];
        return (
          <Card key={kind}>
            <H2>{title}</H2>
            {visible.map((p) => (
              <Pressable
                key={p.name}
                onPress={() => router.push({ pathname: '/journal', params: { element: p.name } })}
                style={{ gap: 4 }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={s.name}>{cap(p.name)}</Text>
                  <Text style={s.count}>
                    {p.count}× {trend(p)}
                  </Text>
                </Row>
                <View style={s.track}>
                  <View style={[s.bar, { width: `${(p.count / max) * 100}%` }]} />
                </View>
              </Pressable>
            ))}
            {visible.length < Math.min(list.length, 10) && (
              <Small>{isPremium ? '' : `${list.length - visible.length} more with Premium`}</Small>
            )}
          </Card>
        );
      })}

      {!isPremium && count > 0 && (
        <Card>
          <H2>See your full patterns</H2>
          <Body dim>
            Premium shows every recurring symbol, person, place and feeling, with trends and a weekly insight.
          </Body>
          <Button title="Try Premium" onPress={() => router.push('/paywall')} />
        </Card>
      )}
    </Screen>
  );
}

function trend(p: PatternItem) {
  if (p.count > p.previousCount) return '↑';
  if (p.count < p.previousCount) return '↓';
  return '→';
}

const s = StyleSheet.create({
  name: { color: colors.text, fontSize: 16 },
  count: { color: colors.textDim, fontSize: 14 },
  track: { height: 6, backgroundColor: colors.cardAlt, borderRadius: radius.pill, overflow: 'hidden' },
  bar: { height: 6, backgroundColor: colors.accent, borderRadius: radius.pill },
});
