import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Dream } from '@/lib/types';
import { colors, MOODS, radius, space } from '@/lib/theme';
import { formatLong } from '@/lib/dates';

export function DreamRow({ dream }: { dream: Dream }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/entry/[id]', params: { id: dream.id } })}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.title} numberOfLines={1}>
          {dream.title || 'Untitled dream'}
        </Text>
        <Text style={s.preview} numberOfLines={2}>
          {dream.body}
        </Text>
        <Text style={s.meta}>
          {formatLong(dream.dreamDate)}
          {dream.lucid ? ' · lucid' : ''}
          {dream.tags.length ? ` · ${dream.tags.slice(0, 3).join(', ')}` : ''}
        </Text>
      </View>
      {dream.mood !== null && <Text style={s.mood}>{MOODS[dream.mood]}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  preview: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.textMuted, fontSize: 12 },
  mood: { fontSize: 24 },
});
