import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User } from '../types';
import { trackChange } from './historyService';
import { KEY_USERS, getLocal, setLocal } from './localStorage';

export { KEY_USERS };

export const DEFAULT_USERS: User[] = [
  {
    id: 'user-admin',
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

export async function getUsers(): Promise<User[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('is_deleted', false).order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getUsers failed', e);
    }
  }
  return getLocal<User[]>(KEY_USERS, DEFAULT_USERS).filter(item => !item.is_deleted);
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
            privileges: user.privileges
          })
        });

        let resData: any = null;
        if (res.ok) {
          resData = await res.json();
        } else {
          console.warn('Express /api/create-user failed, trying Supabase Edge function fallback...');
          const { data, error } = await supabase.functions.invoke('create-user', {
            body: {
              action: 'create',
              email: user.email,
              password: user.password || 'Georgia2026!',
              name: user.name,
              personal_id: user.personal_id,
              phone: user.phone,
              role: user.role,
              privileges: user.privileges
            }
          });

          if (error) {
            throw new Error(`Edge Function failed: ${error.message}. Please configure SERVICE_ROLE_KEY in the AI Studio Settings menu so that our integrated server proxy can route your requests safely.`);
          }
          if (data && (data.user || data.profile)) {
            resData = data;
          } else {
            throw new Error('Supabase Edge function was invoked successfully but did not return any user or profile payload.');
          }
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
          const { data, error } = await supabase.functions.invoke('create-user', {
            body: {
              action: 'update',
              id: user.id,
              email: user.email,
              password: user.password || '', // update password if provided
              name: user.name,
              personal_id: user.personal_id,
              phone: user.phone,
              role: user.role,
              privileges: user.privileges
            }
          });
          if (!error && data) {
            updatedOnEdge = true;
            if (data.user) {
              finalUser = data.user;
            }
          } else if (error) {
            console.warn('Edge Function update failed, trying direct profiles table update:', error.message);
          }
        } catch (edgeErr: any) {
          console.warn('Edge Function invoke error, trying direct profiles update:', edgeErr);
        }

        if (!updatedOnEdge) {
          const { error } = await supabase
            .from('profiles')
            .update({
              name: user.name,
              personal_id: user.personal_id,
              phone: user.phone,
              role: user.role,
              privileges: user.privileges
            })
            .eq('id', user.id);

          if (error) throw error;
          finalUser = { ...user } as User;
        }
      }
    } catch (e: any) {
      console.error('Supabase saveUser failed', e);
      throw e; // throw error so the UI displays it
    }
  } else {
    // Local storage mock mode
    finalUser = {
      ...user,
      id: isNew ? 'user-' + Math.random().toString(36).substring(2, 9) : user.id,
      created_at: user.created_at || new Date().toISOString()
    };
  }

  const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
  if (isNew) {
    setLocal(KEY_USERS, [...list, finalUser]);
    await trackChange(loggerName, 'User added', 'Name', '', finalUser.name);
  } else {
    setLocal(KEY_USERS, list.map(item => item.id === finalUser.id ? finalUser : item));
    await trackChange(loggerName, 'User updated', 'Name', '', finalUser.name);
  }
  return finalUser;
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
        const { error } = await supabase.functions.invoke('create-user', {
          body: {
            action: 'delete',
            id
          }
        });

        if (error) {
          throw new Error(`Edge Function failed: ${error.message}. Please configure SERVICE_ROLE_KEY in the AI Studio Settings menu so that our integrated server proxy can route your requests safely.`);
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
