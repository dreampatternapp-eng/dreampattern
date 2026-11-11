// Postgres-backed Store shared by the edge functions (Deno only; tests use an in-memory store).
import { createClient } from '@supabase/supabase-js';
import type { Store } from './entitlement.ts';

export function postgresStore(): Store {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  return {
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
}
