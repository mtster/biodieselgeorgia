import { User } from '../types';
import { getLocal, setLocal } from './localStorage';
import { trackChange } from './historyService';
import { isSupabaseConfigured, supabase } from '../lib/db';
import { notifyDbChange } from '../lib/realtime';
import { appCache } from '../utils/cache';
import { sanitizePostgrestSearchTerm } from '../utils/sanitize';
import { KEY_USERS, DEFAULT_USERS, PaginatedUsersResult, decodeProfile } from './userDecoder';

export { KEY_USERS, DEFAULT_USERS, decodeProfile };
export type { PaginatedUsersResult };

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
  if (cachedCount !== null && offset >= cachedCount && cachedCount > 0) {
    return { users: [], totalCount: cachedCount };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('profiles')
        .select('*', cachedCount !== null ? {} : { count: 'exact' })
        .eq('is_deleted', false);

      const safeTerm = sanitizePostgrestSearchTerm(searchTerm);
      if (safeTerm) {
        const term = `%${safeTerm}%`;
        query = query.or(`name.ilike.${term},email.ilike.${term},personal_id.ilike.${term}`);
      }

      query = query.order('name', { ascending: true }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) {
        if (error.code === 'PGRST103' || error.message?.toLowerCase().includes('satisfiable')) {
          return { users: [], totalCount: cachedCount || 0 };
        }
      }

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

export async function getUsers(): Promise<User[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: profiles, error } = await supabase.from('profiles').select('*').eq('is_deleted', false);
      if (error) throw error;
      return (profiles || []).map(decodeProfile);
    } catch (e) {
      console.error('Supabase users loading failed', e);
      return [];
    }
  }
  return getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
}

