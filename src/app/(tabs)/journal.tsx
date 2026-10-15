import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { allTags, listDreams } from '@/lib/db';
import type { Dream } from '@/lib/types';
import { toISODate } from '@/lib/dates';
import { colors, radius, space } from '@/lib/theme';
import { DreamRow } from '@/components/DreamRow';
import { Body, Chip, H1, Row, Screen, Small } from '@/components/ui';

export default function Journal() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ tag?: string; element?: string }>();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | undefined>(params.tag);
  const [element, setElement] = useState<string | undefined>(params.element);
  const [tags, setTags] = useState<string[]>([]);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Pick up filters passed in from other screens (e.g. tapping a tag or a pattern).
  useFocusEffect(
    useCallback(() => {
      if (params.tag) setTag(params.tag);
      if (params.element) setElement(params.element);
    }, [params.tag, params.element]),
  );

  useFocusEffect(
    useCallback(() => {
      allTags(db).then(setTags);
      listDreams(db, { search, tag, element }).then(setDreams);
    }, [db, search, tag, element]),
  );

  const clearFilters = () => {
    setTag(undefined);
    setElement(undefined);
    router.setParams({ tag: undefined, element: undefined });
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>Journal</H1>
        <Row>
          <Chip label="List" selected={view === 'list'} onPress={() => setView('list')} />
          <Chip label="Calendar" selected={view === 'calendar'} onPress={() => setView('calendar')} />
        </Row>
      </Row>

      <TextInput
        style={s.search}
        placeholder="Search your dreams"
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        clearButtonMode="while-editing"
      />

      {tags.length > 0 && (
        <Row style={{ flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <Chip key={t} label={t} selected={tag === t} onPress={() => setTag(tag === t ? undefined : t)} />
          ))}
        </Row>
      )}
      {(tag || element) && (
        <Pressable onPress={clearFilters}>
          <Small>
            Showing {element ? `dreams with "${element}"` : `#${tag}`} · tap to clear
          </Small>
        </Pressable>
      )}

      {view === 'calendar' && (
        <Calendar
          month={month}
          setMonth={setMonth}
          dreams={dreams}
          selected={selectedDay}
          onSelect={(d) => setSelectedDay(selectedDay === d ? null : d)}
        />
      )}

      <View style={{ gap: space.sm }}>
        {(view === 'calendar' && selectedDay ? dreams.filter((d) => d.dreamDate === selectedDay) : dreams).map((d) => (
          <DreamRow key={d.id} dream={d} />
        ))}
        {dreams.length === 0 && <Body dim style={{ textAlign: 'center' }}>No dreams match yet.</Body>}
      </View>
    </Screen>
  );
}

function Calendar({
  month,
  setMonth,
  dreams,
  selected,
  onSelect,
}: {
  month: Date;
  setMonth: (d: Date) => void;
  dreams: Dream[];
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  const withDreams = useMemo(() => new Set(dreams.map((d) => d.dreamDate)), [dreams]);
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstWeekday = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <View style={s.cal}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => setMonth(new Date(year, m - 1, 1))} hitSlop={12}>
          <Text style={s.calNav}>‹</Text>
        </Pressable>
        <Text style={s.calTitle}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => setMonth(new Date(year, m + 1, 1))} hitSlop={12}>
          <Text style={s.calNav}>›</Text>
        </Pressable>
      </Row>
      <View style={s.grid}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={[s.cell, s.weekday]}>
            {d}
          </Text>
        ))}
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={s.cell} />;
          const iso = toISODate(new Date(year, m, day));
          const has = withDreams.has(iso);
          return (
            <Pressable key={i} style={s.cell} onPress={() => has && onSelect(iso)}>
              <View style={[s.day, has && s.dayHas, selected === iso && s.daySelected]}>
                <Text style={{ color: has ? colors.text : colors.textMuted }}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  search: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cal: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, gap: space.sm },
  calNav: { color: colors.accent, fontSize: 28, paddingHorizontal: space.md },
  calTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: colors.textMuted, textAlign: 'center', textAlignVertical: 'center', fontSize: 12 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayHas: { backgroundColor: colors.accentSoft },
  daySelected: { backgroundColor: colors.accent },
});
