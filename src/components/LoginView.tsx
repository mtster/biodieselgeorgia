import React, { useState } from 'react';
import { Employee } from '../types';
import { ShieldCheck, LogIn, Key, Leaf, Info } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/db';

interface Props {
  employees: Employee[];
  onLoginSuccess: (emp: Employee) => void;
}

export default function LoginView({ employees, onLoginSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('შეიყვანეთ ელ-ფოსტა და პაროლი');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          setErrorMsg('ავტორიზაცია ვერ მოხერხდა: ' + (error.message === 'Invalid login credentials' ? 'ელ-ფოსტა ან პაროლი არასწორია' : error.message));
          setLoading(false);
          return;
        }

        if (data?.user) {
          // Find matching employee profile in our public.employees table
          const { data: dbEmp, error: dbError } = await supabase
            .from('employees')
            .select('*')
            .eq('email', data.user.email)
            .single();

          if (dbEmp) {
            onLoginSuccess(dbEmp);
          } else {
            // Auto create an Employee record if they logged in successfully via Supabase Auth
            // but didn't have a profile yet (prevents them from being locked out)
            const newEmp: Employee = {
              id: data.user.id,
              name: data.user.email?.split('@')[0] || 'ადმინისტრატორი',
              email: data.user.email || '',
              personal_id: '12345678901',
              phone: '599112233',
              role: 'admin',
              privileges: ['සියველფერი', 'მართვა', 'შეკვეტა', 'რეპორტები'],
              created_at: new Date().toISOString()
            };

            await supabase.from('employees').insert([newEmp]);
            onLoginSuccess(newEmp);
          }
          setErrorMsg('');
        }
      } else {
        // Fallback or explicit instruction if Supabase is not configured locally
        setErrorMsg('Supabase არ არის დაკავშირებული. გთხოვთ მიუთითოთ VITE_SUPABASE_URL და VITE_SUPABASE_ANON_KEY .env ფაილში.');
      }
    } catch (e: any) {
      setErrorMsg('შეცდომა კავშირის დროს: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      
      <div className="bg-white rounded-3xl max-w-md w-full p-8 border border-gray-100 shadow-xl space-y-6 relative overflow-hidden">
        
        {/* Subtle decorative background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50/20 via-transparent to-transparent pointer-events-none"></div>

        <div className="text-center space-y-2.5 relative z-10">
          <div className="bg-emerald-800 text-white p-3 rounded-2xl w-fit mx-auto shadow-md">
            <Leaf size={28} className={loading ? 'animate-spin' : 'animate-pulse'} />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-emerald-800 uppercase font-mono block">
              ლოგისტიკის პორტალზე შესვლა
            </span>
            <span className="text-sm font-black tracking-tight leading-none text-gray-800 block mt-1">ბიოდიზელი ჯორჯია</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-center text-red-700 text-xs font-semibold leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Real Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">ელექტრონული ფოსტა</label>
            <input 
              type="email"
              placeholder="user@biodiesel.ge"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">პაროლი</label>
            <input 
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white disabled:opacity-50"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-850 hover:bg-emerald-900 focus:bg-emerald-950 text-white text-xs font-extrabold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <LogIn size={15} />
            {loading ? 'მიმდინარეობს შესვლა...' : 'სისტემაში შესვლა'}
          </button>
        </form>

      </div>

    </div>
  );
}
