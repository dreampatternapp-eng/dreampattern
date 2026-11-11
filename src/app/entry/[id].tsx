import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { deleteDream, getDream, getDreamImageFile, getInterpretation, getSetting, removeDreamImage, setSetting } from '@/lib/db';
import { imageExists, imageUri } from '@/lib/imageFiles';
import { ImageCapError, ImagePremiumRequiredError, VisualizeError, visualizeDream } from '@/lib/visualize';
import { SUPPORT_EMAIL } from '@/lib/config';
import { InterpretError, QuotaExceededError, interpretDream } from '@/lib/interpret';
import { usePremium } from '@/lib/purchases';
import { maybeAskForReview } from '@/lib/review';
import type { Dream, Interpretation } from '@/lib/types';
import { formatLong } from '@/lib/dates';
import { colors, MOODS, radius, space } from '@/lib/theme';
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
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [freeImageUsed, setFreeImageUsed] = useState(false);
  const [painting, setPainting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [d, i, img, freeUsed] = await Promise.all([
      getDream(db, id),
      getInterpretation(db, id),
      getDreamImageFile(db, id),
      getSetting(db, 'free_image_used'),
    ]);
    setDream(d);
    setInterp(i);
    setImageFile(img);
    setFreeImageUsed(freeUsed === '1');
    return { d, i };
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runInterpretation = useCallback(async () => {
    if (!dream || !appUserId) return;
    if ((await getSetting(db, 'ai_consent')) !== '1') {
      if (!(await askAiConsent())) return;
      await setSetting(db, 'ai_consent', '1');
    }
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

  const openImagePaywall = useCallback(async () => {
    // The user's own first image is the hero picture on the paywall.
    const first = await getSetting(db, 'free_image_file');
    router.push({ pathname: '/paywall', params: { reason: 'image', image: first && imageExists(first) ? first : '' } });
  }, [db]);

  const runVisualize = useCallback(async () => {
    if (!dream || !appUserId) return;
    if (!isPremium && freeImageUsed) return openImagePaywall();
    if ((await getSetting(db, 'ai_image_consent')) !== '1') {
      if (!(await askImageConsent())) return;
      await setSetting(db, 'ai_image_consent', '1');
    }
    setPainting(true);
    setImageError(null);
    try {
      const { file } = await visualizeDream(db, dream, { appUserId });
      setImageFile(file);
      if (!isPremium) {
        await setSetting(db, 'free_image_used', '1');
        await setSetting(db, 'free_image_file', file);
        setFreeImageUsed(true);
      }
    } catch (e) {
      if (e instanceof ImagePremiumRequiredError) {
        await setSetting(db, 'free_image_used', '1');
        setFreeImageUsed(true);
        openImagePaywall();
      } else if (e instanceof ImageCapError || e instanceof VisualizeError) {
        setImageError(e.message);
      } else {
        setImageError('Something went wrong. Please try again.');
      }
    } finally {
      setPainting(false);
    }
  }, [db, dream, appUserId, isPremium, freeImageUsed, openImagePaywall]);

  const shareImage = async () => {
    if (!imageFile) return;
    try {
      await Sharing.shareAsync(imageUri(imageFile), { mimeType: 'image/jpeg', dialogTitle: 'Share your dream image' });
    } catch {
      Alert.alert("Couldn't share the image", 'Please try again.');
    }
  };

  // Apple 1.2: users can report AI-generated content and remove it.
  const reportImage = () =>
    Alert.alert('Report or remove this image?', 'Tell us if the picture is offensive or inappropriate, or just remove it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report to DreamPattern',
        onPress: () =>
          Linking.openURL(
            `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Report a dream image')}&body=${encodeURIComponent(
              'What was wrong with the image? (Please attach a screenshot if you can.)\n\n',
            )}`,
          ).catch(() => Alert.alert('Email us', `Send the report to ${SUPPORT_EMAIL}.`)),
      },
      {
        text: 'Remove image',
        style: 'destructive',
        onPress: async () => {
          await removeDreamImage(db, id);
          setImageFile(null);
        },
      },
    ]);

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

      {imageFile && !painting && (
        <>
          <Image
            source={{ uri: imageUri(imageFile) }}
            style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: radius.lg, backgroundColor: colors.card }}
            accessibilityLabel="AI-generated picture of this dream"
          />
          <Small style={{ textAlign: 'center' }}>AI-generated image</Small>
          <Row style={{ justifyContent: 'space-between' }}>
            <Button title="Share image" variant="secondary" onPress={shareImage} />
            {isPremium && <Button title="Redraw" variant="ghost" onPress={runVisualize} />}
            <Button title="Report" variant="ghost" onPress={reportImage} />
          </Row>
        </>
      )}

      {painting && (
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <ActivityIndicator color={colors.gold} />
          <Body dim>Painting your dream… this takes a few seconds.</Body>
        </Card>
      )}

      {imageError && !painting && (
        <Card style={{ borderColor: colors.danger }}>
          <Body>{imageError}</Body>
        </Card>
      )}

      {!imageFile && !painting && (
        <Button
          title={
            isPremium ? '✦ Visualize this dream' : freeImageUsed ? '✦ Visualize this dream (Premium)' : '✦ Visualize this dream, first one free'
          }
          variant="secondary"
          onPress={runVisualize}
          disabled={!ready}
        />
      )}

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
            {imageFile && (
              <Image
                source={{ uri: imageUri(imageFile) }}
                style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md, marginBottom: space.sm }}
              />
            )}
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

// Apple 5.1.2(i): images add a second AI provider (Google), so they get their own consent.
function askImageConsent(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Turn this dream into a picture?',
      'Your dream text is sent to our AI provider, Anthropic, which writes a short scene description without names. ' +
        'Only that description is sent to Google\'s image model to paint the picture. Neither company uses it to train AI ' +
        '(Google may keep it briefly for abuse checks), and our server stores neither the dream nor the picture. The image is saved only on this phone.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

// Apple 5.1.2(i): ask before dream text goes to a third-party AI.
function askAiConsent(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Send this dream for a reading?',
      'To write a reading, your dream text is sent to our AI provider, Anthropic. Our server does not store it. ' +
        'Anthropic may keep it for up to 30 days for safety checks, then deletes it, and does not use it for training. ' +
        'Your journal itself stays on this phone.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
