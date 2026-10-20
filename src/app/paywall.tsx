import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { usePremium } from '@/lib/purchases';
import { PRIVACY_URL, TERMS_URL } from '@/lib/config';
import { colors, radius, space } from '@/lib/theme';
import { Body, Button, H1, Screen, Small } from '@/components/ui';

const FEATURES = [
  'Unlimited dream readings',
  'Full patterns: every recurring symbol, person, place and feeling',
  'Pattern callbacks linking each dream to your history',
  'Weekly insight card',
  'PDF export',
];

export default function Paywall() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const { getOffering, purchase, restore, isPremium, purchasesAvailable } = usePremium();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getOffering()
      .then((o) => {
        setOffering(o);
        setSelected(o?.annual ?? o?.monthly ?? o?.availablePackages[0] ?? null);
      })
      .catch(() => setOffering(null))
      .finally(() => setLoading(false));
  }, [getOffering]);

  useEffect(() => {
    if (isPremium) router.back();
  }, [isPremium]);

  const buy = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (await purchase(selected)) router.back();
      else if (!isPremium) {
        Alert.alert(
          'Almost there',
          "Your purchase went through but Premium isn't active yet. Tap Restore purchases in a moment, or contact support if it doesn't unlock.",
        );
      }
    } catch (e) {
      Alert.alert('Purchase failed', String((e as Error)?.message ?? 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const headline =
    reason === 'quota'
      ? "You've used this month's free readings"
      : reason === 'intro'
        ? 'Keep discovering your dreams'
        : 'DreamPattern Premium';

  const annual = offering?.annual;
  const monthly = offering?.monthly;
  const trial = annual?.product.introPrice;

  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable onPress={() => router.back()} hitSlop={16} accessibilityLabel="Close" style={{ alignSelf: 'flex-end' }}>
        <Text style={{ color: colors.textDim, fontSize: 24 }}>✕</Text>
      </Pressable>
      <Text style={{ fontSize: 56, textAlign: 'center' }}>✦</Text>
      <H1 style={{ textAlign: 'center' }}>{headline}</H1>
      <View style={{ gap: space.sm, marginVertical: space.md }}>
        {FEATURES.map((f) => (
          <Body key={f}>✓ {f}</Body>
        ))}
        <Small>Journaling stays free and unlimited, always.</Small>
      </View>

      {loading && <ActivityIndicator color={colors.accent} />}
      {!loading && !offering && (
        <Body dim style={{ textAlign: 'center' }}>
          {purchasesAvailable
            ? "Couldn't load plans. Check your connection and try again."
            : 'Subscriptions are not set up in this build yet.'}
        </Body>
      )}

      {annual && (
        <Plan
          pkg={annual}
          selected={selected?.identifier === annual.identifier}
          onPress={() => setSelected(annual)}
          title="Yearly"
          price={`${annual.product.priceString} / year`}
          note={trial ? `${trialText(trial.periodNumberOfUnits, trial.periodUnit)} free, then billed yearly` : 'Best value'}
        />
      )}
      {monthly && (
        <Plan
          pkg={monthly}
          selected={selected?.identifier === monthly.identifier}
          onPress={() => setSelected(monthly)}
          title="Monthly"
          price={`${monthly.product.priceString} / month`}
        />
      )}

      {selected && (
        <Button
          title={selected === annual && trial ? 'Start free trial' : 'Subscribe'}
          loading={busy}
          onPress={buy}
        />
      )}
      <Button
        title="Restore purchases"
        variant="ghost"
        onPress={async () => {
          const ok = await restore().catch(() => false);
          if (!ok) Alert.alert('Nothing to restore', 'No active subscription was found for this store account.');
        }}
      />
      <Small style={{ textAlign: 'center' }}>
        Subscriptions renew automatically until cancelled. Cancel anytime in your{' '}
        {'App Store or Google Play'} account settings at least 24 hours before the period ends. Any unused free trial
        ends when you subscribe.
      </Small>
      <Small style={{ textAlign: 'center' }}>
        <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(TERMS_URL)}>
          Terms of use
        </Text>
        {'  ·  '}
        <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(PRIVACY_URL)}>
          Privacy policy
        </Text>
      </Small>
    </Screen>
  );
}

function trialText(n: number, unit: string) {
  const u = unit.toLowerCase();
  if (u === 'week' && n === 1) return '7 days';
  return `${n} ${u}${n === 1 ? '' : 's'}`;
}

function Plan({
  title,
  price,
  note,
  selected,
  onPress,
}: {
  pkg: PurchasesPackage;
  title: string;
  price: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.plan, selected && s.planSelected]}>
      <View style={{ flex: 1 }}>
        <Text style={s.planTitle}>{title}</Text>
        {note && <Text style={s.planNote}>{note}</Text>}
      </View>
      <Text style={s.planPrice}>{price}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  planSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  planTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  planNote: { color: colors.gold, fontSize: 13, marginTop: 2 },
  planPrice: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
