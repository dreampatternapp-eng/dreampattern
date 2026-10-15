import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { allTags, createDream, getDream, updateDream } from '@/lib/db';
import { lastNight, daysAgo, formatLong } from '@/lib/dates';
import { suggestTags } from '@/lib/tags';
import { colors, radius, space } from '@/lib/theme';
import { MoodPicker } from '@/components/MoodPicker';
import { Body, Button, Chip, Row, Screen, Small } from '@/components/ui';

export default function Capture() {
  const db = useSQLiteContext();
  const nav = useNavigation();
  const params = useLocalSearchParams<{ id?: string; voice?: string }>();
  const editingId = params.id;

  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [dreamDate, setDreamDate] = useState(lastNight());
  const [mood, setMood] = useState<number | null>(null);
  const [lucid, setLucid] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  // Dictation: text spoken in the current session is shown live after what was already there.
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const baseText = useRef('');

  useEffect(() => {
    nav.setOptions({ title: editingId ? 'Edit dream' : "Last night's dream" });
    allTags(db).then(setKnownTags);
    if (editingId) {
      getDream(db, editingId).then((d) => {
        if (!d) return;
        setBody(d.body);
        setTitle(d.title);
        setDreamDate(d.dreamDate);
        setMood(d.mood);
        setLucid(d.lucid);
        setTags(d.tags);
      });
    } else if (params.voice === '1') {
      startListening();
    }
    return () => ExpoSpeechRecognitionModule.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    setInterim('');
  });
  useSpeechRecognitionEvent('result', (e) => {
    const transcript = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      baseText.current = joinText(baseText.current, transcript);
      setBody(baseText.current);
      setInterim('');
    } else {
      setInterim(transcript);
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error !== 'aborted' && e.error !== 'no-speech') {
      Alert.alert('Dictation stopped', e.message || 'You can keep typing instead.');
    }
  });

  async function startListening() {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone off', 'Allow microphone and speech access in Settings to dictate. You can type instead.');
      return;
    }
    baseText.current = body;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      // On-device keeps audio off the network when the phone supports it.
      requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
    });
  }

  function stopListening() {
    ExpoSpeechRecognitionModule.stop();
  }

  const suggestions = useMemo(() => suggestTags(body, knownTags, tags), [body, knownTags, tags]);
  const shownText = interim ? joinText(body, interim) : body;

  const addTag = (t: string) => {
    const clean = t.trim().toLowerCase();
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
  };

  async function save() {
    if (listening) stopListening();
    const text = (interim ? joinText(body, interim) : body).trim();
    if (!text) {
      Alert.alert('Nothing to save yet', 'Say or type a few words about your dream.');
      return;
    }
    setSaving(true);
    try {
      const input = { title, body: text, dreamDate, mood, lucid, tags };
      if (editingId) {
        await updateDream(db, editingId, input);
        router.back();
      } else {
        const id = await createDream(db, input);
        router.replace({ pathname: '/entry/[id]', params: { id, interpret: '1' } });
      }
    } finally {
      setSaving(false);
    }
  }

  const dateOptions = [lastNight(), daysAgo(1, new Date(lastNight() + 'T12:00')), daysAgo(2, new Date(lastNight() + 'T12:00'))];

  return (
    <Screen edges={['bottom']}>
      <Pressable
        onPress={listening ? stopListening : startListening}
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop dictation' : 'Start dictation'}
        style={[s.mic, listening && { backgroundColor: colors.danger, borderColor: colors.danger }]}
      >
        <Text style={{ fontSize: 36 }}>{listening ? '⏹' : '🎙️'}</Text>
        <Text style={s.micText}>{listening ? 'Listening… tap to stop' : 'Tap to speak'}</Text>
      </Pressable>

      <TextInput
        style={s.bodyInput}
        multiline
        placeholder="I was in a house I didn't recognise…"
        placeholderTextColor={colors.textMuted}
        value={shownText}
        editable={!listening}
        onChangeText={(t) => {
          setBody(t);
          baseText.current = t;
        }}
        textAlignVertical="top"
      />

      <TextInput
        style={s.input}
        placeholder="Title (optional, we'll suggest one)"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
      />

      <Small>Date</Small>
      <Row style={{ flexWrap: 'wrap' }}>
        {dateOptions.map((d, i) => (
          <Chip
            key={d}
            label={i === 0 ? 'Last night' : formatLong(d)}
            selected={dreamDate === d}
            onPress={() => setDreamDate(d)}
          />
        ))}
        {!dateOptions.includes(dreamDate) && <Chip label={formatLong(dreamDate)} selected />}
      </Row>

      <Small>How did you feel on waking?</Small>
      <MoodPicker value={mood} onChange={setMood} />

      <Row style={{ justifyContent: 'space-between' }}>
        <Body>Lucid dream</Body>
        <Switch value={lucid} onValueChange={setLucid} trackColor={{ true: colors.accent }} />
      </Row>

      <Small>Tags</Small>
      <Row style={{ flexWrap: 'wrap' }}>
        {tags.map((t) => (
          <Chip key={t} label={`${t} ✕`} selected onPress={() => setTags(tags.filter((x) => x !== t))} />
        ))}
        {suggestions.map((t) => (
          <Chip key={t} label={`+ ${t}`} onPress={() => addTag(t)} />
        ))}
      </Row>
      <TextInput
        style={s.input}
        placeholder="Add a tag"
        placeholderTextColor={colors.textMuted}
        value={newTag}
        onChangeText={setNewTag}
        onSubmitEditing={() => {
          addTag(newTag);
          setNewTag('');
        }}
        returnKeyType="done"
        autoCapitalize="none"
      />

      <View style={{ height: space.md }} />
      <Button title={editingId ? 'Save changes' : 'Save & interpret'} loading={saving} onPress={save} />
    </Screen>
  );
}

function joinText(a: string, b: string) {
  if (!a.trim()) return b.trim();
  if (!b.trim()) return a;
  return `${a.trimEnd()} ${b.trim()}`;
}

const s = StyleSheet.create({
  mic: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  micText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  bodyInput: {
    minHeight: 180,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    padding: space.lg,
    fontSize: 17,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
