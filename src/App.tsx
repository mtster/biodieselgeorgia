/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Employee, Supplier, Order, Communication, Truck, 
  ChangeHistory, Warehouse, City, District 
} from './types';

import { 
  getEmployees, saveEmployee, deleteEmployee,
  getSuppliers, saveSupplier, deleteSupplier,
  getOrders, saveOrder, deleteOrder,
  getCommunications, saveCommunication, deleteCommunication,
  getTrucks, saveTruck, deleteTruck,
  getChangeHistory,
  getWarehouses, saveWarehouse, deleteWarehouse,
  getCities, saveCity, deleteCity,
  getDistricts, saveDistrict, deleteDistrict,
  resetSystemDatabase, isSupabaseConfigured, supabase
} from './lib/db';

// Modular view components
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import AnalyticsView from './components/AnalyticsView';
import SuppliersView from './components/SuppliersView';
import CommunicationsView from './components/CommunicationsView';
import OrdersView from './components/OrdersView';
import EmployeesView from './components/EmployeesView';
import ReportsView from './components/ReportsView';
import LookupsView from './components/LookupsView';
import SettingsView from './components/SettingsView';
import HistoryView from './components/HistoryView';

// Icons for Left Sidebar pairing
import { 
  Leaf, LayoutDashboard, BarChart3, Building2, MessageSquare, 
  ShoppingBag, Users, FileText, Database, Settings, History, 
  Globe, LogOut, Info, ShieldCheck, ChevronRight, Menu, X
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  
  // Database Live Models
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
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
      const emps = await getEmployees();
      const sups = await getSuppliers();
      const ords = await getOrders();
      const comms = await getCommunications();
      const trks = await getTrucks();
      const hist = await getChangeHistory();
      const whs = await getWarehouses();
      const cts = await getCities();
      const dsts = await getDistricts();

      setEmployees(emps);
      setSuppliers(sups);
      setOrders(ords);
      setCommunications(comms);
      setTrucks(trks);
      setChangeHistory(hist);
      setWarehouses(whs);
      setCities(cts);
      setDistricts(dsts);

      // Auto login in local mode if has users
      if (!currentUser && emps.length > 0) {
        // Just let them sign in, don't force auto-login if they want login view
      }
    } catch (e) {
      console.error('Error synchronizing database:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, [currentUser]);

  // Read Supabase auth session on boot
  useEffect(() => {
    const initAuth = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: dbEmp } = await supabase
              .from('employees')
              .select('*')
              .eq('email', session.user.email)
              .single();
              
            if (dbEmp) {
              setCurrentUser(dbEmp);
            } else {
              // Auto-create matching employee database record
              const newEmp: Employee = {
                id: session.user.id,
                name: session.user.email?.split('@')[0] || 'ადმინისტრატორი',
                email: session.user.email || '',
                personal_id: '12345678901',
                phone: '599112233',
                role: 'admin',
                privileges: ['සියველფერი', 'მართვა', 'შეკვეთა', 'რეპორტები'],
                created_at: new Date().toISOString()
              };
              await supabase.from('employees').insert([newEmp]);
              setCurrentUser(newEmp);
            }
          }
        } catch (e) {
          console.error('Initial load of active session failed:', e);
        }
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
            const { data: dbEmp } = await supabase
              .from('employees')
              .select('*')
              .eq('email', session.user.email)
              .single();
            if (dbEmp) setCurrentUser(dbEmp);
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
  const handleEmployeeSave = async (emp: Employee) => {
    await saveEmployee(emp, currentUser?.name || 'სისტემა');
    await refreshAllData();
  };

  const handleEmployeeDelete = async (id: string, name: string) => {
    if (confirm(`ნამდვილად გსურთ წაშალოთ თანამშრომელი: ${name}?`)) {
      await deleteEmployee(id, name, currentUser?.name || 'სისტემა');
      await refreshAllData();
    }
  };

  const handleSupplierSave = async (sup: Supplier) => {
    await saveSupplier(sup, currentUser?.name || 'სისტემა');
    await refreshAllData();
  };

  const handleSupplierDelete = async (id: string, tradeName: string) => {
    if (confirm(`ნამდვილად გსურთ მომწოდებლის (${tradeName}) წაშლა?`)) {
      await deleteSupplier(id, tradeName, currentUser?.name || 'სისტემა');
      await refreshAllData();
    }
  };

  const handleOrderSave = async (ord: Order) => {
    await saveOrder(ord, currentUser?.name || 'სისტემა');
    await refreshAllData();
  };

  const handleOrderDelete = async (id: string, docNum: string) => {
    if (confirm(`გსურთ წაშალოთ შეკვეთა #${docNum}?`)) {
      await deleteOrder(id, docNum, currentUser?.name || 'სისტემა');
      await refreshAllData();
    }
  };

  const handleCommunicationSave = async (comm: Communication) => {
    await saveCommunication(comm, currentUser?.name || 'სისტემა');
    await refreshAllData();
  };

  const handleCommunicationDelete = async (id: string) => {
    if (confirm('ნამდვილად გსურთ ჩანაწერის წაშლა?')) {
      await deleteCommunication(id, currentUser?.name || 'სისტემა');
      await refreshAllData();
    }
  };

  // Lookups updates
  const handleSaveCity = async (c: City) => {
    await saveCity(c, currentUser?.name || 'სისტემა');
    await refreshAllData();
  };
  const handleDeleteCity = async (id: string, name: string) => {
    if (confirm(`წაიშალოს ქალაქი ${name}?`)) {
      await deleteCity(id, name, currentUser?.name || 'სისტემა');
      await refreshAllData();
    }
  };

  const handleSaveDistrict = async (d: District) => {
    await saveDistrict(d, currentUser?.name || 'სისტემა');
    await refreshAllData();
  };
  const handleDeleteDistrict = async (id: string, name: string) => {
    if (confirm(`წაიშალოს უბანი ${name}?`)) {
      await deleteDistrict(id, name, currentUser?.name || 'სისტემა');
      await refreshAllData();
    }
  };

  const handleSaveTruck = async (t: Truck) => {
    await saveTruck(t, currentUser?.name || 'სისტემა');
    await refreshAllData();
  };
  const handleDeleteTruck = async (plate: string) => {
    if (confirm(`გსურთ მანქანის (${plate}) წაშლა?`)) {
      await deleteTruck(plate, currentUser?.name || 'სისტემა');
      await refreshAllData();
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
          ბიოდიზელი ჯორჯია - იტვირთება...
        </p>
      </div>
    );
  }

  // Auth requirement
  if (!currentUser) {
    return (
      <LoginView 
        employees={employees} 
        onLoginSuccess={(emp) => setCurrentUser(emp)} 
      />
    );
  }

  // Sidebar List configuration matching user options perfectly
  const menuItems = [
    { id: 'dashboard', name: 'მთავარი მენიუ', icon: <LayoutDashboard size={16} /> },
    { id: 'analytics', name: 'ანალიტიკა', icon: <BarChart3 size={16} /> },
    { id: 'suppliers', name: 'მომწოდებლები', icon: <Building2 size={16} /> },
    { id: 'communications', name: 'კომუნიკაცია', icon: <MessageSquare size={16} /> },
    { id: 'orders', name: 'შეკვეთები', icon: <ShoppingBag size={16} /> },
    { id: 'employees', name: 'თანამშრომლები', icon: <Users size={16} /> },
    { id: 'reports', name: 'რეპორტები', icon: <FileText size={16} /> },
    { id: 'lookups', name: 'ცნობარები', icon: <Globe size={16} /> },
    { id: 'history', name: 'ცვლილებების ისტორია', icon: <History size={16} /> },
    { id: 'settings', name: 'პარამეტრები', icon: <Settings size={16} /> }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-700 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar - Collapsible on Mobile, Fixed on Desktop */}
      <aside className={`bg-slate-900 text-slate-100 flex-shrink-0 flex flex-col justify-between transition-all duration-300 z-30 ${
        mobileMenuOpen ? 'fixed inset-y-0 left-0 w-64' : 'hidden md:flex md:w-64'
      }`}>
        
        {/* Sidebar Header Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-850 p-1.5 rounded-lg text-white">
              <Leaf size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none text-white">
                ბიოდიზელი ჯორჯია
              </h1>
              <span className="text-[9px] font-mono text-emerald-400 tracking-widest uppercase block mt-1">
                პორტალი v2.0
              </span>
            </div>
          </div>
          
          {/* Close mobile nav */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sidebar Middle - Menu Items Link list */}
        <div className="flex-1 py-4 overflow-y-auto px-3 space-y-1 select-none">
          
          {/* Quick Structure Description trigger */}
          <button 
            onClick={() => setShowStructureDesc(!showStructureDesc)}
            className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-75 * rounded-xl text-[11px] font-medium text-emerald-300 flex items-center justify-between mb-2.5"
          >
            <span className="flex items-center gap-1.5 font-bold">
              <Info size={14} />
              სტრუქტურის აღწერა
            </span>
            <ChevronRight size={12} className={`transition ${showStructureDesc ? 'rotate-90' : ''}`} />
          </button>

          {showStructureDesc && (
            <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-[10px] text-slate-400 leading-normal space-y-1.5 mb-2 font-mono">
              <p className="font-bold text-slate-200 uppercase">მონაცემთა სტრუქტურა:</p>
              <p>• <strong>მომწოდებლები</strong> - სრული იურიდიული, საბანკო და საკონტაქტო მონაცემები, კომენტარების ისტორია.</p>
              <p>• <strong>შეკვეთები</strong> - ლოგისტიკური დაგეგმვა, ავზების და ფაქტობრივი ლიტრების მართვა მძღოლებზე.</p>
              <p>• <strong>კონტაქტები</strong> - ოპერატორთან, ბუღალტერთან, დირექტორთან კავშირის ხაზი.</p>
              <p>• <strong>ცნობარები</strong> - ქალაქები, უბნები, საწყობები და მანქანების სია.</p>
            </div>
          )}

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
                    ? 'bg-emerald-800 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* Sidebar Bottom - User Profile block and signout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/20 select-none">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 font-extrabold flex items-center justify-center text-xs text-slate-200 uppercase">
              {currentUser.name.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</p>
              <span className="text-[10px] text-emerald-400 font-mono capitalize">
                {currentUser.role === 'admin' ? 'ადმინისტრატორი' : 'პერსონალი'}
              </span>
            </div>
          </div>

          <button 
            onClick={handleLogOut}
            className="w-full py-1.5 bg-slate-850 hover:bg-red-900 border border-slate-800 hover:border-red-950 hover:text-white rounded-lg text-[11px] font-bold text-slate-400 transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <LogOut size={13} />
            სისტემიდან გასვლა
          </button>
        </div>

      </aside>

      {/* Main Panel Box */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Mobile Navbar Top */}
        <header className="md:hidden bg-white border-b border-gray-100 flex items-center justify-between p-4 flex-shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-800 text-white p-1 rounded-lg">
              <Leaf size={16} />
            </div>
            <span className="font-black text-sm text-gray-800">ბიოდიზელი ჯორჯია</span>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 bg-gray-50 border rounded-lg text-gray-700"
          >
            <Menu size={18} />
          </button>
        </header>

        {/* Right content viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-16">
          
          {/* Main workspace container route outputs */}
          <div className="max-w-6xl mx-auto">
            {activeTab === 'dashboard' && (
              <DashboardView 
                suppliers={suppliers}
                orders={orders}
                employees={employees}
                trucks={trucks}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView 
                suppliers={suppliers}
                orders={orders}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'suppliers' && (
              <SuppliersView 
                suppliers={suppliers}
                warehouses={warehouses}
                employees={employees}
                cities={cities}
                districts={districts}
                currentEmployee={currentUser}
                onSave={handleSupplierSave}
                onDelete={handleSupplierDelete}
              />
            )}

            {activeTab === 'communications' && (
              <CommunicationsView 
                communications={communications}
                suppliers={suppliers}
                employees={employees}
                currentEmployee={currentUser}
                onSave={handleCommunicationSave}
                onDelete={handleCommunicationDelete}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersView 
                orders={orders}
                suppliers={suppliers}
                warehouses={warehouses}
                employees={employees}
                trucks={trucks}
                currentEmployee={currentUser}
                onSave={handleOrderSave}
                onDelete={handleOrderDelete}
              />
            )}

            {activeTab === 'employees' && (
              <EmployeesView 
                employees={employees}
                currentEmployee={currentUser}
                onSave={handleEmployeeSave}
                onDelete={handleEmployeeDelete}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView 
                suppliers={suppliers}
                orders={orders}
              />
            )}

            {activeTab === 'lookups' && (
              <LookupsView 
                cities={cities}
                districts={districts}
                trucks={trucks}
                employees={employees}
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
