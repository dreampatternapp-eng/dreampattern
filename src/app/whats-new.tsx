import { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { listDreams, setSetting } from '@/lib/db';
import { Body, Button, H1, Screen } from '@/components/ui';
import { SAMPLE_DREAM_IMAGE, WHATS_NEW_KEY } from '@/lib/whatsNew';
import { colors, radius, space } from '@/lib/theme';


const a = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.lg,
  },
  big: { fontSize: 88 },
  sparkle: { color: colors.gold, fontSize: 22, letterSpacing: 6 },
  mockText: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: space.md, alignSelf: 'stretch' },
  mockLine: { color: colors.textDim, fontSize: 14 },
  mockButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  mockButtonText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: space.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
});

type Slide = { title: string; body: string; art: React.ReactNode };

const SLIDES: Slide[] = [
  {
    title: 'New: dream images',
    body: 'Turn any dream into a painting. DreamPattern paints the scene in a soft, dreamlike style you can keep with your entry.',
    art: (
      <Image
        source={SAMPLE_DREAM_IMAGE}
        style={{ alignSelf: 'center', width: 232, height: 290, borderRadius: radius.lg }}
        resizeMode="cover"
        accessibilityLabel="Example dream painting: a child running across a meadow toward a sunrise and a rainbow, away from a storm"
      />
    ),
  },
  {
    title: 'One tap from any dream',
    body: 'Open a saved dream and tap Visualize. Your dream is rewritten into a safe scene first, so the picture never includes names or real people.',
    art: (
      <View style={a.frame}>
        <View style={a.mockText}>
          <Text style={a.mockLine}>I was running toward a rainbow…</Text>
        </View>
        <View style={a.mockButton}>
          <Text style={a.mockButtonText}>✦ Visualize this dream</Text>
        </View>
      </View>
    ),
  },
  {
    title: 'Your first one is free',
    body: 'Try it on any dream. Premium members get up to 30 images a month. Images stay on your phone, and you can share them with your reading.',
    art: (
      <View style={[a.frame, { backgroundColor: '#3A2F7A' }]}>
        <Text style={a.big}>🎁</Text>
      </View>
    ),
  },
];

/** One-time carousel that introduces dream images to people updating from 1.0. */
export default function WhatsNew() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const pageWidth = width - space.xl * 2;
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const close = async (tryIt: boolean) => {
    await setSetting(db, WHATS_NEW_KEY, '1');
    router.back();
    if (!tryIt) return;
    const [latest] = await listDreams(db, { limit: 1 });
    if (latest) router.push({ pathname: '/entry/[id]', params: { id: latest.id } });
    else router.push('/capture');
  };

  const next = () => {
    if (last) return close(true);
    scroller.current?.scrollTo({ x: (page + 1) * pageWidth, animated: true });
    setPage(page + 1);
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
        style={{ flex: 1 }}
      >
        {SLIDES.map((sl) => (
          <View key={sl.title} style={{ width: pageWidth, justifyContent: 'center', gap: space.lg }}>
            {sl.art}
            <H1 style={{ textAlign: 'center' }}>{sl.title}</H1>
            <Body dim style={{ textAlign: 'center' }}>
              {sl.body}
            </Body>
          </View>
        ))}
      </ScrollView>
      <View style={a.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[a.dot, i === page && { backgroundColor: colors.accent }]} />
        ))}
      </View>
      <Button title={last ? 'Try it on a dream' : 'Next'} onPress={next} />
      <Button title="Maybe later" variant="ghost" onPress={() => close(false)} />
    </Screen>
  );
}
