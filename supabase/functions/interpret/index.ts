// Supabase Edge Function: POST /functions/v1/interpret
// Secrets (Supabase dashboard > Edge Functions > Secrets): ANTHROPIC_API_KEY, REVENUECAT_SECRET_KEY.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import Anthropic from '@anthropic-ai/sdk';
import { postgresStore } from '../_shared/store.ts';
import { handleRequest } from './handler.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const store = postgresStore();

Deno.serve((req) =>
  handleRequest(req, {
    anthropic,
    store,
    revenueCatSecretKey: Deno.env.get('REVENUECAT_SECRET_KEY'),
    freeMonthlyLimit: Number(Deno.env.get('FREE_MONTHLY_LIMIT') ?? 3),
    ipDailyLimit: Number(Deno.env.get('IP_DAILY_LIMIT') ?? 60),
  }),
);
