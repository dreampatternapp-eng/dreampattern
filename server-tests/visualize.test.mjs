import { test } from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { handleRequest, lastImage } from './.build/visualize.js';

function memoryStore() {
  const counts = new Map();
  const ents = new Map();
  return {
    counts,
    getCount: async (k) => counts.get(k) ?? 0,
    increment: async (k) => {
      counts.set(k, (counts.get(k) ?? 0) + 1);
      return counts.get(k);
    },
    getCachedEntitlement: async (u) => (ents.has(u) ? ents.get(u) : null),
    cacheEntitlement: async (u, a) => void ents.set(u, a),
  };
}

function anthropicReturning(scene) {
  const calls = [];
  const client = new Anthropic({
    apiKey: 'test',
    fetch: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return new Response(
        JSON.stringify({
          id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-haiku-5-5',
          content: [{ type: 'text', text: JSON.stringify(scene) }],
          stop_reason: 'end_turn', stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });
  return { client, calls };
}

const goodScene = { scene: 'A small boat drifts on a calm silver sea under a huge glowing moon, stars reflected in the water.', visualizable: true };

const interaction = {
  id: 'int_1',
  status: 'completed',
  steps: [
    { type: 'thought', summary: [{ type: 'image', data: 'PREVIEW' }] },
    { type: 'model_output', content: [{ type: 'image', data: 'QUJD', mime_type: 'image/jpeg' }] },
  ],
};

/** Routes RevenueCat and Gemini calls; records the Gemini request bodies. */
function fakeFetch({ premium = false, gemini = () => new Response(JSON.stringify(interaction)) } = {}) {
  const geminiCalls = [];
  const fn = async (url, init) => {
    if (String(url).includes('revenuecat')) {
      return new Response(JSON.stringify({ subscriber: { entitlements: premium ? { premium: { expires_date: null } } : {} } }));
    }
    geminiCalls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    return gemini();
  };
  return { fn, geminiCalls };
}

const req = (body, ip = '1.2.3.4') =>
  new Request('https://x/functions/v1/visualize', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': ip },
  });
const dream = { text: 'I was rowing across a calm sea at night with my sister Anna.', mood: 3 };
const body = (over = {}) => ({ app_user_id: 'u1', device_id: 'device-aaaa-1111', dream, ...over });

function deps(over = {}) {
  const { client, calls } = anthropicReturning(over.scene ?? goodScene);
  const { fn, geminiCalls } = fakeFetch(over);
  return {
    d: { anthropic: client, store: memoryStore(), geminiApiKey: 'g', revenueCatSecretKey: 'rc', fetchFn: fn, ...over.deps },
    anthropicCalls: calls,
    geminiCalls,
  };
}

test('free user gets one image, then 402; the image model never sees the raw dream', async () => {
  const { d, anthropicCalls, geminiCalls } = deps();
  const res = await handleRequest(req(body()), d);
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.image, 'QUJD');
  assert.equal(out.mime_type, 'image/jpeg');
  assert.deepEqual(out.usage, { used: 1, limit: 1 });

  assert.match(anthropicCalls[0].messages[0].content, /sister Anna/);
  const sent = JSON.stringify(geminiCalls[0].body);
  assert.doesNotMatch(sent, /Anna/);
  assert.match(sent, /calm silver sea/);
  assert.equal(geminiCalls[0].body.store, false);
  assert.equal(geminiCalls[0].body.model, 'gemini-nano-banana-2.1');
  assert.equal(geminiCalls[0].headers['x-goog-api-key'], 'g');

  const again = await handleRequest(req(body()), d);
  assert.equal(again.status, 402);
  assert.equal((await again.json()).error, 'premium_required');
});

test('reinstalling (new user id, same device) does not give a second free image', async () => {
  const { d } = deps();
  assert.equal((await handleRequest(req(body()), d)).status, 200);
  const res = await handleRequest(req(body({ app_user_id: 'u2' })), d);
  assert.equal(res.status, 402);
});

test('premium user is capped per month', async () => {
  const { d } = deps({ premium: true, deps: { premiumMonthlyCap: 2 } });
  for (let i = 1; i <= 2; i++) {
    const res = await handleRequest(req(body()), d);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).usage, { used: i, limit: 2 });
  }
  const res = await handleRequest(req(body()), d);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'monthly_cap');
  // Premium images never use up the free image.
  assert.equal(d.store.counts.get('free_img:u1'), undefined);
});

test('a stale "not premium" cache does not block someone who just subscribed', async () => {
  const { d } = deps({ premium: true });
  await d.store.increment('free_img:u1');
  await d.store.cacheEntitlement('u1', false);
  assert.equal((await handleRequest(req(body()), d)).status, 200);
});

test('scenes Haiku will not draw are refused and not counted', async () => {
  const { d, geminiCalls } = deps({ scene: { scene: '', visualizable: false } });
  const res = await handleRequest(req(body()), d);
  assert.equal(res.status, 422);
  assert.equal((await res.json()).error, 'not_visualizable');
  assert.equal(geminiCalls.length, 0);
  assert.equal(d.store.counts.size, 0);
});

test('image model safety block or empty output is a 422 and not counted', async () => {
  for (const gemini of [
    () => new Response('{"error":{"code":400}}', { status: 400 }),
    () => new Response(JSON.stringify({ status: 'failed', steps: [] })),
    () => new Response(JSON.stringify({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'no' }] }] })),
  ]) {
    const { d } = deps({ gemini });
    const res = await handleRequest(req(body()), d);
    assert.equal(res.status, 422);
    assert.equal(d.store.counts.size, 0);
  }
});

test('image model outage is a 502 and not counted', async () => {
  const { d } = deps({ gemini: () => new Response('oops', { status: 503 }) });
  assert.equal((await handleRequest(req(body()), d)).status, 502);
  assert.equal(d.store.counts.size, 0);
});

test('per-IP daily limit', async () => {
  const { d } = deps({ premium: true, deps: { ipDailyLimit: 1 } });
  assert.equal((await handleRequest(req(body()), d)).status, 200);
  assert.equal((await handleRequest(req(body()), d)).status, 429);
  assert.equal((await handleRequest(req(body(), '5.6.7.8'), d)).status, 200);
});

test('missing Gemini key is a 503; bad input is a 400', async () => {
  const { d } = deps({ deps: { geminiApiKey: undefined } });
  assert.equal((await handleRequest(req(body()), d)).status, 503);
  const { d: d2 } = deps();
  assert.equal((await handleRequest(req({ app_user_id: 'u1', dream: { text: '' } }), d2)).status, 400);
  assert.equal((await handleRequest(new Request('https://x', { method: 'GET' }), d2)).status, 405);
});

test('lastImage skips thought previews and takes the last output image', () => {
  assert.deepEqual(lastImage(interaction), { data: 'QUJD', mime_type: 'image/jpeg' });
  assert.equal(lastImage({ status: 'incomplete', steps: interaction.steps }), null);
  assert.equal(lastImage(null), null);
});
