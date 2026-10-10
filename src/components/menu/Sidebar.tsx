import React, { useState, useEffect } from 'react';
import { 
  Leaf, LayoutDashboard, BarChart3, Building2, MessageSquare, 
  ShoppingBag, Users, FileText, Globe, History, Settings, LogOut, X, Menu,
  ChevronDown, ChevronRight, Truck, Route, BookOpen
} from 'lucide-react';
import { User } from '../../types';
import { t } from '../../utils/lang';
import { hasModuleViewPermission } from '../../lib/realtime';
import { PWAInstallButton } from '../common/PWAInstallButton';

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
    ['users', 'cities', 'directions', 'vehicles', 'warehouses', 'history'].includes(activeTab)
  );

  useEffect(() => {
    if (['users', 'cities', 'directions', 'vehicles', 'warehouses', 'history'].includes(activeTab)) {
      setSettingsOpen(true);
    }
  }, [activeTab]);
  
  const isAdmin = currentUser?.role === 'admin';

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'vendors', name: 'Suppliers', icon: <Building2 size={18} /> },
    { id: 'contacts', name: 'Contacts', icon: <BookOpen size={18} /> },
    { id: 'communications', name: 'Communications', icon: <MessageSquare size={18} /> },
    { id: 'orders', name: 'Orders', icon: <ShoppingBag size={18} /> },
    { id: 'reports', name: 'Reports', icon: <FileText size={18} /> },
  ].filter(item => {
    if (isAdmin) return true;
    return hasModuleViewPermission(currentUser, item.id);
  });

  const settingsSubItems = [
    { id: 'users', name: 'Users', icon: <Users size={18} /> },
    { id: 'cities', name: 'Cities', icon: <Globe size={18} /> },
    { id: 'directions', name: 'Directions', icon: <Route size={18} /> },
    { id: 'vehicles', name: 'Vehicles', icon: <Truck size={18} /> },
    { id: 'warehouses', name: 'Warehouses', icon: <Building2 size={18} /> },
    { id: 'history', name: 'Changes History', icon: <History size={18} /> },
  ].filter(item => {
    if (isAdmin) return true;
    return hasModuleViewPermission(currentUser, item.id);
  });

  const showSettings = settingsSubItems.length > 0;

  return (
    <aside className={`bg-slate-900 text-slate-100 flex-shrink-0 flex flex-col justify-between transition-all duration-300 z-30 md:sticky md:top-0 md:h-screen md:overflow-hidden ${
      mobileMenuOpen ? 'fixed inset-y-0 left-0 w-64' : 'hidden md:flex md:w-64'
    }`}>
      
      {/* Sidebar Header Brand */}
      <div className="p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-800 p-2 rounded-lg text-white shrink-0">
            <Leaf size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight leading-tight text-white font-sans uppercase truncate">
              {t("Biodiesel Georgia")}
            </h1>
          </div>
        </div>
        
        <button 
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden text-slate-400 hover:text-white cursor-pointer p-1"
        >
          <X size={18} />
        </button>
      </div>

      {/* Links list */}
      <div className="flex-1 py-3 overflow-y-auto px-2.5 space-y-1 select-none">
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold tracking-tight transition text-left cursor-pointer ${
                isActive 
                  ? 'bg-emerald-800 text-white shadow-sm font-extrabold' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate">{t(item.name)}</span>
            </button>
          );
        })}

        {/* Settings Collapsible Dropdown */}
        {showSettings && (
          <div>
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold tracking-tight transition text-left cursor-pointer ${
                ['users', 'cities', 'directions', 'vehicles', 'warehouses', 'history'].includes(activeTab)
                  ? 'text-white font-extrabold bg-slate-800/40' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Settings size={18} className="shrink-0" />
                <span className="truncate">{t("Settings")}</span>
              </div>
              {settingsOpen ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
            </button>

            {settingsOpen && (
              <div className="ml-5 pl-3.5 border-l border-slate-800 space-y-1 mt-1.5">
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
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold tracking-tight transition text-left cursor-pointer ${
                        isSubActive
                          ? 'bg-emerald-800 text-white shadow-sm font-extrabold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <span className="shrink-0">{subItem.icon}</span>
                      <span className="leading-tight break-words">{t(subItem.name)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile and signout */}
      <div className="p-3.5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-slate-800 bg-slate-950/20 select-none">
        <PWAInstallButton className="w-full mb-2.5 justify-center" />
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 font-extrabold flex items-center justify-center text-xs text-slate-200 uppercase shrink-0">
            {currentUser.name.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
            <span className="text-xs text-emerald-400 font-medium block truncate">
              {currentUser.role === 'admin' ? t('Administrator') : t('Staff')}
            </span>
          </div>
        </div>

        <button 
          onClick={onLogOut}
          type="button"
          className="w-full py-2.5 bg-slate-800/80 hover:bg-red-900 border border-slate-700/50 hover:border-red-950 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut size={14} />
          {t("Log Out")}
        </button>
      </div>

    </aside>
  );
}
