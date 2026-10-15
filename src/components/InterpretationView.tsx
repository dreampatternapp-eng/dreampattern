import { View } from 'react-native';
import type { Interpretation } from '@/lib/types';
import { colors, space } from '@/lib/theme';
import { Body, Card, H2, Small } from './ui';

const KIND_ICON = { symbol: '✦', person: '👤', place: '📍' } as const;

export function InterpretationView({ i }: { i: Interpretation }) {
  return (
    <View style={{ gap: space.md, backgroundColor: colors.bg, paddingVertical: space.sm }}>
      <Card>
        <H2>The reading</H2>
        <Body>{i.summary}</Body>
      </Card>

      {i.symbols.length > 0 && (
        <Card>
          <H2>Symbols</H2>
          {i.symbols.map((s) => (
            <View key={`${s.kind}:${s.name}`} style={{ gap: 2, marginTop: space.xs }}>
              <Body style={{ fontWeight: '600' }}>
                {KIND_ICON[s.kind]} {s.name}
              </Body>
              <Body dim>{s.meaning}</Body>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <H2>Emotional tone</H2>
        <Body>{i.tone}</Body>
        {i.emotions.length > 0 && <Small>{i.emotions.join(' · ')}</Small>}
      </Card>

      {i.patternCallback && (
        <Card style={{ borderColor: colors.gold }}>
          <H2 style={{ color: colors.gold }}>Your pattern</H2>
          <Body>{i.patternCallback}</Body>
        </Card>
      )}
    </View>
  );
}
