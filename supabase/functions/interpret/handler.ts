import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { InterpretationSchema, MODEL, SYSTEM_PROMPT, buildUserMessage } from './prompt.ts';

/** Storage for counters and the entitlement cache (Postgres in production, in-memory in tests). */
export interface Store {
  getCount(key: string): Promise<number>;
  increment(key: string): Promise<number>;
  getCachedEntitlement(userId: string): Promise<boolean | null>;
  cacheEntitlement(userId: string, active: boolean): Promise<void>;
}

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function handleRequest(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'bad_request' }, 400);
  const { app_user_id: userId, dream, recurring } = parsed.data;
  const { store } = deps;
  const now = (deps.now ?? (() => new Date()))();

  // Coarse abuse guard: anonymous ids are free to mint, IPs less so.
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
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

/** Checks the "premium" entitlement with RevenueCat's REST API, cached for 5 minutes. */
async function isPremium(userId: string, deps: Deps, skipCache = false): Promise<boolean> {
  if (userId.startsWith('$local:') || !deps.revenueCatSecretKey) return false;
  const cached = skipCache ? null : await deps.store.getCachedEntitlement(userId);
  if (cached !== null) return cached;

  const res = await (deps.fetchFn ?? fetch)(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${deps.revenueCatSecretKey}` } },
  );
  if (!res.ok) return false;
  const body = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null }> };
  };
  const ent = body.subscriber?.entitlements?.premium;
  const active = !!ent && (ent.expires_date === null || new Date(ent.expires_date) > new Date());
  await deps.store.cacheEntitlement(userId, active);
  return active;
}
