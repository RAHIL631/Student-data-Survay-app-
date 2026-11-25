import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { corsHeaders as supabaseCorsHeaders } from '@supabase/supabase-js/cors';
import { getAllowedOrigins, getCorsResponseHeaders, isAllowedOrigin, productionInvitationOrigin } from '../../supabase/functions/invite-user/cors-policy.js';

test('production origin is always allowed, including with an explicit allowlist', () => {
  const fallback = getAllowedOrigins(undefined);
  const configured = getAllowedOrigins('https://preview.example.test, https://staff.example.test');

  assert.equal(fallback.has(productionInvitationOrigin), true);
  assert.equal(configured.has(productionInvitationOrigin), true);
  assert.equal(configured.has('https://preview.example.test'), true);
  assert.equal(configured.has('https://staff.example.test'), true);
  assert.equal(configured.size, 3);
});

test('localhost origins remain available in the default fallback only', () => {
  const fallback = getAllowedOrigins(undefined);
  const configured = getAllowedOrigins('https://staff.example.test');

  assert.equal(fallback.has('http://localhost:5173'), true);
  assert.equal(fallback.has('http://127.0.0.1:5173'), true);
  assert.equal(configured.has('http://localhost:5173'), false);
  assert.equal(configured.has('http://127.0.0.1:5173'), false);
});

test('duplicate production origins collapse and untrusted origins remain rejected', () => {
  const configured = getAllowedOrigins(`${productionInvitationOrigin}, ${productionInvitationOrigin}, https://preview.example.test`);

  assert.equal(configured.size, 2);
  assert.equal(isAllowedOrigin(productionInvitationOrigin, configured), true);
  assert.equal(isAllowedOrigin('https://evil.example.test', configured), false);
});

test('preflight and actual responses allow the current Supabase SDK request headers', () => {
  const origins = getAllowedOrigins(undefined);
  const responseHeaders = getCorsResponseHeaders(productionInvitationOrigin, origins, supabaseCorsHeaders);
  const allowedHeaders = responseHeaders['Access-Control-Allow-Headers'].split(',').map((header) => header.trim());

  assert.equal(responseHeaders['Access-Control-Allow-Origin'], productionInvitationOrigin);
  assert.equal(responseHeaders['Access-Control-Allow-Methods'], 'POST, OPTIONS');
  for (const header of ['authorization', 'apikey', 'x-client-info', 'content-type', 'x-retry-count', 'traceparent', 'tracestate', 'baggage']) {
    assert.ok(allowedHeaders.includes(header), `missing SDK CORS header: ${header}`);
  }
});

test('untrusted origins receive no CORS permission headers', () => {
  const headers = getCorsResponseHeaders('https://evil.example.test', getAllowedOrigins(undefined), supabaseCorsHeaders);

  assert.deepEqual(headers, {});
});

test('OPTIONS and POST apply the same origin policy before handling the request', () => {
  const source = fs.readFileSync(new URL('../../supabase/functions/invite-user/index.ts', import.meta.url), 'utf8');
  const preflight = source.slice(source.indexOf("if (request.method === 'OPTIONS')"), source.indexOf("if (request.method !== 'POST')"));
  const post = source.slice(source.indexOf("if (request.method !== 'POST')"), source.indexOf('const authorization ='));

  assert.match(preflight, /!isAllowedOrigin\(origin, allowedOrigins\)/);
  assert.match(preflight, /getCorsResponseHeaders\(origin, allowedOrigins, supabaseCorsHeaders\)/);
  assert.match(post, /!isAllowedOrigin\(origin, allowedOrigins\)/);
  assert.match(source, /getCorsResponseHeaders\(origin, allowedOrigins, supabaseCorsHeaders\)/);
  assert.match(source, /npm:@supabase\/supabase-js@2\.119\.0\/cors/);
});
