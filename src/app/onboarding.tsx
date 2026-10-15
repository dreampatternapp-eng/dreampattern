import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { setSetting } from '@/lib/db';
import { requestReminderPermission, scheduleMorningReminder } from '@/lib/reminders';
import { Body, Button, H1, Screen, Small } from '@/components/ui';
import { colors, space } from '@/lib/theme';

const CARDS = [
  {
    emoji: '🎙️',
    title: 'Catch it before it fades',
    body: 'Tap once and speak. Dreams fade within minutes of waking, so capture is one button.',
  },
  {
    emoji: '✦',
    title: 'See what your dreams repeat',
    body: 'Get a reading of each dream, then watch recurring symbols, people and places emerge over weeks.',
  },
  {
    emoji: '🔒',
    title: 'Private by design',
    body: 'No account, no social feed. Your journal stays on this phone and can be locked with Face ID.',
  },
];

export default function Onboarding() {
  const db = useSQLiteContext();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const finish = async (withReminder: boolean) => {
    setBusy(true);
    try {
      if (withReminder && (await requestReminderPermission())) {
        await scheduleMorningReminder(7, 0);
        await setSetting(db, 'reminder', '07:00');
      }
      await setSetting(db, 'onboarded', '1');
      router.replace('/');
      router.push('/capture');
    } finally {
      setBusy(false);
    }
  };

  if (step < CARDS.length) {
    const c = CARDS[step];
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
          <Text style={{ fontSize: 64, textAlign: 'center' }}>{c.emoji}</Text>
          <H1 style={{ textAlign: 'center' }}>{c.title}</H1>
          <Body dim style={{ textAlign: 'center' }}>
            {c.body}
          </Body>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: space.lg }}>
          {CARDS.map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === step ? colors.accent : colors.border,
              }}
            />
          ))}
        </View>
        <Button title="Continue" onPress={() => setStep(step + 1)} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
        <Text style={{ fontSize: 64, textAlign: 'center' }}>⏰</Text>
        <H1 style={{ textAlign: 'center' }}>A gentle morning nudge?</H1>
        <Body dim style={{ textAlign: 'center' }}>
          One reminder at 7:00 each morning to write down last night's dream. You can change the time or turn it off
          in Settings.
        </Body>
      </View>
      <Button title="Remind me each morning" loading={busy} onPress={() => finish(true)} />
      <Button title="Not now" variant="ghost" disabled={busy} onPress={() => finish(false)} />
      <Small style={{ textAlign: 'center' }}>Next: record your first dream.</Small>
    </Screen>
  );
}
