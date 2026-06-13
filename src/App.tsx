/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, Vendor, Order, Communication, Truck, 
  ChangeHistory, Warehouse, City, District 
} from './types';

import { 
  getUsers, saveUser, deleteUser,
  getVendors, saveVendor, deleteVendor,
  getOrders, saveOrder, deleteOrder,
  getCommunications, saveCommunication, deleteCommunication,
  getTrucks, saveTruck, deleteTruck,
  getChangeHistory,
  getWarehouses, saveWarehouse, deleteWarehouse,
  getCities, saveCity, deleteCity,
  getDistricts, saveDistrict, deleteDistrict,
  resetSystemDatabase, isSupabaseConfigured, supabase, revertChange
} from './lib/db';

// Modular view components
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import AnalyticsView from './components/AnalyticsView';
import VendorsView from './components/VendorsView';
import CommunicationsView from './components/CommunicationsView';
import OrdersView from './components/OrdersView';
import UsersView from './components/UsersView';
import ReportsView from './components/ReportsView';
import LookupsView from './components/LookupsView';
import SettingsView from './components/SettingsView';
import HistoryView from './components/HistoryView';
import MobileLogisticsView from './components/MobileLogisticsView';

// Icons for Left Sidebar pairing
import { 
  Leaf, LayoutDashboard, BarChart3, Building2, MessageSquare, 
  ShoppingBag, Users, FileText, Database, Settings, History, 
  Globe, LogOut, Info, ShieldCheck, ChevronRight, Menu, X
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Database Live Models
  const [users, setUsers] = useState<User[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);

  // System status
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showStructureDesc, setShowStructureDesc] = useState(false);

  // Sync data function
  const refreshAllData = async () => {
    try {
      const usrs = await getUsers();
      const vnds = await getVendors();
      const ords = await getOrders();
      const comms = await getCommunications();
      const trks = await getTrucks();
      const hist = await getChangeHistory();
      const whs = await getWarehouses();
      const cts = await getCities();
      const dsts = await getDistricts();

      setUsers(usrs);
      setVendors(vnds);
      setOrders(ords);
      setCommunications(comms);
      setTrucks(trks);
      setChangeHistory(hist);
      setWarehouses(whs);
      setCities(cts);
      setDistricts(dsts);
    } catch (e) {
      console.error('Error synchronizing database:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshAllData();
    }
  }, [currentUser]);

  // Read Supabase auth session on boot
  useEffect(() => {
    const initAuth = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: dbUser } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', session.user.email)
              .single();
              
            if (dbUser) {
              setCurrentUser(dbUser);
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
                created_at: new Date().toISOString()
              };
              await supabase.from('profiles').insert([newUser]);
              setCurrentUser(newUser);
            }
          } else {
            setIsLoading(false);
          }
        } catch (e) {
          console.error('Initial load of active session failed:', e);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // Sync session changes from Supabase Live Subscriptions
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const { data: dbUser } = await supabase
              .from('profiles')
              .select('*')
              .eq('email', session.user.email)
              .single();
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

  // Operations
  const handleUserSave = async (user: User) => {
    try {
      await saveUser(user, currentUser?.name || 'System');
      await refreshAllData();
    } catch (e: any) {
      console.error('Error saving user:', e);
      alert(`⚠️ Authentication / Sync Error: ${e.message || 'Check your permissions.'}\nCould not add or update this user in the Auth database.`);
    }
  };

  const handleUserDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete user: ${name}?`)) {
      try {
        await deleteUser(id, name, currentUser?.name || 'System');
        await refreshAllData();
      } catch (e: any) {
        console.error('Error deleting user:', e);
        alert(`⚠️ Delete Error: ${e.message || 'Permissions denied.'}`);
      }
    }
  };

  const handleVendorSave = async (vnd: Vendor) => {
    try {
      await saveVendor(vnd, currentUser?.name || 'System');
      await refreshAllData();
    } catch (e: any) {
      console.error('Error saving supplier:', e);
      alert(`⚠️ Supplier Save Error: ${e.message || 'Check connection / permissions.'}`);
    }
  };

  const handleVendorDelete = async (id: string, tradeName: string) => {
    if (confirm(`Are you sure you want to delete supplier (${tradeName})?`)) {
      try {
        await deleteVendor(id, tradeName, currentUser?.name || 'System');
        await refreshAllData();
      } catch (e: any) {
        console.error('Error deleting supplier:', e);
        alert(`⚠️ Supplier Delete Error: ${e.message || 'Check permissions.'}`);
      }
    }
  };

  const handleOrderSave = async (ord: Order) => {
    try {
      await saveOrder(ord, currentUser?.name || 'System');
      await refreshAllData();
    } catch (e: any) {
      console.error('Error saving order:', e);
      alert(`⚠️ Order Save Error: ${e.message || 'Check connection / permissions.'}`);
    }
  };

  const handleOrderDelete = async (id: string, docNum: string) => {
    if (confirm(`Are you sure you want to delete order #${docNum}?`)) {
      try {
        await deleteOrder(id, docNum, currentUser?.name || 'System');
        await refreshAllData();
      } catch (e: any) {
        console.error('Error deleting order:', e);
        alert(`⚠️ Order Delete Error: ${e.message || 'Check permissions.'}`);
      }
    }
  };

  const handleCommunicationSave = async (comm: Communication) => {
    await saveCommunication(comm, currentUser?.name || 'System');
    await refreshAllData();
  };

  const handleCommunicationDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      await deleteCommunication(id, currentUser?.name || 'System');
      await refreshAllData();
    }
  };

  // Lookups updates
  const handleSaveCity = async (c: City) => {
    await saveCity(c, currentUser?.name || 'System');
    await refreshAllData();
  };
  const handleDeleteCity = async (id: string, name: string) => {
    if (confirm(`Delete city ${name}?`)) {
      await deleteCity(id, name, currentUser?.name || 'System');
      await refreshAllData();
    }
  };

  const handleSaveDistrict = async (d: District) => {
    await saveDistrict(d, currentUser?.name || 'System');
    await refreshAllData();
  };
  const handleDeleteDistrict = async (id: string, name: string) => {
    if (confirm(`Delete district ${name}?`)) {
      await deleteDistrict(id, name, currentUser?.name || 'System');
      await refreshAllData();
    }
  };

  const handleSaveTruck = async (t: Truck) => {
    await saveTruck(t, currentUser?.name || 'System');
    await refreshAllData();
  };
  const handleDeleteTruck = async (plate: string) => {
    if (confirm(`Are you sure you want to delete vehicle (${plate})?`)) {
      await deleteTruck(plate, currentUser?.name || 'System');
      await refreshAllData();
    }
  };

  const handleAddCityDirect = async (name: string) => {
    const newCity: City = {
      id: '',
      name
    };
    await handleSaveCity(newCity);
  };

  const handleAddDistrictDirect = async (cityId: string, name: string) => {
    const newDst: District = {
      id: '',
      city_id: cityId,
      name
    };
    await handleSaveDistrict(newDst);
  };

  const handleAddWarehouseDirect = async (name: string) => {
    const newWh: Warehouse = {
      id: '',
      name
    };
    await saveWarehouse(newWh, currentUser?.name || 'System');
    await refreshAllData();
  };

  const handleRevertChange = async (log: ChangeHistory): Promise<boolean> => {
    try {
      const success = await revertChange(log, currentUser?.name || 'System');
      if (success) {
        await refreshAllData();
      }
      return success;
    } catch (e) {
      console.error('Rollback error:', e);
      return false;
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-3.5">
        <div className="w-10 h-10 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold font-mono text-gray-400 tracking-widest uppercase">
          Biodiesel Georgia - Loading...
        </p>
      </div>
    );
  }

  // Auth requirement
  if (!currentUser) {
    return (
      <LoginView 
        users={users} 
        onLoginSuccess={(usr) => setCurrentUser(usr)} 
      />
    );
  }

  // If role is 'driver', route them to the mobile logistics interface
  if (currentUser.role === 'driver') {
    return (
      <MobileLogisticsView 
        currentUser={currentUser}
        orders={orders}
        suppliers={vendors}
        warehouses={warehouses}
        employees={users}
        trucks={trucks}
        onSaveOrder={handleOrderSave}
        onLogOut={handleLogOut}
      />
    );
  }

  // Sidebar navigation configuration
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'analytics', name: 'Analytics', icon: <BarChart3 size={16} /> },
    { id: 'vendors', name: 'Suppliers', icon: <Building2 size={16} /> },
    { id: 'communications', name: 'Communications', icon: <MessageSquare size={16} /> },
    { id: 'orders', name: 'Orders', icon: <ShoppingBag size={16} /> },
    { id: 'users', name: 'Users', icon: <Users size={16} /> },
    { id: 'reports', name: 'Reports', icon: <FileText size={16} /> },
    { id: 'lookups', name: 'Lookups', icon: <Globe size={16} /> },
    { id: 'history', name: 'Change History', icon: <History size={16} /> },
    { id: 'settings', name: 'Settings', icon: <Settings size={16} /> }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-750 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar collapsible */}
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
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold tracking-tight transition text-left cursor-pointer ${
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
            onClick={handleLogOut}
            className="w-full py-2 bg-slate-800 hover:bg-red-900 border border-slate-800 hover:border-red-950 hover:text-white rounded-lg text-[11px] font-bold text-slate-400 transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>

      </aside>

      {/* Main Viewport Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile Navbar Top */}
        <header className="md:hidden bg-white border-b border-gray-100 flex items-center justify-between p-4 flex-shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-800 text-white p-1 rounded-lg">
              <Leaf size={16} />
            </div>
            <span className="font-black text-sm text-gray-800 font-sans">Biodiesel Georgia</span>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 bg-gray-50 border rounded-lg text-gray-700 cursor-pointer"
          >
            <Menu size={18} />
          </button>
        </header>

        {/* Content viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-16">
          <div className="w-full">
            {activeTab === 'dashboard' && (
              <DashboardView 
                suppliers={vendors}
                orders={orders}
                employees={users}
                trucks={trucks}
                onNavigate={(tab) => {
                  if (tab === 'suppliers') {
                    setActiveTab('vendors');
                  } else if (tab === 'employees') {
                    setActiveTab('users');
                  } else {
                    setActiveTab(tab);
                  }
                }}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView 
                suppliers={vendors}
                orders={orders}
                onNavigate={(tab) => {
                  if (tab === 'suppliers') {
                    setActiveTab('vendors');
                  } else {
                    setActiveTab(tab);
                  }
                }}
              />
            )}

            {activeTab === 'vendors' && (
              <VendorsView 
                vendors={vendors}
                warehouses={warehouses}
                users={users}
                cities={cities}
                districts={districts}
                currentUser={currentUser}
                onSave={handleVendorSave}
                onDelete={handleVendorDelete}
                onAddCity={handleAddCityDirect}
                onAddDistrict={handleAddDistrictDirect}
                onAddWarehouse={handleAddWarehouseDirect}
              />
            )}

            {activeTab === 'communications' && (
              <CommunicationsView 
                communications={communications}
                suppliers={vendors}
                employees={users}
                currentEmployee={currentUser}
                onSave={handleCommunicationSave}
                onDelete={handleCommunicationDelete}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersView 
                orders={orders}
                suppliers={vendors}
                warehouses={warehouses}
                employees={users}
                trucks={trucks}
                currentEmployee={currentUser}
                onSave={handleOrderSave}
                onDelete={handleOrderDelete}
              />
            )}

            {activeTab === 'users' && (
              <UsersView 
                users={users}
                currentUser={currentUser}
                onSave={handleUserSave}
                onDelete={handleUserDelete}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView 
                suppliers={vendors}
                orders={orders}
              />
            )}

            {activeTab === 'lookups' && (
              <LookupsView 
                cities={cities}
                districts={districts}
                trucks={trucks}
                employees={users}
                currentEmployee={currentUser}
                onSaveCity={handleSaveCity}
                onDeleteCity={handleDeleteCity}
                onSaveDistrict={handleSaveDistrict}
                onDeleteDistrict={handleDeleteDistrict}
                onSaveTruck={handleSaveTruck}
                onDeleteTruck={handleDeleteTruck}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView 
                history={changeHistory}
                onRevert={handleRevertChange}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView 
                onResetDatabase={resetSystemDatabase}
              />
            )}
          </div>
        </main>

      </div>

    </div>
  );
}
