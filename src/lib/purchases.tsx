import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Purchases, { type CustomerInfo, type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { ENTITLEMENT_ID, REVENUECAT_KEY } from './config';

/**
 * No accounts in v1: RevenueCat assigns an anonymous app user id, which the
 * edge function uses to check entitlement and count free interpretations.
 * Without a RevenueCat key (local dev / Expo Go) we fall back to a local id
 * and everything behaves as the free tier.
 */
let configured = false;

async function localFallbackId(): Promise<string> {
  const key = 'dp_local_user_id';
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;
  const id = `$local:${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(key, id);
  return id;
}

const hasPremium = (info: CustomerInfo | null) => !!info?.entitlements.active[ENTITLEMENT_ID];

interface PremiumState {
  ready: boolean;
  isPremium: boolean;
  appUserId: string | null;
  customerInfo: CustomerInfo | null;
  purchasesAvailable: boolean;
  refresh: () => Promise<void>;
  getOffering: () => Promise<PurchasesOffering | null>;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

const PremiumContext = createContext<PremiumState | null>(null);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (REVENUECAT_KEY && !configured) {
          Purchases.configure({ apiKey: REVENUECAT_KEY });
          configured = true;
          Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
        }
        if (configured) {
          const [info, id] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getAppUserID()]);
          setCustomerInfo(info);
          setAppUserId(id);
        } else {
          setAppUserId(await localFallbackId());
        }
      } catch (e) {
        console.warn('RevenueCat init failed', e);
        setAppUserId(await localFallbackId());
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!configured) return;
    setCustomerInfo(await Purchases.getCustomerInfo());
  }, []);

  const getOffering = useCallback(async () => {
    if (!configured) return null;
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage) => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return hasPremium(info);
    } catch (e: any) {
      if (e?.userCancelled) return false;
      throw e;
    }
  }, []);

  const restore = useCallback(async () => {
    if (!configured) return false;
    const info = await Purchases.restorePurchases();
    setCustomerInfo(info);
    return hasPremium(info);
  }, []);

  return (
    <PremiumContext.Provider
      value={{
        ready,
        isPremium: hasPremium(customerInfo),
        appUserId,
        customerInfo,
        purchasesAvailable: configured,
        refresh,
        getOffering,
        purchase,
        restore,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
}

export function usePremium(): PremiumState {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error('usePremium must be used inside PremiumProvider');
  return ctx;
}
