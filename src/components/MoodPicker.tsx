import { Pressable, Text } from 'react-native';
import { colors, MOODS, radius } from '@/lib/theme';
import { Row } from './ui';

export function MoodPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      {MOODS.map((m, i) => (
        <Pressable
          key={m}
          accessibilityLabel={`Mood ${i + 1} of 5`}
          onPress={() => onChange(value === i ? null : i)}
          style={{
            padding: 8,
            borderRadius: radius.md,
            backgroundColor: value === i ? colors.accentSoft : 'transparent',
          }}
        >
          <Text style={{ fontSize: 30, opacity: value === null || value === i ? 1 : 0.4 }}>{m}</Text>
        </Pressable>
      ))}
    </Row>
  );
}
