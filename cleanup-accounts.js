// Clean database accounts: keep one Admin, delete all other Admin/Staff auth users,
// and delete all beneficiary account requests + corresponding resident accounts.
//
// Usage:
//   node cleanup-accounts.js --keep-email admin@gmail.com --yes
//   node cleanup-accounts.js --keep-email admin@gmail.com --dry-run
//
// Requires .env.local with:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

const keepEmail = getArg('--keep-email');
const dryRun = args.includes('--dry-run');
const yes = args.includes('--yes');

if (!keepEmail) {
  console.error('Missing --keep-email');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function main() {
  // 1) Load users + decide keep/delete
  const { data: users, error: usersErr } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, status')
    .order('created_at', { ascending: true });

  if (usersErr) throw new Error(`Failed to load users: ${usersErr.message}`);

  const keep = (users || []).find((u) => String(u.email).toLowerCase() === keepEmail.toLowerCase());
  if (!keep) throw new Error(`Keep user not found in public.users: ${keepEmail}`);
  if (keep.role !== 'Admin') throw new Error(`Keep user must be role=Admin. Found: ${keep.role}`);

  const toDelete = (users || []).filter((u) => u.id !== keep.id);

  // 2) Load beneficiary contacts from account_requests BEFORE deleting
  let beneficiaryContacts = [];
  try {
    const { data: reqs, error: reqErr } = await supabaseAdmin
      .from('account_requests')
      .select('contact_number')
      .not('id', 'is', null);

    if (reqErr) throw reqErr;

    beneficiaryContacts = Array.from(
      new Set(
        (reqs || [])
          .map((r) => String(r.contact_number || '').trim())
          .filter((v) => v && v !== 'null' && v !== 'undefined'),
      ),
    );
  } catch (e) {
    // account_requests may not exist on older installs
    console.warn('[cleanup] Unable to read account_requests contacts:', e?.message || e);
  }

  const plan = {
    keepAdmin: { id: keep.id, email: keep.email, name: keep.full_name },
    deleteAuthUsersCount: toDelete.length,
    deleteAuthUsersEmails: toDelete.map((u) => u.email),
    deletePublicUsersExceptKeep: true,
    deleteAccountRequests: true,
    deleteResidentsByContactsCount: beneficiaryContacts.length,
  };

  console.log(JSON.stringify({ dryRun, plan }, null, 2));

  if (dryRun) return;

  if (!yes) {
    throw new Error('Refusing to run without --yes. Re-run with --yes to confirm destructive cleanup.');
  }

  // 3) Delete other Admin/Staff accounts from Supabase Auth
  // Note: In some schemas, deleting auth.users does NOT cascade to public.users,
  // so we also delete public.users rows explicitly in step 3b.
  const authDeleteResults = [];
  for (const u of toDelete) {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (error) throw error;
      authDeleteResults.push({ id: u.id, email: u.email, ok: true });
    } catch (e) {
      authDeleteResults.push({ id: u.id, email: u.email, ok: false, error: e?.message || String(e) });
    }
  }

  // 3b) Delete public.users rows except the kept Admin
  let publicUsersDeleted = null;
  try {
    const { error } = await supabaseAdmin.from('users').delete().neq('email', keep.email);
    if (error) throw error;
    publicUsersDeleted = true;
  } catch (e) {
    publicUsersDeleted = { ok: false, error: e?.message || String(e) };
  }

  // 4) Delete all account_requests
  let accountRequestsDeleted = null;
  try {
    const { error } = await supabaseAdmin.from('account_requests').delete().not('id', 'is', null);
    if (error) throw error;
    accountRequestsDeleted = true;
  } catch (e) {
    accountRequestsDeleted = { ok: false, error: e?.message || String(e) };
  }

  // 5) Delete residents matching those contacts (beneficiary accounts)
  const residentDeleteResults = [];
  if (beneficiaryContacts.length) {
    for (const group of chunk(beneficiaryContacts, 100)) {
      try {
        const { error } = await supabaseAdmin
          .from('residents')
          .delete()
          .in('contact_number', group);
        if (error) throw error;
        residentDeleteResults.push({ ok: true, count: group.length });
      } catch (e) {
        residentDeleteResults.push({ ok: false, count: group.length, error: e?.message || String(e) });
      }
    }
  }

  // 6) Best-effort: also delete any residents that still have a password_hash (if column exists)
  let passwordHashCleanup = null;
  try {
    const { error } = await supabaseAdmin
      .from('residents')
      .delete()
      .not('password_hash', 'is', null);
    if (error) throw error;
    passwordHashCleanup = true;
  } catch (e) {
    // ignore if column doesn't exist
    passwordHashCleanup = { ok: false, error: e?.message || String(e) };
  }

  // 7) Verify remaining users
  const { data: remaining, error: remainingErr } = await supabaseAdmin
    .from('users')
    .select('email, role, status')
    .order('created_at', { ascending: true });

  if (remainingErr) throw new Error(`Failed to verify remaining users: ${remainingErr.message}`);

  console.log(
    JSON.stringify(
      {
        keep: keep.email,
        authDeleteResults,
        publicUsersDeleted,
        accountRequestsDeleted,
        residentDeleteResults,
        passwordHashCleanup,
        remainingUsers: remaining,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => {
    console.log('\n✅ Cleanup complete.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Cleanup failed:', err?.message || err);
    process.exit(1);
  });
