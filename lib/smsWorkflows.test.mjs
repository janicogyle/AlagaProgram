import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const state = globalThis.__smsWorkflowTest = { results: [], queries: [], sent: [], fail: new Set() };
const mockUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;
const dbUrl = mockUrl(`export const supabaseAdmin = { from(table) {
  const state = globalThis.__smsWorkflowTest;
  const query = { table, calls: [] }; state.queries.push(query);
  const builder = new Proxy({}, {get(_target, key) {
    if (key === 'then') return (resolve, reject) => {
      if (!state.results.length) return Promise.reject(new Error('Unexpected query: '+table)).then(resolve,reject);
      return Promise.resolve(state.results.shift()).then(resolve,reject);
    };
    return (...args) => { query.calls.push([key,...args]); return builder; };
  }}); return builder;
}};`);
const smsUrl = mockUrl(`export const normalizeSmsContactNumber = value => /^09\\d{9}$/.test(value || '') ? value : null;
export async function sendSms(args) { const s=globalThis.__smsWorkflowTest; s.sent.push(args); if(s.fail.has(args.to)) throw new Error('Mock provider failure'); return {providerId:'test'}; }`);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/lib/supabaseClient') return { url: dbUrl, shortCircuit: true };
  if (specifier === '@/lib/sms.server') return { url: smsUrl, shortCircuit: true };
  if (specifier === '@/lib/activityLogger.server') return { url: mockUrl('export async function logActivity() {}'), shortCircuit: true };
  if (specifier === 'next/server') return next('next/server.js', context);
  if (specifier.startsWith('@/')) return next(pathToFileURL(path.resolve(`${specifier.slice(2)}.js`)).href, context);
  return next(specifier, context);
} });
const eligibility = await import('../app/api/cron/eligibility-reminders/route.js');
const renewal = await import('../app/api/cron/beneficiary-id-renewals/route.js');
function reset(results) {
  state.results = results.map(data => ({ data, error: null }));
  state.queries = []; state.sent = []; state.fail = new Set();
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.SMS_CRON_SECRET = 'different-legacy-secret';
}
const request = () => new Request('http://localhost/api/cron/test', { headers: { authorization: 'Bearer test-cron-secret' } });
const resident = (id, phone) => ({ id, contact_number: phone, contact_verified: true, verification_method: 'sms', status: 'Active' });

test('cron GET rejects unauthenticated requests without querying or sending', async () => {
  reset([]);
  assert.equal((await eligibility.GET(new Request('http://localhost/test'))).status, 401);
  assert.equal((await renewal.GET(new Request('http://localhost/test'))).status, 401);
  assert.equal(state.queries.length, 0);
});

test('eligibility reminders exclude active requests and retry failures without aborting the batch', async () => {
  const released = id => ({ resident_id: id, status: 'Released', released_at: '2025-01-01', created_at: '2025-01-01' });
  reset([
    [released('a'), released('b'), released('c'), { resident_id: 'c', status: 'Pending', created_at: '2026-01-01' }],
    [resident('a','09159937831'), resident('b','09159937832'), resident('c','09159937833')],
    [],
  ]);
  state.fail.add('09159937831');
  const response = await eligibility.GET(request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.sent, 1);
  assert.equal(result.data.failed, 1);
  assert.deepEqual(state.sent.map(row => row.to), ['09159937831','09159937832']);
  assert.ok(state.queries.find(q => q.table === 'sms_logs').calls.some(c => c[0] === 'eq' && c[1] === 'status' && c[2] === 'sent'));
  assert.equal(state.results.length, 0);
});

test('successful eligibility reminders are not sent again', async () => {
  reset([
    [{ resident_id: 'a', status: 'Released', released_at: '2025-01-01', created_at: '2025-01-01' }],
    [resident('a','09159937831')],
    [{ reference_key: 'a:2025-04-01' }],
  ]);
  const result = await (await eligibility.GET(request())).json();
  assert.equal(result.data.skipped, 1);
  assert.equal(state.sent.length, 0);
});

test('ID renewal reminder failures do not suppress other beneficiaries', async () => {
  const expires = new Date(); expires.setDate(expires.getDate() + 7);
  const card = id => ({ id: `card-${id}`, resident_id: id, issued_at: '2025-01-01', expires_at: expires.toISOString(), status: 'Expiring Soon' });
  reset([
    [card('a'),card('b')],
    [{...resident('a','09159937831'),status:'Expiring Soon'},{...resident('b','09159937832'),status:'Expiring Soon'}],
    [],
  ]);
  state.fail.add('09159937831');
  const response = await renewal.GET(request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.sent, 1);
  assert.equal(result.data.failed, 1);
  assert.equal(state.sent.length, 2);
  assert.equal(state.results.length, 0);
});
