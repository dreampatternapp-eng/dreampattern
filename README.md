# DreamPattern

Private, voice-first AI dream journal for iOS and Android. Expo SDK 57 (React Native + TypeScript), local-first SQLite, Claude Haiku readings through a Supabase Edge Function, subscriptions through RevenueCat. No accounts in v1.

## Layout

| Path | What it is |
| --- | --- |
| `src/app/` | Screens (Expo Router). `(tabs)/` = Home, Journal, Patterns, Settings; plus `onboarding`, `capture`, `entry/[id]`, `paywall`. |
| `src/lib/db.ts` | SQLite schema, migrations and all queries. Dreams never leave the phone except for a reading. |
| `src/lib/interpret.ts` | Calls the edge function and stores the reading locally. |
| `src/lib/purchases.tsx` | RevenueCat setup, `usePremium()` hook, purchase / restore. |
| `supabase/functions/interpret/` | The AI proxy. Holds the Anthropic key, enforces 3 free readings/month, checks Premium with RevenueCat. |
| `supabase/migrations/` | Two small tables for usage counters and an entitlement cache. No dream text is stored. |
| `server-tests/` | Node tests for the proxy logic (`cd server-tests && npm install && npm test`). |

## Where each key goes

Never commit keys and never paste them into chat.

| Key | Where it goes | Where you get it |
| --- | --- | --- |
| Anthropic API key | Supabase dashboard > Edge Functions > Secrets > `ANTHROPIC_API_KEY` | console.anthropic.com > API keys |
| RevenueCat **secret** key (`sk_...`, must be a **V1** secret key; the function calls the v1 subscribers API) | Supabase Edge Function secret `REVENUECAT_SECRET_KEY` | RevenueCat > Project > API keys |
| RevenueCat **public** iOS key (`appl_...`) | `.env` as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (also an EAS env var for builds) | RevenueCat > Project > API keys |
| RevenueCat **public** Android key (`goog_...`) | `.env` as `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | same |
| Supabase project URL | `.env` as `EXPO_PUBLIC_API_URL` | Supabase > Project Settings > API |
| EAS project id | `app.json` > `expo.extra.eas.projectId` (filled by `eas init`) | expo.dev |

## RevenueCat setup (once the store accounts are active)

1. Create products in App Store Connect and Play Console: `dreampattern_premium_monthly` ($5.99/mo) and `dreampattern_premium_annual` ($39.99/yr with a 7-day free trial as the introductory offer).
2. In RevenueCat create an entitlement with identifier **`premium`** and attach both products.
3. Create an offering marked **Current** with the default Monthly and Annual packages.

## Running it

```bash
npm install
cp .env.example .env      # fill in public values
npx expo start            # UI work in Expo Go; dictation, Face ID and purchases need a dev build:
npx eas build --profile development --platform ios
```

Without a RevenueCat key the app runs as the free tier; without `EXPO_PUBLIC_API_URL` the reading button shows a "not configured" message.

## Deploying the proxy

```bash
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push
npx supabase functions deploy interpret
```

## Privacy facts (for the privacy policy and store privacy labels)

- Journal entries, readings, tags and settings are stored only on the device (SQLite). No account, no analytics SDK, no ads, no tracking.
- When the user asks for a reading, the dream text (plus title, mood, lucid flag, and for Premium a list of recurring symbol names) is sent over HTTPS to our Supabase function and on to Anthropic to generate the reading. The function does not store or log dream text.
- The server stores only an anonymous RevenueCat app user id with monthly reading counts, the caller IP with a daily count (abuse limit), and a 5-minute Premium status cache.
- Speech-to-text runs on-device when the phone supports it; otherwise Apple's or Google's speech service is used.
- RevenueCat processes purchase data. "Delete all data" in Settings erases everything on the device.

## v1 scope

Built: onboarding with reminder opt-in, voice/typed capture, mood/lucid/tags, AI reading with symbols, tone and pattern callback, journal list/calendar/search/filters, patterns dashboard (free top-3), weekly insight, Face ID/passcode lock, morning reminder, paywall, restore, manage subscription, text/PDF export, delete all, share-as-image.

Not in v1 (spec): dream images, lucid-dreaming tools, sleep sounds, watch app, widget, cloud backup.
