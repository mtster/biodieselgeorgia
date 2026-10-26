import { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { t } from '../utils/lang';
import { isSupabaseConfigured, supabase } from '../lib/db';
import { defaultPermissions } from '../components/users/UserForm';
import { decodeProfile } from '../services/userService';
import {
  getCachedUser,
  saveCachedUser,
  isExplicitlyLoggedOut,
  getAuthCredentials,
  clearPersistentAuth,
  requestPersistentStorage,
} from '../lib/persistentAuth';

export function useAuth() {
  // Initialize with cached user so Home Screen PWA loads instantly without login screen flash
  const [currentUser, setCurrentUserState] = useState<User | null>(() => getCachedUser());
  const [isLoadingAuth, setIsLoadingAuth] = useState(() => !getCachedUser());
  const currentUserRef = useRef<User | null>(currentUser);
  const syncPromiseRef = useRef<Promise<void> | null>(null);

  const setCurrentUser = (user: User | null) => {
    currentUserRef.current = user;
    setCurrentUserState(user);
    if (user) {
      saveCachedUser(user);
    }
  };

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const syncUserFromSession = async (session: any) => {
    if (!session?.user || !isSupabaseConfigured || !supabase) return;

    if (currentUserRef.current && (currentUserRef.current.id === session.user.id || currentUserRef.current.email === session.user.email)) {
      setIsLoadingAuth(false);
      return;
    }

    if (syncPromiseRef.current) {
      return syncPromiseRef.current;
    }

    syncPromiseRef.current = (async () => {
      try {
        const { data: dbUser } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${session.user.id},email.eq.${session.user.email}`)
          .maybeSingle();

        if (dbUser) {
          if (dbUser.is_deleted || dbUser.is_blocked) {
            console.warn('Access denied: User is blocked or deleted.');
            await clearPersistentAuth();
            await supabase.auth.signOut();
            setCurrentUser(null);
          } else {
            const secureUser = decodeProfile(dbUser);
            secureUser.role = dbUser.role || session.user.app_metadata?.role || session.user.user_metadata?.role || secureUser.role;
            if (!secureUser.permissions || Object.keys(secureUser.permissions).length === 0) {
              const metaPerms = session.user.app_metadata?.permissions || session.user.user_metadata?.permissions;
              if (metaPerms && Object.keys(metaPerms).length > 0) {
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
          const role = session.user.app_metadata?.role || session.user.user_metadata?.role || 'vendor';
          const metaPerms = session.user.app_metadata?.permissions || session.user.user_metadata?.permissions;
          const defPerms = defaultPermissions[role] ? JSON.parse(JSON.stringify(defaultPermissions[role])) : {};
          const vendorUser: User = {
            id: session.user.id,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Supplier',
            email: session.user.email || '',
            personal_id: session.user.user_metadata?.personal_id || '',
            phone: session.user.user_metadata?.phone || '',
            role: role,
            permissions: metaPerms || defPerms,
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
        syncPromiseRef.current = null;
        setIsLoadingAuth(false);
      }
    })();

    return syncPromiseRef.current;
  };

  // Read and verify auth session on boot with persistent fallback & silent renewal
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Failsafe timeout: guarantee authentication loading completes within 2.5s even if network is slow
      const failsafeTimer = setTimeout(() => {
        if (isMounted) {
          setIsLoadingAuth(false);
        }
      }, 2500);

      try {
        // 1. Request persistent browser storage to prevent iOS/Android storage eviction
        requestPersistentStorage().catch(() => {});

        if (!isSupabaseConfigured || !supabase) {
          if (isMounted) setIsLoadingAuth(false);
          return;
        }

        // If user explicitly signed out, do not auto-login
        if (isExplicitlyLoggedOut()) {
          if (isMounted) {
            setCurrentUser(null);
            setIsLoadingAuth(false);
          }
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();

        if (session?.user) {
          await syncUserFromSession(session);
        } else {
          // If no session found or refresh token expired, check if we are offline
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          if (isOffline) {
            // Keep existing cached user session while offline
            console.info('App opened offline - retaining persistent user session');
            if (isMounted) setIsLoadingAuth(false);
            return;
          }

          // If online and session is missing/expired, attempt silent background renewal via vault
          const creds = await getAuthCredentials();
          if (creds && creds.email && creds.pass) {
            try {
              const { data: reauthData, error: reauthErr } = await supabase.auth.signInWithPassword({
                email: creds.email,
                password: creds.pass,
              });
              if (reauthData?.session && !reauthErr) {
                await syncUserFromSession(reauthData.session);
                return;
              }
            } catch (reErr) {
              console.warn('Silent credential renewal attempt failed:', reErr);
            }
          }

          // If no credentials and no valid session, reset if no cached user exists
          const cached = getCachedUser();
          if (!cached && isMounted) {
            setCurrentUser(null);
          }
          if (isMounted) setIsLoadingAuth(false);
        }
      } catch (e) {
        console.error('Initial load of active session failed:', e);
        // On network error or wake lag, preserve cached session
        const cached = getCachedUser();
        if (cached && isMounted) {
          setCurrentUser(cached);
        }
        if (isMounted) setIsLoadingAuth(false);
      } finally {
        clearTimeout(failsafeTimer);
      }
    };

    initAuth();

    // Re-verify session when device comes back online (e.g., returning from sleep/tunnel)
    const handleOnline = () => {
      if (!isExplicitlyLoggedOut()) {
        initAuth();
      }
    };
    window.addEventListener('online', handleOnline);

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Sync session changes from Supabase Live Subscriptions
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await syncUserFromSession(session);
        } else if (event === 'SIGNED_OUT') {
          if (isExplicitlyLoggedOut()) {
            setCurrentUser(null);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          if (!currentUserRef.current) {
            await syncUserFromSession(session);
          }
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
            await clearPersistentAuth();
            await supabase.auth.signOut();
            setCurrentUser(null);
          } else {
            await supabase.auth.refreshSession();
            const updated = decodeProfile(dbProfile);
            setCurrentUser(updated);
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
    // Explicit user sign-out: clear all durable storage and credentials
    await clearPersistentAuth();
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

