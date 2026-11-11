import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { listDreams } from '@/lib/db';
import { usePremium } from '@/lib/purchases';
import { SAMPLE_DREAM_IMAGE } from '@/lib/sampleImage';
import { Body, Button, H1, Screen, Small } from '@/components/ui';
import { colors, radius, space } from '@/lib/theme';

/**
 * One-time "What's new" carousel for people who already used the app before dream images shipped.
 * New users see the same feature as a card in onboarding instead (both set `seen_images_intro`).
 */
export default function WhatsNew() {
  const db = useSQLiteContext();
  const { isPremium } = usePremium();
  const { width } = useWindowDimensions();
  const pageWidth = width - space.xl * 2;
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const slides = [
    {
      key: 'see',
      title: 'New: see your dreams',
      body: 'DreamPattern can now paint any dream you record, in the same dreamy style as the rest of your journal.',
      caption: '"Running from a storm toward a rainbow"',
    },
    {
      key: 'how',
      emoji: '✦',
      title: 'One tap on any dream',
      body: 'Open a dream and tap "Visualize this dream". In a few seconds it becomes a painting you can keep or share with your reading.',
    },
    {
      key: 'free',
      emoji: '🎁',
      title: isPremium ? 'Included in your Premium' : 'Your first one is free',
      body: isPremium
        ? 'Premium includes up to 30 dream images a month. Images are saved only on this phone.'
        : 'Try it on any dream at no cost. Premium members get up to 30 a month. Images are saved only on this phone.',
    },
  ];
  const last = page === slides.length - 1;

  const goTo = (i: number) => {
    scroller.current?.scrollTo({ x: i * pageWidth, animated: true });
    setPage(i);
  };

  const tryIt = async () => {
    const [latest] = await listDreams(db, { limit: 1 });
    router.back();
    if (latest) router.push(`/entry/${latest.id}`);
    else router.push('/capture');
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <View style={{ alignItems: 'flex-end' }}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={{ color: colors.textDim, fontSize: 16 }}>Not now</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
      >
        {slides.map((s) => (
          <View key={s.key} style={{ width: pageWidth, justifyContent: 'center', gap: space.lg }}>
            {s.key === 'see' ? (
              <Image
                source={SAMPLE_DREAM_IMAGE}
                style={{ width: '100%', maxHeight: 360, aspectRatio: 4 / 5, alignSelf: 'center', borderRadius: radius.lg }}
                resizeMode="cover"
                accessibilityLabel="Example dream painting: a child running across a meadow toward a sunrise and a rainbow, away from a storm"
              />
            ) : (
              <Text style={{ fontSize: 64, textAlign: 'center', color: colors.gold }}>{s.emoji}</Text>
            )}
            {s.caption && <Small style={{ textAlign: 'center', fontStyle: 'italic' }}>{s.caption}</Small>}
            <H1 style={{ textAlign: 'center' }}>{s.title}</H1>
            <Body dim style={{ textAlign: 'center' }}>
              {s.body}
            </Body>
          </View>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: space.lg }}>
        {slides.map((s, i) => (
          <View
            key={s.key}
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.accent : colors.border }}
          />
        ))}
      </View>
      {last ? (
        <Button title="✦ Try it on a dream" onPress={tryIt} />
      ) : (
        <Button title="Next" onPress={() => goTo(page + 1)} />
      )}
    </Screen>
  );
}
