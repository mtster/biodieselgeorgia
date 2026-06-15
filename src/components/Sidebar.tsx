import React from 'react';
import { Leaf, LogOut, X } from 'lucide-react';
import { User } from '../types';

interface Props {
  currentUser: User;
  activeTab: string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  menuItems: { id: string; name: string; icon: React.ReactNode }[];
  onLogOut: () => void;
}

export default function Sidebar({
  currentUser,
  activeTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  setActiveTab,
  menuItems,
  onLogOut
}: Props) {
  return (
    <aside className={`bg-slate-900 text-slate-100 flex-shrink-0 flex flex-col justify-between transition-all duration-300 z-30 md:sticky md:top-0 md:h-screen md:overflow-hidden ${
        mobileMenuOpen ? 'fixed inset-y-0 left-0 w-64' : 'hidden md:flex md:w-64'
      }`}>
        
        {/* Sidebar Header Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-800 p-1.5 rounded-lg text-white">
              <Leaf size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none text-white">
                Biodiesel Georgia
              </h1>
            </div>
          </div>
          
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Links list */}
        <div className="flex-1 py-4 overflow-y-auto px-3 space-y-1 select-none">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold tracking-tight transition text-left cursor-pointer ${
                  isActive 
                    ? 'bg-emerald-800 text-white shadow-sm font-extrabold' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* Profile and signout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20 select-none">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 font-extrabold flex items-center justify-center text-xs text-slate-200 uppercase">
              {currentUser.name.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</p>
              <span className="text-[10px] text-emerald-400 font-mono capitalize block">
                {currentUser.role === 'admin' ? 'Administrator' : 'Staff'}
              </span>
            </div>
          </div>

          <button 
            onClick={onLogOut}
            className="w-full py-2 bg-slate-800 hover:bg-red-900 border border-slate-800 hover:border-red-950 hover:text-white rounded-lg text-[11px] font-bold text-slate-400 transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </aside>
  );
}
