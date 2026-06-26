import { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { t } from '../utils/lang';
import { isSupabaseConfigured, supabase } from '../lib/db';

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
                alert(t('Your user account has been blocked by administrators.'));
              } else {
                setCurrentUser(dbUser);
              }
            } else {
              // Auto-create matching user database record
              const newUser: User = {
                id: session.user.id,
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Administrator',
                email: session.user.email || '',
                personal_id: session.user.user_metadata?.personal_id || '12345678901',
                phone: session.user.user_metadata?.phone || '599112233',
                role: (session.user.user_metadata?.role as any) || 'admin',
                privileges: session.user.user_metadata?.privileges || ['All', 'Manage', 'Order', 'Reports'],
                is_blocked: false,
                created_at: new Date().toISOString()
              };
              await supabase.from('profiles').insert([newUser]);
              setCurrentUser(newUser);
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

            if (dbUser) setCurrentUser(dbUser);
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
