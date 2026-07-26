import { normalizeSectorAccess } from '@/lib/sectorAccess';

export const ADMIN_ROLE = 'Admin';
export const LEGACY_STAFF_ROLE = 'Staff';

export const COORDINATOR_ROLE_SECTORS = Object.freeze({
  'PWD Coordinator': 'pwd',
  'Solo Parent Coordinator': 'solo_parent',
  'Senior Citizen Coordinator': 'senior_citizen',
});

export const COORDINATOR_ROLES = Object.freeze(Object.keys(COORDINATOR_ROLE_SECTORS));
export const CREATABLE_USER_ROLES = Object.freeze([ADMIN_ROLE, ...COORDINATOR_ROLES]);

// Staff remains authorized only so existing accounts and sessions keep working.
export const PORTAL_ROLES = Object.freeze([
  ...CREATABLE_USER_ROLES,
  LEGACY_STAFF_ROLE,
]);

export function isAdminRole(role) {
  return role === ADMIN_ROLE;
}

export function isCoordinatorRole(role) {
  return Object.hasOwn(COORDINATOR_ROLE_SECTORS, role);
}

export function isCreatableUserRole(role) {
  return CREATABLE_USER_ROLES.includes(role);
}

export function isPortalRole(role) {
  return PORTAL_ROLES.includes(role);
}

export function getRoleSectorAccess(role, legacySectorAccess = []) {
  if (isAdminRole(role)) return [];
  if (isCoordinatorRole(role)) return [COORDINATOR_ROLE_SECTORS[role]];
  if (role === LEGACY_STAFF_ROLE) return normalizeSectorAccess(legacySectorAccess);
  return [];
}

export function getRoleLabel(role, sectorAccess = []) {
  if (role !== LEGACY_STAFF_ROLE) return role || 'Unknown';

  const normalized = normalizeSectorAccess(sectorAccess);
  if (normalized.length === 1) {
    const matchingRole = COORDINATOR_ROLES.find(
      (coordinatorRole) => COORDINATOR_ROLE_SECTORS[coordinatorRole] === normalized[0],
    );
    if (matchingRole) return matchingRole;
  }

  return 'Staff (Legacy)';
}
