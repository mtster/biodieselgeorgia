import { User, UserRole, PermissionsConfig } from '../types';
import { getLocal, setLocal, KEY_USERS } from './localStorage';
import { trackChange } from './historyService';
import { isSupabaseConfigured, supabase } from '../lib/db';
import { defaultPermissions } from '../components/users/UserForm';
import { notifyDbChange } from '../lib/realtime';
import { appCache } from '../utils/cache';

export { KEY_USERS };

export interface PaginatedUsersResult {
  users: User[];
  totalCount: number;
}

export async function getUsersPaginated(
  limit: number = 12,
  offset: number = 0,
  searchTerm?: string
): Promise<PaginatedUsersResult> {
  const filterKey = `search_${(searchTerm || '').trim().toLowerCase()}`;
  const countCacheKey = `count_users_${filterKey}`;
  const pageCacheKey = `users_limit_${limit}_offset_${offset}_${filterKey}`;

  const cachedPage = appCache.get<PaginatedUsersResult>(pageCacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const cachedCount = appCache.get<number>(countCacheKey);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 1. Try server proxy with auth token first
      if (token) {
        try {
          const searchParam = searchTerm?.trim() ? `&search=${encodeURIComponent(searchTerm.trim())}` : '';
          const res = await fetch(`/api/profiles?limit=${limit}&offset=${offset}${searchParam}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (res.ok) {
            const json = await res.json();
            if (json && Array.isArray(json.users)) {
              const decoded = json.users.map((u: any) => decodeProfile(u));
              const result = {
                users: decoded,
                totalCount: json.totalCount !== undefined ? json.totalCount : decoded.length
              };
              appCache.set(countCacheKey, result.totalCount);
              appCache.set(pageCacheKey, result);
              return result;
            }
          }
        } catch (proxyErr) {
          console.warn('Proxy paginated profiles load failed, falling back to direct db call', proxyErr);
        }
      }

      // 2. Direct Supabase call
      let query = supabase
        .from('profiles')
        .select('*', cachedCount !== null ? {} : { count: 'exact' })
        .eq('is_deleted', false);

      if (searchTerm?.trim()) {
        const term = `%${searchTerm.trim()}%`;
        query = query.or(`name.ilike.${term},email.ilike.${term},personal_id.ilike.${term}`);
      }

      query = query.order('name', { ascending: true }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (!error && data) {
        const finalCount = cachedCount !== null ? cachedCount : (count || 0);
        if (cachedCount === null && count !== null) {
          appCache.set(countCacheKey, count);
        }

        const decoded = data.map(u => decodeProfile(u));
        const result = {
          users: decoded,
          totalCount: finalCount
        };
        appCache.set(pageCacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('Supabase getUsersPaginated failed', e);
    }
  }

  const all = getLocal<User[]>(KEY_USERS, DEFAULT_USERS).filter(u => !u.is_deleted).map(u => decodeProfile(u));
  let filtered = all;
  if (searchTerm?.trim()) {
    const term = searchTerm.trim().toLowerCase();
    filtered = filtered.filter(u => (u.name || '').toLowerCase().includes(term) || (u.email || '').toLowerCase().includes(term) || (u.personal_id || '').includes(term));
  }
  return {
    users: filtered.slice(offset, offset + limit),
    totalCount: filtered.length
  };
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

  return {
    ...p,
    role,
    permissions: perms || {},
    warehouse_id: p.warehouse_id || undefined,
    vendor_id: p.vendor_id || undefined
  };
}

export async function getUsers(): Promise<User[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let data = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch('/api/profiles', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (res.ok) {
            data = await res.json();
          }
        }
      } catch (err) {
        console.warn('Failed to load profiles via proxy, falling back to direct db call', err);
      }

      if (!data) {
        const { data: profiles, error } = await supabase.from('profiles').select('*').eq('is_deleted', false);
        if (error) throw error;
        data = profiles;
      }
      return (data || []).map(decodeProfile);
    } catch (e) {
      console.error('Supabase users loading failed', e);
      return [];
    }
  }
  return getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
}

export async function saveUser(user: User, loggerName: string): Promise<User> {
  let finalUser = { ...user };
  const isNew = !user.id || user.id.length < 10;
  const isDriverOrLogist = user.role === 'driver' || user.role === 'logistics_manager';

  if (isSupabaseConfigured && supabase) {
    if (isDriverOrLogist) {
      const profileId = (user.id && user.id.length > 10) ? user.id : crypto.randomUUID();
      const cleanEmail = user.email && user.email.trim() ? user.email.trim() : `${profileId.substring(0, 8)}@noemail.local`;
      const profilePayload: any = {
        id: profileId,
        name: user.name,
        personal_id: user.personal_id,
        email: cleanEmail,
        phone: user.phone,
        role: user.role,
        permissions: {},
        is_blocked: user.is_blocked || false,
        is_deleted: false,
        vendor_id: user.vendor_id || null
      };

      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .upsert([profilePayload], { onConflict: 'id' })
        .select()
        .single();

      if (profileErr) {
        console.error('Failed to save driver profile directly:', profileErr);
        throw profileErr;
      }
      finalUser = decodeProfile(profileData || profilePayload);
      await trackChange('USERS', isNew ? 'CREATE' : 'UPDATE', loggerName, `Saved driver/logist: ${user.name}`);
      return finalUser;
    }

    try {
      const functionUrl = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/functions/v1/create-user`;
      
      if (isNew) {
        let resData: any = null;
        let createdOnExpress = false;
        
        const useProxy = typeof window !== 'undefined' && !window.location.hostname.includes('vercel.app');
        if (useProxy) {
          try {
            const sessionRes = await supabase.auth.getSession();
            const token = sessionRes.data.session?.access_token;

            const res = await fetch('/api/create-user', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify(user)
            });
            if (res.ok) {
              resData = await res.json();
              createdOnExpress = true;
            } else {
              const errBody = await res.json().catch(() => ({}));
              const errorMsg = errBody?.error || (errBody?.message ? `${errBody.error || ''}: ${errBody.message}` : null) || `Server error (${res.status})`;
              throw new Error(errorMsg);
            }
          } catch (err: any) {
            console.error('Express /api/create-user failed:', err);
            // If the server responded with an error, propagate it directly
            if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
              throw err;
            }
          }
        }

        if (!createdOnExpress) {
          const sessionRes = await supabase.auth.getSession();
          const token = sessionRes.data.session?.access_token;
          if (!token) throw new Error('Not authenticated');

          const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
          const edgeRes = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              action: 'create',
              email: user.email,
              password: user.password || 'Georgia2026!',
              name: user.name,
              personal_id: user.personal_id,
              phone: user.phone,
              role: user.role,
              permissions: user.permissions,
              warehouse_id: user.warehouse_id,
              vendor_id: user.vendor_id
            })
          });
          
          resData = await edgeRes.json().catch(() => ({}));
          if (!edgeRes.ok) throw new Error(resData?.error || resData?.message || 'Edge function error creating user');
        }

        if (resData && resData.user) {
          finalUser = resData.user;
        } else if (resData && resData.profile) {
          finalUser = resData.profile;
        } else {
          throw new Error('No user or profile data returned');
        }

      } else {
        // UPDATE Existing
        let updatedOnEdge = false;
        
        try {
          const sessionRes = await supabase.auth.getSession();
          const token = sessionRes.data.session?.access_token;
          
          if (token) {
            // First try internal server API endpoint for auth updates
            const serverRes = await fetch('/api/update-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                id: user.id,
                email: user.email,
                password: user.password || '',
                name: user.name,
                personal_id: user.personal_id,
                phone: user.phone,
                role: user.role,
                permissions: user.permissions,
                vendor_id: user.vendor_id,
                is_blocked: user.is_blocked || false
              })
            });
            if (serverRes.ok) {
              updatedOnEdge = true;
            } else {
              // Edge function fallback
              const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
              const edgeRes = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  action: 'update',
                  id: user.id,
                  email: user.email,
                  password: user.password || '',
                  name: user.name,
                  personal_id: user.personal_id,
                  phone: user.phone,
                  role: user.role,
                  permissions: user.permissions,
                  vendor_id: user.vendor_id,
                  is_blocked: user.is_blocked || false
                })
              });
              if (edgeRes.ok) updatedOnEdge = true;
            }
          }
        } catch (err: any) {
          console.warn('User update auth API failed, falling back to profiles update:', err);
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            email: user.email,
            name: user.name,
            personal_id: user.personal_id,
            phone: user.phone,
            role: user.role,
            permissions: user.permissions,
            is_blocked: user.is_blocked || false,
            vendor_id: user.vendor_id
          })
          .eq('id', user.id);
          
        if (profileError && !updatedOnEdge) throw profileError;
      }
    } catch (e) {
      console.error('Supabase saveUser failed', e);
      throw e;
    }
  } else {
    // Local storage fallback
    finalUser = {
      ...user,
      id: isNew ? Math.floor(Math.random() * 1000000).toString() : user.id,
      created_at: user.created_at || new Date().toISOString()
    };
  }

  // Clear in-memory caches
  appCache.clear('users_');
  appCache.clear('count_users_');

  const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
  if (isNew) {
    setLocal(KEY_USERS, [...list, decodeProfile(finalUser)]);
    await trackChange(loggerName, 'User added', 'Name', '', finalUser.name);
  } else {
    setLocal(KEY_USERS, list.map(item => item.id === finalUser.id ? decodeProfile(finalUser) : item));
    await trackChange(loggerName, 'User updated', 'Name', '', finalUser.name);
  }

  notifyDbChange('profiles', isNew ? 'CREATE' : 'UPDATE', finalUser.id);
  return decodeProfile(finalUser);
}

