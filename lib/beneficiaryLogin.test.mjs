import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app/api/beneficiary/login/route.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, '');
function login({ application = null, password = 'correct', rpcError = null, locked = false, attempts = 1 } = {}) {
  const calls = [];
  const db = {
    from(table) {
      const q = new Proxy({}, { get(_, key) {
        if (key === 'then') return resolve => resolve({ data: table === 'residents' ? null : table === 'account_requests' ? application : locked ? [{ locked_until: new Date(Date.now() + 60000).toISOString() }] : [], error: null });
        return () => q;
      } }); return q;
    },
    async rpc() { calls.push('failed'); return { error: rpcError }; },
  };
  const context = vm.createContext({
    supabaseAdmin: db, supabase: db, process: { env: {} },
    createHash: () => ({ update: () => ({ digest: () => 'hash' }) }),
    verifyPassword: async (value, hash) => value === hash,
    NextResponse: { json: (body, init) => ({ body, status: init?.status || 200 }) },
    console: { error() {} },
  });
  vm.runInContext(source, context);
  return (async () => { let response; for (let i = 0; i < attempts; i++) response = await context.POST({ headers: new Headers(), json: async () => ({ contactNumber: '09123456789', password }) }); return { response, calls }; })();
}
for (const status of ['Pending', 'Resubmitted', 'Incomplete', 'Rejected', 'Archived']) {
  test(`unapproved ${status} application gets guidance without a session`, async () => {
    const { response, calls } = await login({ application: { status, password_hash: 'correct' } });
    assert.equal(response.status, 403);
    assert.equal(response.body.data, null);
    assert.match(response.body.error, /approval|incomplete|not approved|archived/);
    assert.equal(calls.length, 0);
  });
}
test('wrong password does not reveal application status and records failures', async () => {
  const { response, calls } = await login({ application: { status: 'Pending', password_hash: 'correct' }, password: 'wrong' });
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Incorrect contact number or password.');
  assert.equal(calls.length, 2);
});
test('counter write errors preserve the invalid credentials response', async () => {
  const { response } = await login({ rpcError: { code: '42804', message: 'column window_started_at has wrong type' } });
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'Incorrect contact number or password.');
});
test('lockout still applies to pending applications', async () => {
  const { response } = await login({ locked: true, application: { status: 'Pending', password_hash: 'correct' } });
  assert.equal(response.status, 429);
});

test('local lockout applies after five failures even when database writes fail', async () => {
 const { response, calls } = await login({ attempts: 6, rpcError: { code: '42804', message: 'timestamp mismatch' } });
 assert.equal(response.status, 429);
 assert.equal(calls.length, 10);
});
