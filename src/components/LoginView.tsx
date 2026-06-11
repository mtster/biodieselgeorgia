import React, { useState } from 'react';
import { Employee } from '../types';
import { ShieldCheck, LogIn, Key, Leaf, Info } from 'lucide-react';

interface Props {
  employees: Employee[];
  onLoginSuccess: (emp: Employee) => void;
}

export default function LoginView({ employees, onLoginSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('შეიყვანეთ ელ-ფოსტა და პაროლი');
      return;
    }

    // Try finding in employees
    const matched = employees.find(
      (emp) => emp.email.toLowerCase() === email.toLowerCase() && emp.password === password
    );

    if (matched) {
      onLoginSuccess(matched);
      setErrorMsg('');
    } else {
      setErrorMsg('მომხმარებელი მსგავსი ელ ფოსტით ან პაროლით ვერ მოიძებნა. (ნაგულისხმევი: admin@biodiesel.ge / admin)');
    }
  };

  // Quick Demo logins as helper
  const handleQuickLogin = (role: 'admin' | 'manager' | 'driver') => {
    const defaultAdmin = employees.find(e => e.role === role) || employees[0];
    if (defaultAdmin) {
      onLoginSuccess(defaultAdmin);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50">
      
      <div className="bg-white rounded-3xl max-w-md w-full p-8 border border-gray-100 shadow-xl space-y-6 relative overflow-hidden">
        
        {/* Subtle decorative background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-50/20 via-transparent to-transparent pointer-events-none"></div>

        <div className="text-center space-y-2.5 relative z-10">
          <div className="bg-emerald-800 text-white p-3 rounded-2xl w-fit mx-auto shadow-md">
            <Leaf size={28} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-emerald-800 uppercase font-mono block">
              ლოგისტიკის პორტალზე შესვლა
            </span>
            <h2 className="text-2xl font-black text-gray-800">ბიოდიზელი ჯორჯია</h2>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-center text-red-700 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Real Form */}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">ელექტრონული ფოსტა</label>
            <input 
              type="email"
              placeholder="admin@biodiesel.ge"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">პაროლი</label>
            <input 
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white animate-none"
            />
          </div>

          <button 
            type="submit"
            className="w-full py-2.5 bg-emerald-850 hover:bg-emerald-900 text-white text-xs font-extrabold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn size={15} />
            სისტემაში შესვლა
          </button>
        </form>

        {/* Demo Fast Login helpers as fallback for testing the platform */}
        <div className="pt-4 border-t border-gray-150/60 text-center space-y-2 relative z-10">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">სეგმენტური ტექნიკური შესვლა (Demo)</span>
          <div className="flex gap-1.5 justify-center">
            <button 
              type="button"
              onClick={() => handleQuickLogin('admin')}
              className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold transition border border-emerald-100"
            >
              ადმინისტრატორი
            </button>
            <button 
              type="button"
              onClick={() => handleQuickLogin('manager')}
              className="px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold transition border border-slate-150"
            >
              მძღოლი / მენეჯერი
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
