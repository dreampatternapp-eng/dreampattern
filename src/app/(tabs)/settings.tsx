import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, Switch } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Purchases from 'react-native-purchases';
import { deleteAllData, getSetting, setSetting } from '@/lib/db';
import { exportPdf, exportText } from '@/lib/export';
import { canUseLock, unlock } from '@/lib/lock';
import { cancelMorningReminder, requestReminderPermission, scheduleMorningReminder } from '@/lib/reminders';
import { usePremium } from '@/lib/purchases';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/config';
import { colors } from '@/lib/theme';
import { Body, Button, Card, Chip, H1, H2, Row, Screen, Small } from '@/components/ui';

const TIMES = ['05:30', '06:00', '06:30', '07:00', '07:30', '08:00', '09:00'];

export default function Settings() {
  const db = useSQLiteContext();
  const { isPremium, customerInfo, purchasesAvailable, restore } = usePremium();
  const [reminder, setReminder] = useState<string | null>(null);
  const [lock, setLock] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getSetting(db, 'reminder').then(setReminder);
      getSetting(db, 'lock_enabled').then((v) => setLock(v === '1'));
    }, [db]),
  );

  const chooseReminder = async (t: string | null) => {
    if (t === null) {
      await cancelMorningReminder();
      await setSetting(db, 'reminder', '');
      setReminder(null);
      return;
    }
    if (!(await requestReminderPermission())) {
      Alert.alert('Notifications are off', 'Turn on notifications for DreamPattern in your phone settings.');
      return;
    }
    const [h, m] = t.split(':').map(Number);
    await scheduleMorningReminder(h, m);
    await setSetting(db, 'reminder', t);
    setReminder(t);
  };

  const toggleLock = async (on: boolean) => {
    if (on) {
      if (!(await canUseLock())) {
        Alert.alert('Set up a passcode first', 'Add Face ID, a fingerprint or a passcode in your phone settings.');
        return;
      }
      if (!(await unlock())) return;
    }
    await setSetting(db, 'lock_enabled', on ? '1' : '0');
    setLock(on);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', String((e as Error)?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const manageSubscription = async () => {
    const url = customerInfo?.managementURL;
    if (url) return Linking.openURL(url);
    if (purchasesAvailable && Platform.OS === 'ios') return Purchases.showManageSubscriptions();
    Linking.openURL(
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions',
    );
  };

  const confirmDeleteAll = () =>
    Alert.alert(
      'Delete everything?',
      'All dreams, readings and settings on this phone will be permanently erased. This cannot be undone. Your subscription is not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await cancelMorningReminder();
            await deleteAllData(db);
            router.replace('/onboarding');
          },
        },
      ],
    );

  return (
    <Screen>
      <H1>Settings</H1>

      <Card>
        <H2>Subscription</H2>
        <Body>{isPremium ? 'Premium is active. Thank you!' : 'Free plan: 3 readings a month.'}</Body>
        {!isPremium && <Button title="See Premium" onPress={() => router.push('/paywall')} />}
        <Button
          title="Restore purchases"
          variant="secondary"
          loading={busy === 'restore'}
          onPress={() =>
            run('restore', async () => {
              const ok = await restore();
              Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Premium is active.' : 'No active subscription was found.');
            })
          }
        />
        <Button title="Manage subscription" variant="ghost" onPress={manageSubscription} />
      </Card>

      <Card>
        <H2>Morning reminder</H2>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="Off" selected={!reminder} onPress={() => chooseReminder(null)} />
          {TIMES.map((t) => (
            <Chip key={t} label={t} selected={reminder === t} onPress={() => chooseReminder(t)} />
          ))}
        </Row>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>Lock with Face ID / passcode</H2>
          <Switch value={lock} onValueChange={toggleLock} trackColor={{ true: colors.accent }} />
        </Row>
        <Small>Asks for Face ID, fingerprint or your phone passcode each time the app opens.</Small>
      </Card>

      <Card>
        <H2>Your data</H2>
        <Small>Your journal is stored only on this phone. Dream text is sent to our server only to create a reading and is not kept there.</Small>
        <Button title="Export as text" variant="secondary" loading={busy === 'txt'} onPress={() => run('txt', () => exportText(db))} />
        <Button
          title={isPremium ? 'Export as PDF' : 'Export as PDF (Premium)'}
          variant="secondary"
          loading={busy === 'pdf'}
          onPress={() => (isPremium ? run('pdf', () => exportPdf(db)) : router.push('/paywall'))}
        />
        <Button title="Delete all data" variant="danger" onPress={confirmDeleteAll} />
      </Card>

      <Card>
        <H2>About</H2>
        <Button title="Privacy policy" variant="ghost" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <Button title="Terms of use" variant="ghost" onPress={() => Linking.openURL(TERMS_URL)} />
        <Button title="Contact support" variant="ghost" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <Small style={{ textAlign: 'center' }}>
          DreamPattern readings are for reflection and entertainment only, not medical or psychological advice.
        </Small>
      </Card>
    </Screen>
  );
}
