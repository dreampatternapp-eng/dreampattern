import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { handleRequest } from './.build/handler.mjs';

const reading = {
  title: 'The Rising Tide',
  summary: 'You may be processing change.',
  symbols: [{ name: 'water', kind: 'symbol', meaning: 'Often linked to emotion.' }],
  emotions: ['calm'],
  tone: 'Calm and curious.',
  pattern_callback: 'Water has appeared in 3 dreams.',
};

function memoryStore() {
  const counts = new Map();
  const ents = new Map();
  return {
    getCount: async (k) => counts.get(k) ?? 0,
    increment: async (k) => {
      counts.set(k, (counts.get(k) ?? 0) + 1);
      return counts.get(k);
    },
    getCachedEntitlement: async (u) => (ents.has(u) ? ents.get(u) : null),
    cacheEntitlement: async (u, a) => void ents.set(u, a),
  };
}

let lastBody = null;
const anthropic = new Anthropic({
  apiKey: 'test',
  fetch: async (_url, init) => {
    lastBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
        content: [{ type: 'text', text: JSON.stringify(reading) }],
        stop_reason: 'end_turn', stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  },
});

const rc = (premium) => async () =>
  new Response(JSON.stringify({ subscriber: { entitlements: premium ? { premium: { expires_date: null } } : {} } }));

const req = (body) =>
  new Request('https://x/functions/v1/interpret', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': '1.2.3.4' },
  });
const dream = { text: 'I was swimming in a calm sea at night.', mood: 3, lucid: false };
const recurring = [{ name: 'water', kind: 'symbol', count: 3 }];

test('free user gets 3 readings, then 402; recurring elements are not sent', async () => {
  const deps = { anthropic, store: memoryStore(), revenueCatSecretKey: 'rc', fetchFn: rc(false) };
  for (let i = 1; i <= 3; i++) {
    const r = await handleRequest(req({ app_user_id: 'u1', dream, recurring }), deps);
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.pattern_callback, null);
    assert.deepEqual(b.usage, { used: i, limit: 3 });
  }
  assert.equal(lastBody.model, 'claude-haiku-5-5');
  assert.ok(lastBody.output_config.format, 'uses structured output');
  assert.ok(!lastBody.messages[0].content.includes('water (symbol)'));
  const r = await handleRequest(req({ app_user_id: 'u1', dream }), deps);
  assert.equal(r.status, 402);
  assert.deepEqual(await r.json(), { error: 'quota_exceeded', used: 3, limit: 3 });
});

test('premium user is unlimited and gets the pattern callback', async () => {
  const deps = { anthropic, store: memoryStore(), revenueCatSecretKey: 'rc', fetchFn: rc(true) };
  for (let i = 0; i < 5; i++) {
    const r = await handleRequest(req({ app_user_id: 'p1', dream, recurring }), deps);
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.pattern_callback, reading.pattern_callback);
    assert.equal(b.usage.limit, null);
  }
  assert.ok(lastBody.messages[0].content.includes('water (symbol): 3'));
});

test('local fallback ids are always free tier', async () => {
  let rcCalled = false;
  const deps = { anthropic, store: memoryStore(), revenueCatSecretKey: 'rc', fetchFn: async () => ((rcCalled = true), rc(true)()) };
  const r = await handleRequest(req({ app_user_id: '$local:abc', dream }), deps);
  assert.equal((await r.json()).usage.limit, 3);
  assert.equal(rcCalled, false);
});

test('per-IP daily limit', async () => {
  const deps = { anthropic, store: memoryStore(), fetchFn: rc(false), ipDailyLimit: 2, freeMonthlyLimit: 99 };
  assert.equal((await handleRequest(req({ app_user_id: 'a', dream }), deps)).status, 200);
  assert.equal((await handleRequest(req({ app_user_id: 'b', dream }), deps)).status, 200);
  assert.equal((await handleRequest(req({ app_user_id: 'c', dream }), deps)).status, 429);
});

test('rejects bad input', async () => {
  const deps = { anthropic, store: memoryStore() };
  assert.equal((await handleRequest(req({ app_user_id: 'u', dream: { text: '' } }), deps)).status, 400);
});
