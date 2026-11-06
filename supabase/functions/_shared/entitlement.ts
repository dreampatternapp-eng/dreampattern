/** Storage for counters and the entitlement cache (Postgres in production, in-memory in tests). */
export interface Store {
  getCount(key: string): Promise<number>;
  increment(key: string): Promise<number>;
  getCachedEntitlement(userId: string): Promise<boolean | null>;
  cacheEntitlement(userId: string, active: boolean): Promise<void>;
}

export interface EntitlementDeps {
  store: Store;
  revenueCatSecretKey?: string;
  fetchFn?: typeof fetch;
}

/** Checks the "premium" entitlement with RevenueCat's REST API, cached for 5 minutes. */
export async function isPremium(userId: string, deps: EntitlementDeps, skipCache = false): Promise<boolean> {
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

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
