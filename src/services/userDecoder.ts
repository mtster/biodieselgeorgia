import { User } from '../types';
import { KEY_USERS } from './localStorage';
import { defaultPermissions } from '../components/users/UserForm';

export { KEY_USERS };

export interface PaginatedUsersResult {
  users: User[];
  totalCount: number;
}

export const DEFAULT_USERS: User[] = [
  {
    id: '00000000-0000-4000-a000-000000000000',
    name: 'Administrator',
    personal_id: '12345678901',
    email: 'admin@biodiesel.ge',
    password: 'admin123',
    phone: '599112233',
    role: 'admin',
    permissions: {},
    is_deleted: false,
    is_blocked: false,
    created_at: new Date().toISOString()
  }
];

export function decodeProfile(p: any): User {
  if (!p) return p;
  const role = p.role || 'operator';
  let perms = p.permissions;
  if (typeof perms === 'string') {
    try {
      perms = JSON.parse(perms);
    } catch (e) {
      perms = null;
    }
  }

  // If perms is null/undefined, initialize with defaultPermissions for role
  if (perms === null || perms === undefined) {
    perms = defaultPermissions[role] ? JSON.parse(JSON.stringify(defaultPermissions[role])) : {};
  }

  let email = p.email || '';
  if (email.includes('@internal.driver') || email.includes('@internal.app')) {
    email = '';
  } else if ((role === 'driver' || role === 'driver_assistant') && p.personal_id && email.startsWith(p.personal_id) && (email.endsWith('@company.ge') || email.endsWith('@biodiesel.ge'))) {
    email = '';
  }

  return {
    ...p,
    email,
    role,
    permissions: perms || {},
    warehouse_id: p.warehouse_id || undefined,
    vendor_id: p.vendor_id || undefined
  };
}
