/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, Vendor, Order, Communication, Vehicle as Truck, 
  ChangeHistory, Warehouse, City, District 
} from './types';

import { 
  getUsers, saveUser, deleteUser,
  getVendors, saveVendor, deleteVendor,
  getOrders, saveOrder, deleteOrder,
  getCommunications, saveCommunication, deleteCommunication,
  getVehicles as getTrucks, saveVehicle as saveTruck, deleteVehicle as deleteTruck,
  getChangeHistory,
  getWarehouses, saveWarehouse, deleteWarehouse,
  getCities, saveCity, deleteCity,
  getDistricts, saveDistrict, deleteDistrict,
  resetSystemDatabase, isSupabaseConfigured, supabase, revertChange
} from './lib/db';

// Modular view components
import LoginView from './components/menu/LoginView';
import DashboardView from './components/menu/DashboardView';
import AnalyticsView from './components/menu/AnalyticsView';
import VendorsView from './components/menu/VendorsView';
import CommunicationsView from './components/menu/CommunicationsView';
import OrdersView from './components/menu/OrdersView';
import UsersView from './components/menu/UsersView';
import ReportsView from './components/menu/ReportsView';
import CitiesSettingView from './components/settings/CitiesSettingView';
import VehiclesSettingView from './components/settings/VehiclesSettingView';
import WarehousesSettingView from './components/settings/WarehousesSettingView';
import HistoryView from './components/menu/HistoryView';
import MobileLogisticsView from './components/menu/MobileLogisticsView';
import Sidebar from './components/menu/Sidebar';

// Relational deletion validators
import { 
  checkSupplierDeletion, 
  checkUserDeletion, 
  checkCityDeletion, 
  checkVehicleDeletion, 
  checkWarehouseDeletion 
} from './utils/deletionValidation';

// Icons for Left Sidebar pairing
import { 
  Leaf, LayoutDashboard, BarChart3, Building2, MessageSquare, 
  ShoppingBag, Users, FileText, Database, Settings, History, 
  Globe, LogOut, Info, ShieldCheck, ChevronRight, Menu, X
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [deleteAlertMessage, setDeleteAlertMessage] = useState<string | null>(null);
  
  // Database Live Models
  const [users, setUsers] = useState<User[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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
      const hist = await getChangeHistory(50, 0); // initial load
      setHistoryOffset(0);
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

  const handleLoadMoreHistory = async () => {
    setIsLoadingMore(true);
    try {
      const nextOffset = historyOffset + 50;
      const moreHist = await getChangeHistory(50, nextOffset);
      if (moreHist && moreHist.length > 0) {
        setChangeHistory(prev => [...prev, ...moreHist]);
        setHistoryOffset(nextOffset);
      }
    } catch (e) {
      console.error('Error fetching more history:', e);
    } finally {
      setIsLoadingMore(false);
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
      const updatedUsers = await getUsers();
      setUsers(updatedUsers);
      if (currentUser && user.id === currentUser.id) {
        setCurrentUser(updatedUsers.find(u => u.id === user.id) || null);
      }
    } catch (e: any) {
      console.error('Error saving user:', e);
      alert(`⚠️ Authentication / Sync Error: ${e.message || 'Check your permissions.'}\nCould not add or update this user in the Auth database.`);
    }
  };

  const handleUserDelete = async (id: string, name: string) => {
    const errorMsg = checkUserDeletion(id, name, orders, vendors);
    if (errorMsg) {
      setDeleteAlertMessage(errorMsg);
      return;
    }

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
    const errorMsg = checkSupplierDeletion(id, tradeName, orders);
    if (errorMsg) {
      setDeleteAlertMessage(errorMsg);
      return;
    }
    try {
      await deleteVendor(id, tradeName, currentUser?.name || 'System');
      await refreshAllData();
    } catch (e: any) {
      console.error('Error deleting supplier:', e);
      alert(`⚠️ Supplier Delete Error: ${e.message || 'Check permissions.'}`);
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
    try {
      await deleteOrder(id, docNum, currentUser?.name || 'System');
      await refreshAllData();
    } catch (e: any) {
      console.error('Error deleting order:', e);
      alert(`⚠️ Order Delete Error: ${e.message || 'Check permissions.'}`);
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
    const errorMsg = checkCityDeletion(id, name, vendors);
    if (errorMsg) {
      setDeleteAlertMessage(errorMsg);
      return;
    }
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
    const errorMsg = checkVehicleDeletion(plate, orders);
    if (errorMsg) {
      setDeleteAlertMessage(errorMsg);
      return;
    }
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

  const handleSaveWarehouse = async (wh: Warehouse) => {
    await saveWarehouse(wh, currentUser?.name || 'System');
    await refreshAllData();
  };

  const handleDeleteWarehouse = async (id: string, name: string) => {
    const errorMsg = checkWarehouseDeletion(id, name, vendors, orders);
    if (errorMsg) {
      setDeleteAlertMessage(errorMsg);
      return;
    }
    if (confirm(`Are you sure you want to permanently delete warehouse "${name}"?`)) {
      await deleteWarehouse(id, name, currentUser?.name || 'System');
      await refreshAllData();
    }
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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-750 flex flex-col md:flex-row font-sans">
      
      <div className={`${mobileMenuOpen ? 'block' : 'hidden md:block'} z-[60] fixed inset-0 md:relative md:inset-auto`}>
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onLogOut={handleLogOut}
        />
      </div>

      {/* Main Viewport Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Mobile Navbar Top */}
        <header className="md:hidden bg-white border-b border-gray-100 flex items-center justify-between p-4 flex-shrink-0 shadow-xs relative z-40">
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
        <main className="flex-1 overflow-y-auto px-4 md:px-6 pb-16 pt-0 md:pt-0">
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
                communications={communications}
                onSaveCommunication={handleCommunicationSave}
                onDeleteCommunication={handleCommunicationDelete}
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

            {(activeTab === 'lookups' || activeTab === 'cities') && (
              <CitiesSettingView 
                cities={cities}
                districts={districts}
                onSaveCity={handleSaveCity}
                onDeleteCity={handleDeleteCity}
                onSaveDistrict={handleSaveDistrict}
                onDeleteDistrict={handleDeleteDistrict}
                onBack={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'vehicles' && (
              <VehiclesSettingView 
                trucks={trucks}
                employees={users}
                cities={cities}
                onSaveTruck={handleSaveTruck}
                onDeleteTruck={handleDeleteTruck}
                onBack={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'warehouses' && (
              <WarehousesSettingView 
                warehouses={warehouses}
                onSaveWarehouse={handleSaveWarehouse}
                onDeleteWarehouse={handleDeleteWarehouse}
                onBack={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView 
                history={changeHistory}
                loadMore={handleLoadMoreHistory}
                isLoadingMore={isLoadingMore}
              />
            )}
          </div>
        </main>

      </div>

      {deleteAlertMessage && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-gray-200 text-center animate-scale-up">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 animate-bounce">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">Deletion Blocked</h3>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed font-medium">
                {deleteAlertMessage}
              </p>
            </div>
            <button
              onClick={() => setDeleteAlertMessage(null)}
              className="w-full inline-flex justify-center rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition shadow-sm focus:outline-none cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
