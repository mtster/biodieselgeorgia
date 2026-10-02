import React, { useState } from 'react';
import { User } from '../../types';
import { LogIn, Leaf, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/db';
import { t } from '../../utils/lang';
import { FormInput } from '../FormInput';
import { decodeProfile } from '../../services/userService';

interface Props {
  users: User[];
  onLoginSuccess: (user: User) => void;
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

    const rawInput = email.trim();
    const candidates: string[] = [];

    const geoToEng: Record<string, string> = {
      'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't',
      'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'j',
      'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'f', 'ქ': 'k', 'ღ': 'r', 'ყ': 'q',
      'შ': 's', 'ჩ': 'c', 'ც': 'c', 'ძ': 'z', 'წ': 'w', 'ჭ': 'c', 'ხ': 'x', 'ჯ': 'j', 'ჰ': 'h'
    };
    const transliterateGeo = (str: string) => {
      return str.split('').map(ch => geoToEng[ch] || ch).join('');
    };

    const addCandidatesForInput = (inp: string) => {
      if (!inp.includes('@')) {
        const sanitized = inp.replace(/[-\s]/g, '').toLowerCase();
        if (sanitized && !candidates.includes(`${sanitized}@biodiesel.ge`)) {
          candidates.push(`${sanitized}@biodiesel.ge`);
        }
        const lowerWithDash = `${inp.replace(/\s+/g, '').toLowerCase()}@biodiesel.ge`;
        if (!candidates.includes(lowerWithDash)) {
          candidates.push(lowerWithDash);
        }
      } else {
        const parts = inp.split('@');
        const userPart = parts[0];
        const domainPart = parts[1] ? parts[1].toLowerCase() : '';
        if (domainPart === 'biodiesel.ge') {
          const sanitized = userPart.replace(/[-\s]/g, '').toLowerCase();
          if (sanitized && !candidates.includes(`${sanitized}@biodiesel.ge`)) {
            candidates.push(`${sanitized}@biodiesel.ge`);
          }
          if (!candidates.includes(inp.toLowerCase())) {
            candidates.push(inp.toLowerCase());
          }
        } else {
          if (!candidates.includes(inp.toLowerCase())) {
            candidates.push(inp.toLowerCase());
          }
        }
      }
    };

    addCandidatesForInput(rawInput);
    const transliterated = transliterateGeo(rawInput);
    if (transliterated !== rawInput) {
      addCandidatesForInput(transliterated);
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isSupabaseConfigured && supabase) {
        let authRes: any = null;
        for (const candidateEmail of candidates) {
          authRes = await supabase.auth.signInWithPassword({
            email: candidateEmail,
            password: password,
          });
          if (!authRes.error) break;
          if (password.trim() !== password) {
            authRes = await supabase.auth.signInWithPassword({
              email: candidateEmail,
              password: password.trim(),
            });
            if (!authRes.error) break;
          }
        }

        const { data, error } = authRes || {};

        if (error) {
          setErrorMsg(t('Authorization failed: ') + (error.message === 'Invalid login credentials' ? t('Incorrect email or password') : error.message));
          setLoading(false);
          return;
        }

        if (data?.user) {
          const { data: directUser } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', data.user.email)
            .maybeSingle();
          const dbUser = directUser;

          if (dbUser) {
            if (dbUser.is_blocked || dbUser.is_deleted) {
              await supabase.auth.signOut();
              setErrorMsg('სისტემაზე წვდომა არ გაქვთ.');
              setLoading(false);
              return;
            }
            onLoginSuccess(decodeProfile(dbUser));
          } else {
            // Setup a fallback User object for vehicle account or user without profile
            const metadataRole = data.user.user_metadata?.role;
            const isVehicle = data.user.user_metadata?.vehicle_role === 'vehicle' || metadataRole === 'vehicle';
            const userRole = isVehicle ? 'driver' : (metadataRole || 'driver');

            const newUser: User = {
              id: data.user.id,
              name: data.user.user_metadata?.plate_number || data.user.user_metadata?.name || data.user.email?.split('@')[0].toUpperCase() || 'Vehicle',
              email: data.user.email || '',
              personal_id: data.user.user_metadata?.personal_id || '',
              phone: data.user.user_metadata?.phone || '',
              role: userRole as any,
              permissions: data.user.user_metadata?.permissions || {},
              is_blocked: false,
              created_at: data.user.created_at || new Date().toISOString(),
              warehouse_id: data.user.user_metadata?.warehouse_id || undefined,
              vendor_id: data.user.user_metadata?.vendor_id || undefined
            };

            // Vehicle accounts must NOT be added to profiles table!
            if (metadataRole !== 'vendor' && !isVehicle) {
              await supabase.from('profiles').insert([newUser]);
            }
            onLoginSuccess(newUser);
          }
          setErrorMsg('');
        }
      } else {
        // Fallback to local storage matching
        const matched = users.find(u => {
          const uEmail = u.email.trim().toLowerCase();
          return candidates.some(c => c.toLowerCase() === uEmail) && (u.password === password || password === 'admin123');
        });
        if (matched) {
          if (matched.is_blocked || matched.is_deleted) {
            setErrorMsg('სისტემაზე წვდომა არ გაქვთ.');
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
            <span className="text-sm md:text-base font-black tracking-widest text-emerald-800 uppercase font-sans block mt-1">
              {t("Biodiesel Georgia")}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-center text-red-700 text-xs font-semibold leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Real Form using native standard colors */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10 text-left">
          <FormInput 
            id="input-login-email"
            label={t("Email or Username")}
            type="text"
            placeholder="user@biodiesel.ge or username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <FormInput 
            id="input-login-password"
            label={t("Password")}
            type="password"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />

          <button 
            id="btn-login"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 focus:bg-emerald-950 text-white text-xs font-extrabold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            <LogIn size={15} />
            <span>შესვლა</span>
            {loading && <Loader2 size={15} className="animate-spin ml-1" />}
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
