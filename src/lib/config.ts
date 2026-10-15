import { Platform } from 'react-native';

// Public values only. Secrets (Anthropic key, RevenueCat secret key) live in Supabase Edge Function secrets.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export const REVENUECAT_KEY =
  Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  }) ?? '';

export const ENTITLEMENT_ID = 'premium';

export const FREE_INTERPRETATIONS_PER_MONTH = 3;
export const FREE_PATTERN_ITEMS = 3;

export const PRIVACY_URL = 'https://dreampattern.app/privacy';
export const TERMS_URL = 'https://dreampattern.app/terms';
export const SUPPORT_EMAIL = 'support@dreampattern.app';
