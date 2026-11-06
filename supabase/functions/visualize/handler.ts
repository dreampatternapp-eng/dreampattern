import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { clientIp, isPremium, json, type Store } from '../_shared/entitlement.ts';
import {
  DEFAULT_IMAGE_MODEL,
  HOUSE_STYLE,
  PROMPT_MODEL,
  SCENE_SYSTEM_PROMPT,
  SceneSchema,
  buildSceneMessage,
} from './prompt.ts';

export interface Deps {
  anthropic: Anthropic;
  store: Store;
  geminiApiKey?: string;
  imageModel?: string;
  revenueCatSecretKey?: string;
  /** Used for RevenueCat and Gemini calls; injectable for tests. */
  fetchFn?: typeof fetch;
  /** Premium images per calendar month (UTC). */
  premiumMonthlyCap?: number;
  /** Image requests per IP per day, across all users. */
  ipDailyLimit?: number;
  now?: () => Date;
}

const RequestSchema = z.object({
  app_user_id: z.string().min(1).max(200),
  /** Random id kept in the iOS keychain, which survives reinstalls; guards the one free image. */
  device_id: z.string().min(8).max(100).nullish(),
  dream: z.object({
    text: z.string().trim().min(3).max(8000),
    title: z.string().max(200).nullish(),
    mood: z.number().int().min(0).max(4).nullish(),
  }),
});

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/**
 * POST /functions/v1/visualize
 * One free image per user and device, then Premium only (capped per month).
 * The raw dream goes only to Anthropic (to write a safe scene brief); the image model sees only that brief.
 * Nothing is stored server-side except counters.
 */
export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad_request' }, 400);
  const { app_user_id: userId, device_id: deviceId, dream } = parsed.data;
  const { store } = deps;
  if (!deps.geminiApiKey) return json({ error: 'not_configured' }, 503);

  const now = (deps.now ?? (() => new Date()))();
  const day = now.toISOString().slice(0, 10);
  const ipKey = `ip:img:${clientIp(req)}:${day}`;
  if ((await store.getCount(ipKey)) >= (deps.ipDailyLimit ?? 20)) return json({ error: 'rate_limited' }, 429);

  const cap = deps.premiumMonthlyCap ?? 30;
  const monthKey = `usage:img:${userId}:${day.slice(0, 7)}`;
  const freeUserKey = `free_img:${userId}`;
  const freeDeviceKey = deviceId ? `free_img_dev:${deviceId}` : null;

  let premium = await isPremium(userId, deps);
  if (!premium) {
    const freeUsed =
      (await store.getCount(freeUserKey)) > 0 || (freeDeviceKey ? (await store.getCount(freeDeviceKey)) > 0 : false);
    if (freeUsed) {
      // Someone who just subscribed must not be blocked by a stale "not premium" cache entry.
      premium = await isPremium(userId, deps, true);
      if (!premium) return json({ error: 'premium_required' }, 402);
    }
  }
  const used = premium ? await store.getCount(monthKey) : 0;
  if (premium && used >= cap) return json({ error: 'monthly_cap', used, limit: cap }, 429);

  // Step 1: Haiku writes a privacy-safe, non-explicit scene brief.
  let scene: string;
  try {
    const res = await deps.anthropic.messages.parse({
      model: PROMPT_MODEL,
      max_tokens: 1000,
      system: SCENE_SYSTEM_PROMPT,
      output_config: { effort: 'low', format: zodOutputFormat(SceneSchema) },
      messages: [{ role: 'user', content: buildSceneMessage(dream) }],
    });
    const out = res.parsed_output;
    if (res.stop_reason === 'refusal' || !out || !out.visualizable || out.scene.trim().length < 10) {
      return json({ error: 'not_visualizable' }, 422);
    }
    scene = out.scene.trim();
  } catch (e) {
    // Never log dream text; status codes only.
    console.error('anthropic_error', e instanceof Anthropic.APIError ? e.status : 'network');
    return json({ error: 'upstream_error' }, 502);
  }

  // Step 2: the image model paints the brief. store:false so Google keeps no retrievable copy.
  let image: { data: string; mime_type: string } | null;
  try {
    const res = await (deps.fetchFn ?? fetch)(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': deps.geminiApiKey },
      body: JSON.stringify({
        model: deps.imageModel || DEFAULT_IMAGE_MODEL,
        input: [{ type: 'text', text: `${scene}\n\nStyle: ${HOUSE_STYLE}` }],
        response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '4:5', image_size: '1K' },
        store: false,
        safety_settings: [
          { type: 'sexually_explicit', threshold: 'block_low_and_above' },
          { type: 'dangerous_content', threshold: 'block_medium_and_above' },
          { type: 'harassment', threshold: 'block_medium_and_above' },
          { type: 'hate_speech', threshold: 'block_medium_and_above' },
        ],
      }),
    });
    if (res.status === 400) {
      // Gemini reports prompt-level safety blocks as 400s; treat as "can't draw this one", not an outage.
      console.error('gemini_error', 400);
      return json({ error: 'not_visualizable' }, 422);
    }
    if (!res.ok) {
      console.error('gemini_error', res.status);
      return json({ error: 'upstream_error' }, 502);
    }
    image = lastImage(await res.json());
  } catch {
    console.error('gemini_error', 'network');
    return json({ error: 'upstream_error' }, 502);
  }
  if (!image) return json({ error: 'not_visualizable' }, 422);

  // Count only delivered images.
  await store.increment(ipKey);
  let usage: { used: number; limit: number | null };
  if (premium) {
    usage = { used: await store.increment(monthKey), limit: cap };
  } else {
    await store.increment(freeUserKey);
    if (freeDeviceKey) await store.increment(freeDeviceKey);
    usage = { used: 1, limit: 1 };
  }

  return json({ image: image.data, mime_type: image.mime_type, premium, usage });
}

type Block = { type?: string; data?: string; mime_type?: string };
type Interaction = { status?: string; steps?: { type?: string; content?: Block[] }[] };

/** The last image block in the model's output steps (thought-step previews are skipped). */
export function lastImage(body: unknown): { data: string; mime_type: string } | null {
  const it = body as Interaction;
  if (!it || (it.status && it.status !== 'completed')) return null;
  let found: Block | null = null;
  for (const step of it.steps ?? []) {
    if (step.type !== 'model_output') continue;
    for (const b of step.content ?? []) if (b.type === 'image' && b.data) found = b;
  }
  return found ? { data: found.data!, mime_type: found.mime_type ?? 'image/jpeg' } : null;
}
