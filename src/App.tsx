/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserProfile, Venue, LogisticsTask, ActivityLog } from './types';
import { 
  getVenues, getTasks, getUsers, getActivityLogs, 
  isSupabaseConfigured, translateRole 
} from './lib/db';
import RoleSelector from './components/RoleSelector';
import AdminPanel from './components/AdminPanel';
import ManagerPanel from './components/ManagerPanel';
import DriverPanel from './components/DriverPanel';
import VenuePanel from './components/VenuePanel';
import { 
  Leaf, Info, Key, Server, Settings, ExternalLink, HelpCircle, 
  Database, ShieldCheck, Cpu, Smartphone, BellRing 
} from 'lucide-react';

export default function App() {
  // Live State managers
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tasks, setTasks] = useState<LogisticsTask[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load and refresh core DB models
  const refreshAllData = async () => {
    try {
      const liveUsers = await getUsers();
      const liveVenues = await getVenues();
      const liveTasks = await getTasks();
      const liveLogs = await getActivityLogs();

      setAllUsers(liveUsers);
      setVenues(liveVenues);
      setTasks(liveTasks);
      setActivityLogs(liveLogs);

      // Auto-assign default active simulation user (admin on first load)
      if (!currentUser && liveUsers.length > 0) {
        setCurrentUser(liveUsers[0]); // default to admin
      } else if (currentUser) {
        // Keep active user object in sync with DB state modifications (e.g. role edits)
        const updatedSelf = liveUsers.find(u => u.id === currentUser.id);
        if (updatedSelf) {
          setCurrentUser(updatedSelf);
        }
      }
    } catch (e) {
      console.error('Error fetching system database data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleUserSelectionChange = (user: UserProfile) => {
    setCurrentUser(user);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-3">
        <Disc size={40} className="text-emerald-700 animate-spin" />
        <p className="text-xs font-bold text-gray-500 font-mono tracking-widest animate-pulse">
          ბიოდიზელ ჯორჯია - იტვირთება...
        </p>
      </div>
    );
  }

  // Drivers list helper
  const drivers = allUsers.filter(u => u.role === 'driver');

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col justify-between">
      
      {/* Top Corporate Branding Navbar */}
      <header id="main-corporate-header" className="bg-emerald-800 text-white shadow-md relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-radial-gradient from-emerald-700 to-emerald-900 opacity-90"></div>
        
        <div className="max-w-7xl mx-auto px-4 py-4 relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/10 p-2 rounded-xl border border-white/20 animate-pulse">
              <Leaf size={22} className="text-emerald-300" />
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase font-mono block">
                ლოგისტიკა და მართვა
              </span>
              <h1 className="text-lg font-black tracking-tight leading-none">
                ბიოდიზელ ჯორჯია <span className="text-emerald-300">| BIODIESEL GEORGIA</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-black/15 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Cpu size={14} className="text-emerald-400" />
            <span>სესია:</span>
            <span className="text-emerald-300 font-bold">
              {currentUser ? currentUser.name : 'ადმინისტრატორი'}
            </span>
          </div>
        </div>
      </header>

      {/* Dynamic Role Switcher Segments */}
      {currentUser && (
        <RoleSelector
          currentUser={currentUser}
          allUsers={allUsers}
          onUserChange={handleUserSelectionChange}
        />
      )}

      {/* Main Panel Content - Displays the panel that matchesCurrentUserRole */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-12">
        {currentUser ? (
          <div>
            {currentUser.role === 'admin' && (
              <AdminPanel
                adminUser={currentUser}
                allUsers={allUsers}
                venues={venues}
                activityLogs={activityLogs}
                onRefreshData={refreshAllData}
              />
            )}

            {currentUser.role === 'manager' && (
              <ManagerPanel
                currentUser={currentUser}
                venues={venues}
                tasks={tasks}
                allDrivers={drivers}
                onRefreshData={refreshAllData}
              />
            )}

            {currentUser.role === 'driver' && (
              <DriverPanel
                currentUser={currentUser}
                tasks={tasks}
                onRefreshData={refreshAllData}
              />
            )}

            {currentUser.role === 'venue' && (
              <VenuePanel
                currentUser={currentUser}
                venues={venues}
                tasks={tasks}
                onRefreshData={refreshAllData}
              />
            )}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <HelpCircle size={48} className="text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">მომხმარებლის პროფილი ვერ მოიძებნა</p>
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* INTEGRATION INSTRUCTIONS SIDEBAR CARD */}
      {/* ========================================== */}
      <section id="developer-guide-instruction" className="max-w-7xl w-full mx-auto px-4 md:px-6 pb-12 border-t border-gray-200/60 pt-8">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Settings size={20} className="text-emerald-700 animate-spin" />
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest">
              ინტეგრაციის დეტალური ინსტრუქცია (Developer & API Keys Guide)
            </h2>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            პროექტი მზადაა **Supabase Db**, **Vercel Cloud Real-Time Hosting** და **Firebase Cloud Messaging** სრულფასოვანი ინტეგრაციისთვის. ქვევით მოცემულია ინსტრუქცია თუ რა გასაღებები (API Keys) გჭირდებათ, საიდან უნდა აიღოთ და როგორ დააკონფიგურიროთ ისინი. 
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            
            {/* Supabase details card */}
            <div className="p-4 bg-emerald-50/20 border border-emerald-100 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs uppercase">
                <Database size={16} className="text-emerald-700" />
                1. Database & Auth (Supabase)
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                **როგორ მივიღოთ**: ეწვიეთ [supabase.com](https://supabase.com/). შექმენით უფასო პროექტი (Free Tier Project). გადადით `Project Settings` - `API`.
              </p>
              <div className="space-y-1 font-mono text-[10px] text-gray-600 bg-white p-2.5 rounded-lg border border-gray-150">
                <span className="font-bold text-emerald-800">.env / Vercel-ის ცვლადები:</span>
                <p className="mt-1 font-bold">VITE_SUPABASE_URL</p>
                <p className="text-gray-400">მაგ: 'https://xxx.supabase.co'</p>
                <p className="font-bold mt-1">VITE_SUPABASE_ANON_KEY</p>
                <p className="text-gray-400">Public Anonymous Token</p>
              </div>
            </div>

            {/* FCM Details card */}
            <div className="p-4 bg-orange-50/20 border border-orange-150 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-orange-850 font-extrabold text-xs uppercase">
                <BellRing size={16} className="text-orange-600" />
                2. Notification Hub (FCM)
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                **როგორ მივიღოთ**: გადადით [console.firebase.google.com](https://console.firebase.google.com/), შექმენით პროექტი, ჩართეთ `Cloud Messaging`.
              </p>
              <div className="space-y-1 font-mono text-[10px] text-gray-700 bg-white p-2.5 rounded-lg border border-gray-150">
                <span className="font-bold text-orange-800">სახელები .env - ში:</span>
                <p className="mt-1 font-bold">VITE_FCM_API_KEY</p>
                <p className="font-bold">VITE_FCM_SENDER_ID</p>
                <p className="text-gray-405">FCM-ით ბრაუზერებში Push-ების მისაღებად PWA-ზე</p>
              </div>
            </div>

            {/* Vercel deployment card */}
            <div className="p-4 bg-indigo-50/20 border border-indigo-100 rounded-xl space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-800 font-extrabold text-xs uppercase">
                <Smartphone size={16} className="text-indigo-650" />
                3. Hosting Sync (Vercel PWA)
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                **გაშვება**: შექმენით უფასო ანგარიში [vercel.com](https://vercel.com/)-ზე. დააკავშირეთ თქვენი GitHub საცავი (Repository) და გააკეთეთ სინქრონიზაცია.
              </p>
              <div className="text-[10px] text-gray-650 bg-white p-2.5 rounded-lg border border-gray-150/80 space-y-1">
                <p className="font-bold text-indigo-850">ცვლადების გაწერა Vercel-ზე:</p>
                <p className="italic leading-normal text-gray-500">
                  Vercel პანელში `Project Settings` - `Environment Variables`. შეიყვანეთ ზემოთ ხსენებული Supabase / FCM გასაღებები. Vercel ავტომატურად გაუშვებს PWA-ს HTTPS სერტიფიკატით!
                </p>
              </div>
            </div>

          </div>

          <div className="p-4 bg-gray-50 border border-gray-100/80 rounded-xl text-[11px] text-gray-650 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
            <span className="font-medium flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-700 font-bold" />
              <strong>ლოკალური რეჟიმის გარანტია</strong>: თუ გასაღებები ჯერ არ გაქვთ, სისტემა მუშაობს LocalStorage-ის ულტრა-თანამედროვე სიმულატორზე, რათა არცერთი ფუნქცია არ შეიზღუდოს.
            </span>
            <span className="font-mono text-gray-405">v1.2.0 • Biodiesel Georgia Co.</span>
          </div>

        </div>
      </section>

      {/* Modern Minimalist Footer */}
      <footer id="biodiesel-footer" className="bg-zinc-900 text-gray-400 py-6 px-4 text-center text-xs border-t border-zinc-850 shrink-0 select-none">
        <div className="max-w-7xl mx-auto space-y-1">
          <p className="text-zinc-300 font-black">© 2026 ბიოდიზელ ჯორჯია. ყველა უფლება დაცულია.</p>
          <p className="text-[10px] text-zinc-500">ლოგისტიკისა და მართვის პროგრესული ვებ აპლიკაცია (PWA)</p>
        </div>
      </footer>

    </div>
  );
}

// Inline loader components replacement
function Disc({ className, size }: { className?: string; size?: number }) {
  return (
    <svg 
      className={className} 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6a6 6 0 0 1 6 6" />
    </svg>
  );
}
