import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { clientIp, isPremium, json, type Store } from '../_shared/entitlement.ts';
import { InterpretationSchema, MODEL, SYSTEM_PROMPT, buildUserMessage } from './prompt.ts';

export type { Store };

export interface Deps {
  anthropic: Anthropic;
  store: Store;
  revenueCatSecretKey?: string;
  fetchFn?: typeof fetch;
  freeMonthlyLimit?: number;
  ipDailyLimit?: number;
  now?: () => Date;
}

const RequestSchema = z.object({
  app_user_id: z.string().min(1).max(200),
  dream: z.object({
    text: z.string().trim().min(3).max(8000),
    title: z.string().max(200).nullish(),
    mood: z.number().int().min(0).max(4).nullish(),
    lucid: z.boolean().optional(),
  }),
  recurring: z
    .array(z.object({ name: z.string().max(60), kind: z.string().max(20), count: z.number().int() }))
    .max(20)
    .default([]),
});

export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad_request' }, 400);
  const { app_user_id: userId, dream, recurring } = parsed.data;
  const { store } = deps;
  const now = (deps.now ?? (() => new Date()))();

  // Coarse abuse guard: anonymous ids are free to mint, IPs less so.
  const ip = clientIp(req);
  const day = now.toISOString().slice(0, 10);
  const ipKey = `ip:${ip}:${day}`;
  if ((await store.getCount(ipKey)) >= (deps.ipDailyLimit ?? 60)) return json({ error: 'rate_limited' }, 429);

  let premium = await isPremium(userId, deps);
  const limit = deps.freeMonthlyLimit ?? 3;
  const usageKey = `usage:${userId}:${day.slice(0, 7)}`;
  const used = await store.getCount(usageKey);
  if (!premium && used >= limit) {
    // Someone who just subscribed must not be blocked by a stale "not premium" cache entry.
    premium = await isPremium(userId, deps, true);
    if (!premium) return json({ error: 'quota_exceeded', used, limit }, 402);
  }

  let out;
  try {
    const res = await deps.anthropic.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'low', format: zodOutputFormat(InterpretationSchema) },
      // Pattern callbacks are premium; free users' recurring elements are never sent.
      messages: [{ role: 'user', content: buildUserMessage(dream, premium ? recurring : []) }],
    });
    if (res.stop_reason === 'refusal' || !res.parsed_output) {
      return json({ error: 'interpretation_unavailable' }, 422);
    }
    out = res.parsed_output;
  } catch (e) {
    // Never log dream text; status codes only.
    console.error('anthropic_error', e instanceof Anthropic.APIError ? e.status : 'network');
    return json({ error: 'upstream_error' }, 502);
  }

  await store.increment(ipKey);
  const newUsed = premium ? used : await store.increment(usageKey);

  return json({
    ...out,
    pattern_callback: premium ? out.pattern_callback : null,
    usage: { used: newUsed, limit: premium ? null : limit },
  });
}
