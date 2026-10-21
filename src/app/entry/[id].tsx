import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { deleteDream, getDream, getInterpretation, getSetting, setSetting } from '@/lib/db';
import { InterpretError, QuotaExceededError, interpretDream } from '@/lib/interpret';
import { usePremium } from '@/lib/purchases';
import { maybeAskForReview } from '@/lib/review';
import type { Dream, Interpretation } from '@/lib/types';
import { formatLong } from '@/lib/dates';
import { colors, MOODS, space } from '@/lib/theme';
import { InterpretationView } from '@/components/InterpretationView';
import { Body, Button, Card, Chip, Disclaimer, H1, Row, Screen, Small } from '@/components/ui';

export default function EntryDetail() {
  const db = useSQLiteContext();
  const { id, interpret } = useLocalSearchParams<{ id: string; interpret?: string }>();
  const { appUserId, isPremium, ready } = usePremium();
  const [dream, setDream] = useState<Dream | null>(null);
  const [interp, setInterp] = useState<Interpretation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);
  const quotaBlocked = useRef(false);
  const shareRef = useRef<View>(null);

  const load = useCallback(async () => {
    const [d, i] = await Promise.all([getDream(db, id), getInterpretation(db, id)]);
    setDream(d);
    setInterp(i);
    return { d, i };
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runInterpretation = useCallback(async () => {
    if (!dream || !appUserId) return;
    setLoading(true);
    setError(null);
    try {
      const { interpretation } = await interpretDream(db, dream, { appUserId, isPremium });
      setInterp(interpretation);
      setDream((await getDream(db, id)) ?? dream);
      // Paywall comes after the first reading has been delivered, once.
      if (!isPremium && (await getSetting(db, 'paywall_intro_shown')) !== '1') {
        await setSetting(db, 'paywall_intro_shown', '1');
        setTimeout(() => router.push({ pathname: '/paywall', params: { reason: 'intro' } }), 2500);
      } else {
        setTimeout(() => maybeAskForReview(db), 2500);
      }
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        quotaBlocked.current = true;
        setError(`You've used your ${e.limit} free readings this month.`);
        router.push({ pathname: '/paywall', params: { reason: 'quota' } });
      } else {
        setError(e instanceof InterpretError ? e.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [db, dream, appUserId, isPremium, id]);

  useEffect(() => {
    if (interpret === '1' && ready && dream && !interp && !autoRan.current) {
      autoRan.current = true;
      runInterpretation();
    }
  }, [interpret, ready, dream, interp, runInterpretation]);

  // Subscribing from the paywall after hitting the free limit should deliver the reading that was blocked.
  useEffect(() => {
    if (isPremium && quotaBlocked.current && !interp && dream && !loading) {
      quotaBlocked.current = false;
      runInterpretation();
    }
  }, [isPremium, interp, dream, loading, runInterpretation]);

  const share = async () => {
    try {
      const uri = await captureRef(shareRef, { format: 'png', quality: 0.95 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share this reading' });
    } catch {
      Alert.alert("Couldn't create the image", 'Please try again.');
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this dream?', 'This removes the dream and its reading from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDream(db, id);
          router.back();
        },
      },
    ]);

  if (!dream) return <Screen>{null}</Screen>;

  return (
    <Screen edges={['bottom']}>
      <H1>{dream.title || 'Untitled dream'}</H1>
      <Small>
        {formatLong(dream.dreamDate)}
        {dream.mood !== null ? `  ${MOODS[dream.mood]}` : ''}
        {dream.lucid ? '  · lucid' : ''}
      </Small>
      {dream.tags.length > 0 && (
        <Row style={{ flexWrap: 'wrap' }}>
          {dream.tags.map((t) => (
            <Chip key={t} label={t} onPress={() => router.push({ pathname: '/journal', params: { tag: t } })} />
          ))}
        </Row>
      )}
      <Card>
        <Body>{dream.body}</Body>
      </Card>

      {loading && (
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <ActivityIndicator color={colors.accent} />
          <Body dim>Reading your dream…</Body>
        </Card>
      )}

      {error && !loading && (
        <Card style={{ borderColor: colors.danger }}>
          <Body>{error}</Body>
          <Button title="Try again" variant="secondary" onPress={runInterpretation} />
        </Card>
      )}

      {!interp && !loading && !error && (
        <Button title="Interpret this dream" onPress={runInterpretation} disabled={!ready} />
      )}

      {interp && (
        <>
          <View ref={shareRef} collapsable={false} style={{ backgroundColor: colors.bg, padding: space.sm }}>
            <InterpretationView i={interp} />
            <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: 12 }}>
              Interpreted with DreamPattern · dreampattern.app
            </Text>
          </View>
          <Button title="Share as image" variant="secondary" onPress={share} />
          <Disclaimer />
        </>
      )}

      <Row style={{ justifyContent: 'space-between', marginTop: space.lg }}>
        <Button
          title="Edit"
          variant="ghost"
          onPress={() => router.push({ pathname: '/capture', params: { id: dream.id } })}
        />
        {interp && !loading && <Button title="Re-interpret" variant="ghost" onPress={runInterpretation} />}
        <Button title="Delete" variant="ghost" onPress={confirmDelete} />
      </Row>
    </Screen>
  );
}
