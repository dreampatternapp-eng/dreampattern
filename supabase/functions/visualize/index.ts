// Supabase Edge Function: POST /functions/v1/visualize
// Secrets (Supabase dashboard > Edge Functions > Secrets): ANTHROPIC_API_KEY, REVENUECAT_SECRET_KEY, GEMINI_API_KEY.
// Optional: IMAGE_MODEL (default gemini-nano-banana-2.1), IMAGE_MONTHLY_CAP (30), IMAGE_IP_DAILY_LIMIT (20).
import Anthropic from '@anthropic-ai/sdk';
import { postgresStore } from '../_shared/store.ts';
import { handleRequest } from './handler.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const store = postgresStore();

Deno.serve((req) =>
  handleRequest(req, {
    anthropic,
    store,
    geminiApiKey: Deno.env.get('GEMINI_API_KEY'),
    imageModel: Deno.env.get('IMAGE_MODEL'),
    revenueCatSecretKey: Deno.env.get('REVENUECAT_SECRET_KEY'),
    premiumMonthlyCap: Number(Deno.env.get('IMAGE_MONTHLY_CAP') ?? 30),
    ipDailyLimit: Number(Deno.env.get('IMAGE_IP_DAILY_LIMIT') ?? 20),
  }),
);
