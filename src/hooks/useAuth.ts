import { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { t } from '../utils/lang';
import { isSupabaseConfigured, supabase } from '../lib/db';
import { defaultPermissions } from '../components/users/UserForm';
import { decodeProfile } from '../services/userService';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const currentUserRef = useRef<User | null>(null);
  const isSyncingAuthRef = useRef(false);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const syncUserFromSession = async (session: any) => {
    if (!session?.user || !isSupabaseConfigured || !supabase) return;
    if (isSyncingAuthRef.current && currentUserRef.current?.id === session.user.id) return;
    if (currentUserRef.current?.id === session.user.id && currentUserRef.current?.email === session.user.email) return;

    isSyncingAuthRef.current = true;
    try {
      const { data: dbUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();

      if (dbUser) {
        if (dbUser.is_deleted || dbUser.is_blocked) {
          console.warn('Access denied: User is blocked or deleted.');
          await supabase.auth.signOut();
          setCurrentUser(null);
        } else {
          const secureUser = decodeProfile(dbUser);
          secureUser.role = dbUser.role || session.user.user_metadata?.role || secureUser.role;
          if (secureUser.permissions === undefined || secureUser.permissions === null) {
            const metaPerms = session.user.user_metadata?.permissions;
            if (metaPerms) {
              secureUser.permissions = metaPerms;
            } else if (defaultPermissions[secureUser.role]) {
              secureUser.permissions = JSON.parse(JSON.stringify(defaultPermissions[secureUser.role]));
            } else {
              secureUser.permissions = {};
            }
          }
          setCurrentUser(secureUser);
        }
      } else {
        const role = session.user.user_metadata?.role || 'vendor';
        const defPerms = defaultPermissions[role] ? JSON.parse(JSON.stringify(defaultPermissions[role])) : {};
        const vendorUser: User = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Supplier',
          email: session.user.email || '',
          personal_id: session.user.user_metadata?.personal_id || '',
          phone: session.user.user_metadata?.phone || '',
          role: role,
          permissions: session.user.user_metadata?.permissions || defPerms,
          is_blocked: false,
          created_at: session.user.created_at || new Date().toISOString(),
          vendor_id: session.user.user_metadata?.vendor_id || session.user.user_metadata?.edit_permissions?.vendor_id || undefined,
          warehouse_id: session.user.user_metadata?.warehouse_id || session.user.user_metadata?.edit_permissions?.warehouse_id || undefined
        };
        setCurrentUser(vendorUser);
      }
    } catch (e) {
      console.error('Session sync error:', e);
    } finally {
      isSyncingAuthRef.current = false;
      setIsLoadingAuth(false);
    }
  };

  // Read Supabase auth session on boot
  useEffect(() => {
    const initAuth = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await syncUserFromSession(session);
          } else {
            setIsLoadingAuth(false);
          }
        } catch (e) {
          console.error('Initial load of active session failed:', e);
          setIsLoadingAuth(false);
        }
      } else {
        setIsLoadingAuth(false);
      }
    };
    initAuth();
  }, []);

  // Sync session changes from Supabase Live Subscriptions
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await syncUserFromSession(session);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Real-time synchronization for profile and permission changes
  useEffect(() => {
    if (!currentUser?.id || !isSupabaseConfigured || !supabase) return;

    const refreshCurrentProfile = async () => {
      try {
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (dbProfile) {
          if (dbProfile.is_blocked || dbProfile.is_deleted) {
            console.warn('User access revoked in real-time. Signing out.');
            await supabase.auth.signOut();
            setCurrentUser(null);
          } else {
            await supabase.auth.refreshSession();
            setCurrentUser(decodeProfile(dbProfile));
          }
        }
      } catch (err) {
        console.error('Error refreshing active user profile in real-time:', err);
      }
    };

    // 1. Postgres changes listener
    const pgChannel = supabase
      .channel(`public:profiles:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`,
        },
        () => {
          refreshCurrentProfile();
        }
      )
      .subscribe();

    // 2. Broadcast synchronization listener for profile updates
    const syncChannel = supabase
      .channel(`app_auth_profile_sync:${currentUser.id}`)
      .on(
        'broadcast',
        { event: 'db_change' },
        (payload) => {
          const data = payload?.payload;
          if (data?.table === 'profiles' && (!data.recordId || data.recordId === currentUser.id)) {
            refreshCurrentProfile();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(pgChannel);
      supabase.removeChannel(syncChannel);
    };
  }, [currentUser?.id]);

  const handleLogOut = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Supabase sign-out failed:', err);
      }
    }
    setCurrentUser(null);
  };

  return {
    currentUser,
    setCurrentUser,
    isLoadingAuth,
    handleLogOut
  };
}