export async function saveUser(user: User, loggerName: string): Promise<User> {
  let finalUser = { ...user };
  const isValidUuid = (val?: string | null): boolean => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
  const isNew = !user.id || user.id.length < 10 || !isValidUuid(user.id);
  const isDriverOrAssistant = user.role === 'driver' || user.role === 'driver_assistant';

  if (isSupabaseConfigured && supabase) {
    try {
      if (isDriverOrAssistant) {
        // Drivers and Driver Assistants do not need auth accounts (they do not log into any portal)
        // They are informational records added directly to the profiles table for historical operations tracking
        const cleanPersonalId = (user.personal_id && user.personal_id.trim()) || '';
        const cleanEmail = (user.email && user.email.trim()) ? user.email.trim() : null;
        const cleanPhone = (user.phone && user.phone.trim()) || '';
        const cleanName = (user.name && user.name.trim()) || (user.role === 'driver' ? 'მძღოლი' : 'დამხმარე');

        if (isNew) {
          const profileId = (isValidUuid(user.id) ? user.id : crypto.randomUUID());
          const newProfile = {
            id: profileId,
            name: cleanName,
            personal_id: cleanPersonalId,
            phone: cleanPhone,
            email: cleanEmail,
            role: user.role,
            permissions: {},
            privileges: [],
            is_deleted: false,
            is_blocked: false,
            vendor_id: null
          };

          const { data: inserted, error: insErr } = await supabase
            .from('profiles')
            .insert([newProfile])
            .select()
            .maybeSingle();

          if (insErr) {
            console.error('Failed to create driver profile in database:', insErr);
            throw new Error(insErr.message || 'Failed to save driver profile');
          }
          finalUser = inserted || newProfile;
        } else {
          const updatePayload: any = {
            name: cleanName,
            personal_id: cleanPersonalId,
            phone: cleanPhone,
            email: cleanEmail,
            role: user.role,
            is_blocked: user.is_blocked || false
          };

          const { data: updated, error: upErr } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', user.id)
            .select()
            .maybeSingle();

          if (upErr) {
            console.error('Failed to update driver profile in database:', upErr);
            throw new Error(upErr.message || 'Failed to update driver profile');
          }
          finalUser = updated || { ...user, ...updatePayload };
        }
      } else if (isNew) {
        const functionUrl = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/functions/v1/create-user`;
        let resData: any = null;
        let createdOnExpress = false;

        const cleanPersonalId = (user.personal_id && user.personal_id.trim()) || `12${Math.floor(100000000 + Math.random() * 900000000)}`;
        const hasEmail = Boolean(user.email && user.email.trim());
        let cleanEmail = hasEmail ? user.email.trim() : '';
        if (cleanEmail && !cleanEmail.includes('@')) {
          cleanEmail = `${cleanEmail}@biodiesel.ge`;
        }
        const authFallbackEmail = cleanEmail || `${cleanPersonalId}@internal.driver`;
        const cleanPassword = (user.password && user.password.trim()) || 'Georgia2026!';
        const cleanPhone = (user.phone && user.phone.trim()) || '+995 599 00 00 00';
        const cleanName = (user.name && user.name.trim()) || 'New User';

        const userToCreate = {
          ...user,
          name: cleanName,
          email: cleanEmail,
          auth_email: authFallbackEmail,
          password: cleanPassword,
          personal_id: cleanPersonalId,
          phone: cleanPhone,
          role: user.role || 'operator',
          permissions: user.permissions || {},
          vendor_id: user.vendor_id || null,
          warehouse_id: user.warehouse_id || null
        };
        
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
              body: JSON.stringify(userToCreate)
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
              email: userToCreate.email || userToCreate.auth_email,
              password: userToCreate.password,
              name: userToCreate.name,
              personal_id: userToCreate.personal_id,
              phone: userToCreate.phone,
              role: userToCreate.role,
              permissions: userToCreate.permissions,
              warehouse_id: userToCreate.warehouse_id,
              vendor_id: userToCreate.vendor_id
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
        // UPDATE Existing Non-Driver User
        let updatedOnEdge = false;
        let cleanEmail = user.email ? user.email.trim() : '';
        if (cleanEmail && !cleanEmail.includes('@')) {
          cleanEmail = `${cleanEmail}@biodiesel.ge`;
        }
        
        try {
          const sessionRes = await supabase.auth.getSession();
          const token = sessionRes.data.session?.access_token;
          
          if (token) {
            const serverRes = await fetch('/api/update-user', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                id: user.id,
                email: cleanEmail,
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
              const resData = await serverRes.json().catch(() => ({}));
              if (resData?.user) {
                finalUser = { ...finalUser, ...resData.user };
              }
              updatedOnEdge = true;
            } else {
              const functionUrl = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/functions/v1/create-user`;
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
                  email: cleanEmail,
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
              if (edgeRes.ok) {
                const resData = await edgeRes.json().catch(() => ({}));
                if (resData?.user) {
                  finalUser = { ...finalUser, ...resData.user };
                }
                updatedOnEdge = true;
              }
            }
          }
        } catch (err: any) {
          console.warn('User update auth API failed, falling back to profiles update:', err);
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            email: cleanEmail || user.email,
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
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', id)
        .maybeSingle();

      if (dbProfile?.role === 'admin' && currentUserRole && currentUserRole !== 'admin') {
        throw new Error('ადმინისტრატორის როლის მქონე მომხმარებლის წაშლა შეუძლია მხოლოდ ადმინისტრატორს.');
      }

      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (token) {
        try {
          const res = await fetch('/api/delete-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ id })
          });
          if (res.ok) {
            console.log('User deleted via /api/delete-user API');
          }
        } catch (delErr) {
          console.warn('API delete-user call failed:', delErr);
        }
      }

      await supabase
        .from('profiles')
        .update({ is_deleted: true, is_blocked: true })
        .eq('id', id);

    } catch (e) {
      console.error('Supabase deleteUser failed', e);
      throw e;
    }
  }

  appCache.clear('users_');
  appCache.clear('count_users_');

  setLocal(KEY_USERS, list.filter(item => item.id !== id));
  await trackChange(loggerName, 'User deleted', 'Name', name, '');
  notifyDbChange('profiles', 'DELETE', id);
  return true;
}