export async function deleteUser(id: string, name: string, loggerName: string, currentUserRole?: string): Promise<boolean> {
  const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
  const target = list.find(item => item.id === id);
  if (target?.role === 'admin' && currentUserRole && currentUserRole !== 'admin') {
    throw new Error('ადმინისტრატორის როლის მქონე მომხმარებლის წაშლა შეუძლია მხოლოდ ადმინისტრატორს.');
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // First check if profile is admin in DB and whether current user is non-admin
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', id)
        .maybeSingle();

      if (dbProfile?.role === 'admin' && currentUserRole && currentUserRole !== 'admin') {
        throw new Error('ადმინისტრატორის როლის მქონე მომხმარებლის წაშლა შეუძლია მხოლოდ ადმინისტრატორს.');
      }

      // Mark both is_deleted: true AND is_blocked: true
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_deleted: true, is_blocked: true })
        .eq('id', id);

      if (updateError) {
        throw updateError;
      }
      
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      
      // Try edge function
      if (token) {
        const functionUrl = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/functions/v1/create-user`;
        const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
        await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'delete', id })
        }).catch(() => {});
      }

      // Also call backend express endpoint if available
      await fetch('/api/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ id })
      }).catch(() => {});

    } catch (e: any) {
      console.error('Supabase deleteUser failed', e);
      throw e;
    }
  }
  
  setLocal(KEY_USERS, list.map(item => item.id === id ? { ...item, is_deleted: true, is_blocked: true } : item));
  
  await trackChange(loggerName, 'User deleted', 'Name', name, '');
  notifyDbChange('profiles', 'DELETE', id);
  return true;
}
