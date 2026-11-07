import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const configSource = await readFile(new URL('../js/supabase-config.js', import.meta.url), 'utf8');

function configFor(url, key) {
  const source = configSource
    .replace("const acadelySupabaseUrl = '';", `const acadelySupabaseUrl = ${JSON.stringify(url)};`)
    .replace("const acadelySupabasePublishableKey = '';", `const acadelySupabasePublishableKey = ${JSON.stringify(key)};`);
  const sandbox = { window: {}, atob: (value) => Buffer.from(value, 'base64').toString('binary') };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.ACADELY_SUPABASE_CONFIG;
}

test('cloud remains disabled until a valid Supabase project and public key are supplied', () => {
  assert.equal(configFor('', '').configured, false);
  assert.equal(configFor('https://example.supabase.co', '').configured, false);
  assert.equal(configFor('http://example.supabase.co', 'sb_publishable_valid123').configured, false);
});

test('accepts a Supabase publishable key and legacy anon JWT', () => {
  assert.equal(configFor('https://example.supabase.co', 'sb_publishable_valid123').configured, true);
  const payload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
  assert.equal(configFor('https://example.supabase.co', `header.${payload}.signature`).configured, true);
});

test('rejects secret keys and JWTs with privileged roles', () => {
  assert.equal(configFor('https://example.supabase.co', 'sb_secret_do_not_use').configured, false);
  const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  assert.equal(configFor('https://example.supabase.co', `header.${payload}.signature`).configured, false);
});
