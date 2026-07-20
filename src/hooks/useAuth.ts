import { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { t } from '../utils/lang';
import { isSupabaseConfigured, supabase } from '../lib/db';

function decodeProfile(p: any): User {
  if (!p) return p;
  return {
    ...p,
    warehouse_id: p.warehouse_id || undefined,
    vendor_id: p.vendor_id || undefined
  };
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const currentUserRef = useRef<User | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Read Supabase auth session on boot
  useEffect(() => {
    const initAuth = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            let dbUser: any = null;
            const useProxy = typeof window !== 'undefined' && !window.location.hostname.includes('vercel.app');
            if (session.access_token && useProxy) {
              try {
                const res = await fetch(`/api/profiles?email=${encodeURIComponent(session.user.email || '')}`, {
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`
                  }
                });
                if (res.ok) {
                  const profiles = await res.json();
                  if (profiles && profiles.length > 0) {
                    dbUser = profiles[0];
                  }
                }
              } catch (err) {
                console.warn('Failed to load profile via proxy', err);
              }
            }

            if (!dbUser) {
              const { data: directUser } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', session.user.email)
                .single();
              dbUser = directUser;
            }
              
            if (dbUser) {
              if (dbUser.is_blocked) {
                await supabase.auth.signOut();
                setCurrentUser(null);
                alert('სისტემაზე წვდომა არ გაქვთ.');
              } else {
                const secureUser = decodeProfile(dbUser);
                secureUser.role = session.user.user_metadata?.role || secureUser.role;
                secureUser.permissions = session.user.user_metadata?.permissions || secureUser.permissions || {};
                setCurrentUser(secureUser);
              }
            } else {
              // Fallback to user_metadata
              const role = session.user.user_metadata?.role || 'vendor';
              const vendorUser: User = {
                id: session.user.id,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Supplier',
                email: session.user.email || '',
                personal_id: session.user.user_metadata?.personal_id || '',
                phone: session.user.user_metadata?.phone || '',
                role: role,
                permissions: session.user.user_metadata?.permissions || {},
                is_blocked: false,
                created_at: session.user.created_at || new Date().toISOString(),
                vendor_id: session.user.user_metadata?.vendor_id || session.user.user_metadata?.edit_permissions?.vendor_id || undefined,
                warehouse_id: session.user.user_metadata?.warehouse_id || session.user.user_metadata?.edit_permissions?.warehouse_id || undefined
              };
              setCurrentUser(vendorUser);
            }
          }
        } catch (e) {
          console.error('Initial load of active session failed:', e);
        } finally {
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
          if (currentUserRef.current && currentUserRef.current.id === session.user.id) {
            // Already logged in, skip redundant profile refetching
            return;
          }
          try {
            let dbUser: any = null;
            const useProxy = typeof window !== 'undefined' && !window.location.hostname.includes('vercel.app');
            if (session?.access_token && useProxy) {
              try {
                const res = await fetch(`/api/profiles?email=${encodeURIComponent(session.user.email || '')}`, {
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`
                  }
                });
                if (res.ok) {
                  const profiles = await res.json();
                  if (profiles && profiles.length > 0) {
                    dbUser = profiles[0];
                  }
                }
              } catch (err) {
                console.warn('Live Event: Failed to load profile via proxy', err);
              }
            }

            if (!dbUser) {
              const { data: directUser } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', session.user.email)
                .single();
              dbUser = directUser;
            }

            if (dbUser) {
              const secureUser = decodeProfile(dbUser);
              secureUser.role = session.user.user_metadata?.role || secureUser.role;
              secureUser.permissions = session.user.user_metadata?.permissions || secureUser.permissions || {};
              setCurrentUser(secureUser);
            } else {
              const role = session.user.user_metadata?.role || 'vendor';
              const vendorUser: User = {
                id: session.user.id,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Supplier',
                email: session.user.email || '',
                personal_id: session.user.user_metadata?.personal_id || '',
                phone: session.user.user_metadata?.phone || '',
                role: role,
                permissions: session.user.user_metadata?.permissions || {},
                is_blocked: false,
                created_at: session.user.created_at || new Date().toISOString(),
                vendor_id: session.user.user_metadata?.vendor_id || session.user.user_metadata?.edit_permissions?.vendor_id || undefined,
                warehouse_id: session.user.user_metadata?.warehouse_id || session.user.user_metadata?.edit_permissions?.warehouse_id || undefined
              };
              setCurrentUser(vendorUser);
            }
          } catch (err) {
            console.error('Live Event login sync error:', err);
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  
  useEffect(() => {
    if (!currentUser?.id || !isSupabaseConfigured || !supabase) return;

    const channel = supabase
      .channel(`public:profiles:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`,
        },
        async (payload) => {
          const updatedProfile = payload.new;
          if (updatedProfile.is_blocked) {
            alert("სისტემაზე წვდომა არ გაქვთ.");
            await supabase.auth.signOut();
            setCurrentUser(null);
          } else {
            // Update JWT by refreshing session
            await supabase.auth.refreshSession();
            setCurrentUser(decodeProfile(updatedProfile));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
