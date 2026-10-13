import {
  COORDINATOR_ROLES,
  getEffectiveStaffRole,
} from './userRoles.js';

const ACTOR_ROLES = new Set([
  'Admin',
  'PWD Coordinator',
  'Solo Parent Coordinator',
  'Senior Citizen Coordinator',
  'Staff',
  'Beneficiary',
  'System',
]);

export const ACTIVITY_LOG_FIELDS = [
  'id',
  'actor_user_id',
  'actor_resident_id',
  'actor_name',
  'actor_role',
  'action',
  'message',
  'entity_type',
  'entity_id',
  'reference_number',
  'link',
  'audience_user_id',
  'audience_resident_id',
  'created_at',
].join(', ');

const MANILA_OFFSET = '+08:00';

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function cleanText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanPostgrestSearch(value) {
  return cleanText(value)
    .replace(/[,%():'"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateBoundary(value, endExclusive = false) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';

  const parsed = new Date(`${raw}T00:00:00${MANILA_OFFSET}`);
  if (!Number.isFinite(parsed.getTime())) return '';
  if (endExclusive) parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString();
}

export function parseActivityLogFilters(searchParams) {
  const role = cleanText(searchParams.get('role'), 80);
  const rawDateFrom = cleanText(searchParams.get('dateFrom'), 10);
  const rawDateTo = cleanText(searchParams.get('dateTo'), 10);
  const dateFrom = dateBoundary(rawDateFrom);
  const dateToExclusive = dateBoundary(rawDateTo, true);
  return {
    page: clampInteger(searchParams.get('page'), 1, 1, 100000),
    pageSize: clampInteger(searchParams.get('pageSize'), 25, 10, 100),
    search: cleanPostgrestSearch(searchParams.get('search')),
    user: cleanPostgrestSearch(searchParams.get('user')),
    role: ACTOR_ROLES.has(role) ? role : '',
    action: cleanPostgrestSearch(searchParams.get('action')),
    dateFrom,
    dateFromLabel: dateFrom ? rawDateFrom : '',
    dateToExclusive,
    dateToLabel: dateToExclusive ? rawDateTo : '',
  };
}

function applyViewerScope(query, viewer) {
  if (viewer?.kind === 'admin') return query;
  if (viewer?.kind === 'staff' && viewer.userId) {
    return query.eq('actor_user_id', viewer.userId);
  }
  if (viewer?.kind === 'beneficiary' && viewer.residentId) {
    return query.or(
      `actor_resident_id.eq.${viewer.residentId},audience_resident_id.eq.${viewer.residentId}`,
    );
  }
  return null;
}

function applyFilters(query, filters, coordinatorActorIds = []) {
  let next = query;
  if (filters.user) next = next.ilike('actor_name', `%${filters.user}%`);
  if (filters.role) {
    if (COORDINATOR_ROLES.includes(filters.role) && coordinatorActorIds.length) {
      const clauses = [
        `actor_role.eq."${filters.role}"`,
        `actor_user_id.in.(${coordinatorActorIds.join(',')})`,
      ];
      next = next.or(clauses.join(','));
    } else {
      next = next.eq('actor_role', filters.role);
    }
  }
  if (filters.action) next = next.ilike('action', `%${filters.action}%`);
  if (filters.dateFrom) next = next.gte('created_at', filters.dateFrom);
  if (filters.dateToExclusive) next = next.lt('created_at', filters.dateToExclusive);

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    next = next.or(
      [
        `actor_name.ilike.${pattern}`,
        `actor_role.ilike.${pattern}`,
        `action.ilike.${pattern}`,
        `message.ilike.${pattern}`,
        `reference_number.ilike.${pattern}`,
        `entity_type.ilike.${pattern}`,
      ].join(','),
    );
  }

  return next;
}

async function getCoordinatorActorIds(db, role) {
  if (!COORDINATOR_ROLES.includes(role)) return [];

  const { data, error } = await db
    .from('users')
    .select('id, role, sector_access')
    .in('role', [role, 'Staff']);
  if (error) throw error;

  return (data || [])
    .filter((user) => getEffectiveStaffRole(user.role, user.sector_access) === role)
    .map((user) => user.id)
    .filter(Boolean);
}

async function normalizeLegacyStaffRoles(db, rows) {
  const legacyActorIds = [
    ...new Set(
      (rows || [])
        .filter((row) => row.actor_role === 'Staff' && row.actor_user_id)
        .map((row) => row.actor_user_id),
    ),
  ];
  if (!legacyActorIds.length) return rows || [];

  const { data, error } = await db
    .from('users')
    .select('id, role, sector_access')
    .in('id', legacyActorIds);
  if (error) throw error;

  const roleByActorId = new Map(
    (data || []).map((user) => [
      user.id,
      getEffectiveStaffRole(user.role, user.sector_access),
    ]),
  );

  return (rows || []).map((row) => {
    const effectiveRole = roleByActorId.get(row.actor_user_id);
    return effectiveRole && effectiveRole !== row.actor_role
      ? { ...row, actor_role: effectiveRole }
      : row;
  });
}

export async function fetchActivityLogRows({
  db,
  viewer,
  filters,
  page = filters?.page || 1,
  pageSize = filters?.pageSize || 25,
  exportLimit = null,
}) {
  let query = db
    .from('activity_logs')
    .select(ACTIVITY_LOG_FIELDS, { count: 'exact' });

  query = applyViewerScope(query, viewer);
  if (!query) return { rows: [], total: 0 };
  const coordinatorActorIds = await getCoordinatorActorIds(db, filters?.role);
  query = applyFilters(query, filters || {}, coordinatorActorIds);
  query = query.order('created_at', { ascending: false });

  if (Number.isFinite(exportLimit)) {
    query = query.limit(Math.max(1, Math.min(exportLimit, 5000)));
  } else {
    const from = (Math.max(page, 1) - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = await normalizeLegacyStaffRoles(db, data || []);
  return { rows, total: Number(count || 0) };
}

export function getActivityLogViewerFromStaffAuth(auth) {
  if (auth?.profile?.role === 'Admin') {
    return {
      kind: 'admin',
      userId: auth?.authUser?.id || auth?.profile?.id || null,
      role: 'Admin',
      name: auth?.profile?.full_name || auth?.profile?.email || 'Admin',
    };
  }

  return {
    kind: 'staff',
    userId: auth?.authUser?.id || auth?.profile?.id || null,
    role: getEffectiveStaffRole(
      auth?.profile?.role || 'Staff',
      auth?.profile?.sector_access || [],
    ),
    name: auth?.profile?.full_name || auth?.profile?.email || 'Staff',
  };
}

export function getActivityLogViewerFromBeneficiarySession(session) {
  return {
    kind: 'beneficiary',
    residentId: session?.residentId || null,
    role: 'Beneficiary',
    name: 'Beneficiary',
  };
}

