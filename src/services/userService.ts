import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';
import { trackChange } from './historyService';
import { KEY_USERS, getLocal, setLocal } from './localStorage';

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
    privileges: ['All', 'Manage', 'Order', 'Reports'],
    created_at: new Date().toISOString()
  }
];

export function decodeProfile(p: any): User {
  if (!p) return p;
  const edit_permissions = p.edit_permissions || {};
  const warehouse_id = p.warehouse_id || edit_permissions.warehouse_id || '';
  const vendor_id = p.vendor_id || edit_permissions.vendor_id || '';
  return {
    ...p,
    warehouse_id: warehouse_id || undefined,
    vendor_id: vendor_id || undefined
  };
}

export async function getUsers(): Promise<User[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      const useProxy = typeof window !== 'undefined' && !window.location.hostname.includes('vercel.app');
      if (token && useProxy) {
        const res = await fetch('/api/profiles?is_deleted=false', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const list = await res.json();
          return list.map(decodeProfile);
        }
      }
      const { data, error } = await supabase.from('profiles').select('*').eq('is_deleted', false).order('name');
      if (!error && data) return data.map(decodeProfile);
    } catch (e) {
      console.warn('Supabase getUsers failed', e);
    }
  }
  return getLocal<User[]>(KEY_USERS, DEFAULT_USERS).filter(item => !item.is_deleted).map(decodeProfile);
}

export async function saveUser(user: User, loggerName: string): Promise<User> {
  const isNew = !user.id;
  let finalUser = { ...user };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        // Send a call to full-stack Express Admin user creation API
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) {
          throw new Error('Not authenticated on client');
        }

        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: user.email,
            password: user.password || 'Georgia2026!',
            name: user.name,
            personal_id: user.personal_id,
            phone: user.phone,
            role: user.role,
            privileges: user.privileges,
            warehouse_id: user.warehouse_id,
            vendor_id: user.vendor_id
          })
        });

        let resData: any = null;
        if (res.ok) {
          resData = await res.json();
        } else {
          console.warn('Express /api/create-user failed, trying Supabase Edge function fallback with direct secure fetch API...');
          
          const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
          const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
          const functionUrl = `${supabaseUrl}/functions/v1/create-user`;

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
              privileges: user.privileges,
              warehouse_id: user.warehouse_id,
              vendor_id: user.vendor_id
            })
          });

          let edgeData: any = null;
          try {
            edgeData = await edgeRes.json();
          } catch (jsonErr) {
            console.error('Failed to parse response JSON from Edge Function:', jsonErr);
          }

          if (!edgeRes.ok) {
            const errorMsg = edgeData?.error || `HTTP ${edgeRes.status}: ${edgeRes.statusText}`;
            throw new Error(`Edge Function failed: ${errorMsg}\n\nPlease verify that your 'create-user' edge function exists, is deployed correctly, and that SERVICE_ROLE_KEY is set in your Supabase secrets.`);
          }

          resData = edgeData;
        }

        if (resData && resData.user) {
          finalUser = resData.user;
        } else if (resData && resData.profile) {
          finalUser = {
            id: resData.profile.id,
            name: resData.profile.name,
            personal_id: resData.profile.personal_id,
            email: resData.profile.email || user.email,
            phone: resData.profile.phone,
            role: resData.profile.role,
            privileges: resData.profile.privileges || []
          };
        } else {
          throw new Error('No user or profile data returned from user creation engines.');
        }
      } else {
        // Perform direct update in profiles table AND update auth via Edge function if possible
        let updatedOnEdge = false;
        try {
          const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
          const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
          const functionUrl = `${supabaseUrl}/functions/v1/create-user`;

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
                password: user.password || '', // update password if provided
                name: user.name,
                personal_id: user.personal_id,
                phone: user.phone,
                role: user.role,
                privileges: user.privileges,
                warehouse_id: user.warehouse_id,
                vendor_id: user.vendor_id
              })
            });

            if (edgeRes.ok) {
              const edgeData = await edgeRes.json();
              updatedOnEdge = true;
              if (edgeData.user) {
                finalUser = edgeData.user;
              }
            } else {
              const edgeData = await edgeRes.json().catch(() => ({}));
              console.warn('Edge Function update failed:', edgeData.error || `${edgeRes.status} ${edgeRes.statusText}`);
            }
          }
        } catch (edgeErr: any) {
          console.warn('Edge Function invoke error, trying direct profiles update:', edgeErr);
        }

        if (user.role !== 'vendor') {
          // Always perform direct update in profiles table to preserve privileges and granular edit_permissions mapping
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              name: user.name,
              personal_id: user.personal_id,
              phone: user.phone,
              role: user.role,
              privileges: user.privileges,
              is_blocked: user.is_blocked || false,
              warehouse_id: user.warehouse_id || null,
              vendor_id: user.vendor_id || null,
              edit_permissions: {
                ...(user.edit_permissions || {}),
                warehouse_id: user.warehouse_id,
                vendor_id: user.vendor_id
              }
            })
            .eq('id', user.id);

          if (profileError) {
            console.warn('Direct profile sync updating failed', profileError);
            if (!updatedOnEdge) throw profileError;
          }
        }
        finalUser = { ...user } as User;
      }
    } catch (e: any) {
      console.error('Supabase saveUser failed', e);
      throw e; // throw error so the UI displays it
    }
  } else {
    // Local storage mock mode
    const generateCompliantUuid = () => {
      const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    };
    finalUser = {
      ...user,
      id: isNew ? generateCompliantUuid() : user.id,
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
      if (!token) {
        throw new Error('Not authenticated on client');
      }

      let deletedOnExpress = false;
      try {
        const res = await fetch('/api/delete-user', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ id })
        });

        if (res.ok) {
          deletedOnExpress = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Express delete-user failed:', errData.error || 'Unknown error');
        }
      } catch (err) {
        console.warn('Express /api/delete-user endpoint is missing/failed, invoking Edge function...', err);
      }

      if (!deletedOnExpress) {
        // Fallback to Edge function user deletion
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
        const functionUrl = `${supabaseUrl}/functions/v1/create-user`;

        const edgeRes = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'delete',
            id
          })
        });

        if (!edgeRes.ok) {
          const edgeData = await edgeRes.json().catch(() => ({}));
          const errorMsg = edgeData?.error || `HTTP ${edgeRes.status}: ${edgeRes.statusText}`;
          throw new Error(`Edge Function failed: ${errorMsg}\n\nPlease verify that your 'create-user' edge function exists, is deployed correctly, and that SERVICE_ROLE_KEY is set in your Supabase secrets.`);
        }
      }
    } catch (e: any) {
      console.error('Supabase deleteUser failed', e);
      throw e;
    }
  }

  const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
  setLocal(KEY_USERS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'User deleted', 'Name', name, '');
  return true;
}
