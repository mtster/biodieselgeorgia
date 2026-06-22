import React, { useState, useEffect } from 'react';
import { 
  Leaf, LayoutDashboard, BarChart3, Building2, MessageSquare, 
  ShoppingBag, Users, FileText, Globe, History, Settings, LogOut, X, Menu,
  ChevronDown, ChevronRight, Truck
} from 'lucide-react';
import { User } from '../../types';
import { t } from '../../utils/lang';

interface SidebarProps {
  currentUser: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onLogOut: () => void;
}

export default function Sidebar({
  currentUser,
  activeTab,
  setActiveTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  onLogOut
}: SidebarProps) {
  
  const [settingsOpen, setSettingsOpen] = useState(
    ['users', 'cities', 'vehicles', 'warehouses', 'history'].includes(activeTab)
  );

  useEffect(() => {
    if (['users', 'cities', 'vehicles', 'warehouses', 'history'].includes(activeTab)) {
      setSettingsOpen(true);
    }
  }, [activeTab]);
  
  const isAdmin = currentUser?.role === 'admin' || currentUser?.privileges?.includes('All');

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'vendors', name: 'Suppliers', icon: <Building2 size={18} /> },
    { id: 'communications', name: 'Communications', icon: <MessageSquare size={18} /> },
    { id: 'orders', name: 'Orders', icon: <ShoppingBag size={18} /> },
    { id: 'reports', name: 'Reports', icon: <FileText size={18} /> },
  ].filter(item => {
    if (isAdmin) return true;
    if (!currentUser || !currentUser.privileges) return true;
    return currentUser.privileges.includes(item.name);
  });

  const settingsSubItems = [
    { id: 'users', name: 'Users', icon: <Users size={18} /> },
    { id: 'cities', name: 'Cities', icon: <Globe size={18} /> },
    { id: 'vehicles', name: 'Vehicles', icon: <Truck size={18} /> },
    { id: 'warehouses', name: 'Warehouses', icon: <Building2 size={18} /> },
    { id: 'history', name: 'Changes History', icon: <History size={18} /> },
  ].filter(item => {
    if (isAdmin) return true;
    if (!currentUser || !currentUser.privileges) return true;
    return currentUser.privileges.includes(item.name);
  });

  const showSettings = settingsSubItems.length > 0;

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
            <h1 className="text-base font-black tracking-tighter leading-none text-white font-sans uppercase">
              {t("Biodiesel Georgia")}
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
              type="button"
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
              <span>{t(item.name)}</span>
            </button>
          );
        })}

        {/* Settings Collapsible Dropdown */}
        {showSettings && (
          <div>
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold tracking-tight transition text-left cursor-pointer ${
                ['users', 'cities', 'vehicles', 'warehouses', 'history'].includes(activeTab)
                  ? 'text-white font-extrabold bg-slate-800/40' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings size={18} />
                <span>{t("Settings")}</span>
              </div>
              {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {settingsOpen && (
              <div className="pl-4 space-y-1 mt-1 border-l border-slate-800 ml-5">
                {settingsSubItems.map((subItem) => {
                  const isSubActive = activeTab === subItem.id;
                  return (
                    <button
                      key={subItem.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(subItem.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-bold tracking-tight transition text-left cursor-pointer ${
                        isSubActive
                          ? 'bg-emerald-800 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {subItem.icon}
                      <span>{t(subItem.name)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile and signout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20 select-none">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 font-extrabold flex items-center justify-center text-xs text-slate-200 uppercase">
            {currentUser.name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-200 truncate">{currentUser.name}</p>
            <span className="text-xs text-emerald-400 font-mono capitalize block">
              {currentUser.role === 'admin' ? t('Administrator') : t('Staff')}
            </span>
          </div>
        </div>

        <button 
          onClick={onLogOut}
          type="button"
          className="w-full py-2 bg-slate-800 hover:bg-red-900 border border-slate-800 hover:border-red-950 hover:text-white rounded-lg text-[11px] font-bold text-slate-400 transition flex items-center justify-center gap-1 cursor-pointer"
        >
          <LogOut size={13} />
          {t("Log Out")}
        </button>
      </div>

    </aside>
  );
}
