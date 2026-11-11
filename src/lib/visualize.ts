import type { SQLiteDatabase } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { API_URL } from './config';
import { fetchWithRetry } from './net';
import { saveDreamImageFile } from './db';
import { writeImageFile } from './imageFiles';
import type { Dream } from './types';

const ResponseSchema = z.object({
  image: z.string().min(1),
  mime_type: z.string(),
  premium: z.boolean(),
  usage: z.object({ used: z.number(), limit: z.number().nullable() }),
});

/** The free image is used up (or never available): show the paywall. */
export class ImagePremiumRequiredError extends Error {}
/** Premium fair-use cap reached for this month. */
export class ImageCapError extends Error {
  constructor(public limit: number) {
    super(`You've made ${limit} dream images this month. More unlock on the 1st.`);
  }
}
/** Errors with a message that is safe to show as is. */
export class VisualizeError extends Error {}

/**
 * A random id kept in the iOS keychain, which survives deleting and reinstalling the app.
 * The server uses it only so the one free image can't be claimed again by reinstalling.
 */
async function deviceId(): Promise<string | undefined> {
  // Never let a keychain problem block the image: the server treats the id as optional.
  try {
    const key = 'dp_device_id';
    const existing = await SecureStore.getItemAsync(key);
    if (existing) return existing;
    const id = Crypto.randomUUID();
    await SecureStore.setItemAsync(key, id, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Asks our Supabase edge function for a picture of the dream and saves it on this phone.
 * The server writes a safe scene brief with Anthropic and sends only that brief to Google's image model.
 * Neither the dream nor the image is stored on the server.
 */
export async function visualizeDream(
  db: SQLiteDatabase,
  dream: Dream,
  opts: { appUserId: string },
): Promise<{ file: string; usage: { used: number; limit: number | null } }> {
  if (!API_URL) throw new VisualizeError('Image server is not configured yet (EXPO_PUBLIC_API_URL).');

  const device_id = await deviceId();
  let res: Response;
  try {
    res = await fetchWithRetry(`${API_URL}/functions/v1/visualize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_user_id: opts.appUserId,
        device_id,
        dream: { text: dream.body, title: dream.title || null, mood: dream.mood },
      }),
    });
  } catch (e) {
    const why = e instanceof Error ? e.message.slice(0, 80) : '';
    throw new VisualizeError(`Couldn't reach the server. Try again when you're online.${why ? ` (${why})` : ''}`);
  }

  if (res.status === 402) throw new ImagePremiumRequiredError('Dream images are part of Premium.');
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; limit?: number };
    if (body.error === 'monthly_cap') throw new ImageCapError(body.limit ?? 30);
    throw new VisualizeError('Too many images today. Please try again tomorrow.');
  }
  if (res.status === 422) {
    throw new VisualizeError(
      "We couldn't paint this one. Some dreams, especially very dark or intimate ones, can't be turned into a picture.",
    );
  }
  if (!res.ok) throw new VisualizeError('The image failed. Your dream is saved; please try again.');

  const parsed = ResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new VisualizeError('Got an unexpected response. Please try again.');

  const file = writeImageFile(dream.id, parsed.data.image);
  await saveDreamImageFile(db, dream.id, file);
  return { file, usage: parsed.data.usage };
}
