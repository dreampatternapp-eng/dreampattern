// Supabase Edge Function: POST /functions/v1/interpret
// Secrets (Supabase dashboard > Edge Functions > Secrets): ANTHROPIC_API_KEY, REVENUECAT_SECRET_KEY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { handleRequest, type Store } from './handler.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const store: Store = {
  async getCount(key) {
    const { data } = await db.from('usage_counters').select('count').eq('key', key).maybeSingle();
    return data?.count ?? 0;
  },
  async increment(key) {
    const { data, error } = await db.rpc('increment_usage', { p_key: key });
    if (error) throw error;
    return data as number;
  },
  async getCachedEntitlement(userId) {
    const { data } = await db
      .from('entitlement_cache')
      .select('active, checked_at')
      .eq('app_user_id', userId)
      .maybeSingle();
    if (!data || Date.now() - new Date(data.checked_at).getTime() > 5 * 60_000) return null;
    return data.active;
  },
  async cacheEntitlement(userId, active) {
    await db
      .from('entitlement_cache')
      .upsert({ app_user_id: userId, active, checked_at: new Date().toISOString() });
  },
};

Deno.serve((req) =>
  handleRequest(req, {
    anthropic,
    store,
    revenueCatSecretKey: Deno.env.get('REVENUECAT_SECRET_KEY'),
    freeMonthlyLimit: Number(Deno.env.get('FREE_MONTHLY_LIMIT') ?? 3),
    ipDailyLimit: Number(Deno.env.get('IP_DAILY_LIMIT') ?? 60),
  }),
);
