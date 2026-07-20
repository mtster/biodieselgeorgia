import { User, UserRole, PermissionsConfig } from '../types';
import { getLocal, setLocal, KEY_USERS } from './localStorage';
import { trackChange } from './historyService';
import { isSupabaseConfigured, supabase } from '../lib/db';

export { KEY_USERS };

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

function decodeProfile(p: any): User {
  if (!p) return p;
  return {
    ...p,
    warehouse_id: p.warehouse_id || undefined,
    vendor_id: p.vendor_id || undefined
  };
}

export async function getUsers(): Promise<User[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const useProxy = typeof window !== 'undefined' && !window.location.hostname.includes('vercel.app');
      let data = null;

      if (useProxy) {
        try {
          const res = await fetch('/api/profiles');
          if (res.ok) {
            data = await res.json();
          }
        } catch (err) {
          console.warn('Failed to load profiles via proxy, falling back to direct db call', err);
        }
      }

      if (!data) {
        const { data: profiles, error } = await supabase.from('profiles').select('*');
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

  if (isSupabaseConfigured && supabase) {
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
              if (errBody?.error) {
                throw new Error(errBody.error);
              }
            }
          } catch (err: any) {
            console.warn('Express /api/create-user failed', err);
            if (err.message && (err.message.includes('Unauthorized') || err.message.includes('Access denied') || err.message.includes('Only Administrators') || err.message.includes('configured on the server'))) {
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
          
          resData = await edgeRes.json();
          if (!edgeRes.ok) throw new Error(resData?.error || 'Edge function error');
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
        let edgeErrorMsg = '';
        
        try {
          const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
          const sessionRes = await supabase.auth.getSession();
          const token = sessionRes.data.session?.access_token;
          
          if (token) {
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
            if (edgeRes.ok) {
              updatedOnEdge = true;
            } else {
              const errData = await edgeRes.json();
              edgeErrorMsg = errData.error || 'Update failed';
            }
          }
        } catch (err: any) {
          edgeErrorMsg = err?.message || String(err);
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update({
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

  const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
  if (isNew) {
    setLocal(KEY_USERS, [...list, decodeProfile(finalUser)]);
    await trackChange(loggerName, 'User added', 'Name', '', finalUser.name);
  } else {
    setLocal(KEY_USERS, list.map(item => item.id === finalUser.id ? decodeProfile(finalUser) : item));
    await trackChange(loggerName, 'User updated', 'Name', '', finalUser.name);
  }

  return decodeProfile(finalUser);
}

export async function deleteUser(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const functionUrl = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/functions/v1/create-user`;
      const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
      
      const edgeRes = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'delete', id })
      });
      
      if (!edgeRes.ok) throw new Error('Delete failed via edge function');
    } catch (e) {
      console.error('Supabase deleteUser failed', e);
      throw e;
    }
  } else {
    const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
    setLocal(KEY_USERS, list.filter(item => item.id !== id));
  }
  
  await trackChange(loggerName, 'User deleted', 'Name', name, '');
  return true;
}
