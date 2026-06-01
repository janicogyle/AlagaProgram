import { supabaseAdmin } from '@/lib/supabaseClient';

export function isMissingActivityLogsTable(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    msg.includes('activity_logs') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    code === '42p01'
  );
}

function clean(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function actorNameFromStaff(auth) {
  const fullName = clean(auth?.profile?.full_name);
  if (fullName) return fullName;

  const email = clean(auth?.profile?.email || auth?.authUser?.email);
  if (email?.includes('@')) return email.split('@')[0];
  return email || 'Staff';
}

export function buildStaffActor(auth) {
  return {
    actor_user_id: auth?.authUser?.id || auth?.profile?.id || null,
    actor_name: actorNameFromStaff(auth),
    actor_role: auth?.profile?.role || 'Staff',
  };
}

export function buildBeneficiaryActor(resident) {
  const name = [resident?.first_name, resident?.middle_name, resident?.last_name]
    .map((part) => clean(part))
    .filter(Boolean)
    .join(' ');

  return {
    actor_resident_id: resident?.id || null,
    actor_name: name || clean(resident?.contact_number) || 'Beneficiary',
    actor_role: 'Beneficiary',
  };
}

export async function logActivity(input = {}, dbClient = supabaseAdmin) {
  const db = dbClient || supabaseAdmin;
  if (!db) return { ok: false, skipped: true };

  const payload = {
    actor_user_id: input.actor_user_id || null,
    actor_resident_id: input.actor_resident_id || null,
    actor_name: clean(input.actor_name) || 'System',
    actor_role: clean(input.actor_role) || 'System',
    action: clean(input.action) || 'Updated record',
    message: clean(input.message),
    entity_type: clean(input.entity_type),
    entity_id: input.entity_id || null,
    reference_number: clean(input.reference_number),
    link: clean(input.link),
    audience_user_id: input.audience_user_id || null,
    audience_resident_id: input.audience_resident_id || null,
  };

  try {
    const { data, error } = await db.from('activity_logs').insert(payload).select('id').single();
    if (error) throw error;
    return { ok: true, id: data?.id || null };
  } catch (err) {
    if (!isMissingActivityLogsTable(err)) {
      console.warn('Unable to write activity log:', err?.message || err);
    }
    return { ok: false, error: err };
  }
}

export async function logStaffActivity(auth, activity, dbClient = supabaseAdmin) {
  return logActivity(
    {
      ...buildStaffActor(auth),
      ...activity,
    },
    dbClient,
  );
}

export async function logBeneficiaryActivity(resident, activity, dbClient = supabaseAdmin) {
  return logActivity(
    {
      ...buildBeneficiaryActor(resident),
      audience_resident_id: activity?.audience_resident_id || resident?.id || null,
      ...activity,
    },
    dbClient,
  );
}

export async function readOptionalStaffActor(request, dbClient = supabaseAdmin) {
  const db = dbClient || supabaseAdmin;
  const authHeader = request?.headers?.get?.('authorization') || '';
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || null;
  if (!db || !token) return null;

  try {
    const { data: userData, error: userError } = await db.auth.getUser(token);
    const authUser = userData?.user;
    if (userError || !authUser) return null;

    const { data: profile, error: profileError } = await db
      .from('users')
      .select('id, role, status, full_name, email')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile || profile.status !== 'Active') return null;
    if (!['Admin', 'Staff'].includes(profile.role)) return null;

    return buildStaffActor({ authUser, profile });
  } catch {
    return null;
  }
}
