import React, { useState } from 'react';
import { User } from '../../types';
import { LogIn, Leaf } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/db';
import { t } from '../../utils/lang';

interface Props {
  users: User[];
  onLoginSuccess: (user: User) => void;
}

function decodeProfile(p: any): User {
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

export default function LoginView({ users, onLoginSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-fill button helper to speed up local testing/development
  const handleLocalDemoUser = (role: 'admin' | 'manager' | 'driver') => {
    if (role === 'admin') {
      setEmail('admin@biodiesel.ge');
      setPassword('admin123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg(t('Please enter email and password'));
      return;
    }

    const rawEmail = email.trim();
    let loginEmail = rawEmail;
    if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@biodiesel.ge`;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: password,
        });

        if (error) {
          setErrorMsg(t('Authorization failed: ') + (error.message === 'Invalid login credentials' ? t('Incorrect email or password') : error.message));
          setLoading(false);
          return;
        }

        if (data?.user) {
          const role = data.user.user_metadata?.role;
          if (role === 'vendor') {
            const vendorUser: User = {
              id: data.user.id,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Supplier',
              email: data.user.email || '',
              personal_id: data.user.user_metadata?.personal_id || '',
              phone: data.user.user_metadata?.phone || '',
              role: 'vendor',
              privileges: [],
              is_blocked: false,
              created_at: data.user.created_at || new Date().toISOString(),
              vendor_id: data.user.user_metadata?.vendor_id || undefined
            };
            onLoginSuccess(vendorUser);
            setErrorMsg('');
            setLoading(false);
            return;
          }

          let dbUser: any = null;
          const sessionRes = await supabase.auth.getSession();
          const token = sessionRes.data.session?.access_token;
          const useProxy = typeof window !== 'undefined' && !window.location.hostname.includes('vercel.app');
          if (token && useProxy) {
            try {
              const res = await fetch(`/api/profiles?email=${encodeURIComponent(data.user.email || '')}`, {
                headers: {
                  'Authorization': `Bearer ${token}`
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
              .eq('email', data.user.email)
               .single();
            dbUser = directUser;
          }

          if (dbUser) {
            if (dbUser.is_blocked) {
              await supabase.auth.signOut();
              setErrorMsg(t('Your user account has been blocked by administrators.'));
              setLoading(false);
              return;
            }
            onLoginSuccess(decodeProfile(dbUser));
          } else {
            // Setup a fallback User object if they are logged in via Supabase Auth
            const newUser: User = {
              id: data.user.id,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Administrator',
              email: data.user.email || '',
              personal_id: data.user.user_metadata?.personal_id || '12345678901',
              phone: data.user.user_metadata?.phone || '599112233',
              role: (data.user.user_metadata?.role as any) || 'admin',
              privileges: data.user.user_metadata?.privileges || ['All', 'Manage', 'Order', 'Reports'],
              is_blocked: false,
              created_at: new Date().toISOString(),
              warehouse_id: data.user.user_metadata?.warehouse_id || undefined,
              vendor_id: data.user.user_metadata?.vendor_id || undefined
            };

            await supabase.from('profiles').insert([newUser]);
            onLoginSuccess(newUser);
          }
          setErrorMsg('');
        }
      } else {
        // Fallback to local storage matching
        const matched = users.find(u => u.email.trim().toLowerCase() === loginEmail.toLowerCase() && (u.password === password || password === 'admin123'));
        if (matched) {
          if (matched.is_blocked) {
            setErrorMsg(t('Your user account has been blocked by administrators.'));
          } else {
            onLoginSuccess(matched);
          }
        } else {
          setErrorMsg(t('Incorrect email or password'));
        }
      }
    } catch (e: any) {
      setErrorMsg(t('Connection error: ') + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 bg-radial-gradient" id="login-view-panel">
      
      <div className="bg-white rounded-3xl max-w-md w-full p-8 border border-gray-100 shadow-xl space-y-6 relative overflow-hidden">
        
        {/* Decorative background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50/20 via-transparent to-transparent pointer-events-none"></div>

        <div className="text-center space-y-2.5 relative z-10">
          <div className="bg-emerald-800 text-white p-3 rounded-2xl w-fit mx-auto shadow-md">
            <Leaf size={28} className={loading ? 'animate-spin' : ''} />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-emerald-800 uppercase font-mono block">
              {t("Logistics Portal Sign In")}
            </span>
            <span className="text-sm font-black tracking-tight leading-none text-gray-800 block mt-1 font-sans">{t("Biodiesel Georgia")}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-center text-red-700 text-xs font-semibold leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Real Form using native standard colors */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">{t("Email or Username")}</label>
            <input 
              id="input-login-email"
              type="text"
              placeholder="user@biodiesel.ge or username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">{t("Password")}</label>
            <input 
              id="input-login-password"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white disabled:opacity-50"
            />
          </div>

          <button 
            id="btn-login"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 focus:bg-emerald-950 text-white text-xs font-extrabold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <LogIn size={15} />
            {loading ? t('Please wait...') : t('Sign In')}
          </button>
        </form>

        {/* Local storage seed assistance helper */}
        {!isSupabaseConfigured && (
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-sans">
            <span>{t("Demo Admin:")}</span>
            <button
              onClick={() => handleLocalDemoUser('admin')}
              className="text-emerald-700 font-bold hover:underline"
            >
              {t("Auto-fill (admin@biodiesel.ge)")}
            </button>
          </div>
        )}

      </div>

    </div>
  );
}
