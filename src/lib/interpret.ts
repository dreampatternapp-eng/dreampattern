import type { SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';
import { API_URL } from './config';
import { getInterpretation, interpretedDreamCount, recurringElements, saveInterpretation } from './db';
import type { Dream, Interpretation } from './types';

const ResponseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  symbols: z.array(
    z.object({ name: z.string(), kind: z.enum(['symbol', 'person', 'place']), meaning: z.string() }),
  ),
  emotions: z.array(z.string()),
  tone: z.string(),
  pattern_callback: z.string().nullable(),
  usage: z.object({ used: z.number(), limit: z.number().nullable() }),
});

export class QuotaExceededError extends Error {
  constructor(public used: number, public limit: number) {
    super('Free interpretations used up for this month');
  }
}

export class InterpretError extends Error {}

export interface InterpretResult {
  interpretation: Interpretation;
  usage: { used: number; limit: number | null };
}

/**
 * Sends one dream to our Supabase edge function (never directly to Anthropic) and stores the
 * result locally. The function does not store dream text.
 */
export async function interpretDream(
  db: SQLiteDatabase,
  dream: Dream,
  opts: { appUserId: string; isPremium: boolean },
): Promise<InterpretResult> {
  if (!API_URL) throw new InterpretError('Interpretation server is not configured yet (EXPO_PUBLIC_API_URL).');

  // Pattern callbacks are premium and start from the user's 3rd interpreted dream.
  const priorCount = await interpretedDreamCount(db);
  const recurring =
    opts.isPremium && priorCount >= 2 ? await recurringElements(db, dream.id) : [];

  let res: Response;
  try {
    res = await fetch(`${API_URL}/functions/v1/interpret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_user_id: opts.appUserId,
        dream: {
          text: dream.body,
          title: dream.title || null,
          mood: dream.mood,
          lucid: dream.lucid,
        },
        recurring,
      }),
    });
  } catch {
    throw new InterpretError("Couldn't reach the server. Your dream is saved; try again when you're online.");
  }

  if (res.status === 402) {
    const body = (await res.json().catch(() => ({}))) as { used?: number; limit?: number };
    throw new QuotaExceededError(body.used ?? 0, body.limit ?? 0);
  }
  if (!res.ok) {
    throw new InterpretError('The interpretation failed. Your dream is saved; please try again.');
  }

  const parsed = ResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new InterpretError('Got an unexpected response. Please try again.');
  const p = parsed.data;

  await saveInterpretation(db, dream, {
    title: p.title,
    summary: p.summary,
    symbols: p.symbols,
    emotions: p.emotions,
    tone: p.tone,
    patternCallback: p.pattern_callback,
  });
  const saved = await getInterpretation(db, dream.id);
  return { interpretation: saved!, usage: p.usage };
}
