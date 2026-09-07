import { useState, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { 
  User, Vendor, Order, Communication, Vehicle as Truck, 
  ChangeHistory, Warehouse, City, District, Direction 
} from '../types';
import { t } from '../utils/lang';
import { 
  getUsers, saveUser, deleteUser,
  getVendors, saveVendor, deleteVendor,
  getOrders, getActiveOrdersCount, saveOrder, deleteOrder,
  getCommunications, saveCommunication, deleteCommunication,
  getVehicles as getTrucks, saveVehicle as saveTruck, deleteVehicle as deleteTruck,
  getChangeHistory,
  getWarehouses, saveWarehouse, deleteWarehouse,
  getCities, saveCity, deleteCity,
  getDistricts, saveDistrict, deleteDistrict,
  getDirections, saveDirection, deleteDirection,
  resetSystemDatabase, isSupabaseConfigured, supabase, revertChange,
  createDatabaseOrderColumn
} from '../lib/db';
import { 
  checkSupplierDeletion, 
  checkUserDeletion, 
  checkCityDeletion, 
  checkVehicleDeletion, 
  checkWarehouseDeletion 
} from '../utils/deletionValidation';
import { onRealtimeDbChange } from '../lib/realtime';
import { 
  getDriverLogisticsData, 
  getDriverOrdersAndVendors, 
  getSupplierAppData 
} from '../services/roleDataService';

export function useAppData() {
  const { currentUser, setCurrentUser, isLoadingAuth, handleLogOut } = useAuth();

  const [deleteAlertMessage, setDeleteAlertMessage] = useState<string | null>(null);
  
  // Database Live Models
  const [users, setUsers] = useState<User[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeHistory[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [directions, setDirections] = useState<Direction[]>([]);

  // System status
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showStructureDesc, setShowStructureDesc] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; errorMsg: string }>({
    isOpen: false,
    title: '',
    errorMsg: ''
  });

  const isRefreshingRef = useRef(false);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const trucksRef = useRef<Truck[]>([]);
  const usersRef = useRef<User[]>([]);
  useEffect(() => {
    trucksRef.current = trucks;
  }, [trucks]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Sync data function
  const refreshAllData = async () => {
    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;
    try {
      // 1. Specialized lightweight loader for Drivers / Mobile Logistics
      if (currentUser?.role === 'driver') {
        const driverData = await getDriverLogisticsData(currentUser);
        setTrucks(driverData.trucks);
        setUsers(driverData.employees);
        setWarehouses(driverData.warehouses);
        setOrders(driverData.orders);
        setVendors(driverData.suppliers);
        setCommunications([]);
        setChangeHistory([]);
        setCities([]);
        setDistricts([]);
        setDirections([]);
        return;
      }

      // 2. Specialized lightweight loader for Suppliers / Vendors
      if (currentUser?.role === 'vendor') {
        const supplierData = await getSupplierAppData(currentUser);
        setVendors(supplierData.vendor ? [supplierData.vendor] : []);
        setOrders(supplierData.orders);
        setWarehouses(supplierData.warehouses);
        setTrucks([]);
        setUsers([]);
        setCommunications([]);
        setChangeHistory([]);
        setCities([]);
        setDistricts([]);
        setDirections([]);
        return;
      }

      // 3. Full management system data sync for admin / managers
      const [usrs, vnds, ords, activeOrdCount, comms, trks, hist, whs, cts, dsts, dirs] = await Promise.all([
        getUsers(),
        getVendors(),
        getOrders(5),
        getActiveOrdersCount(),
        getCommunications(),
        getTrucks(),
        getChangeHistory(50, 0),
        getWarehouses(),
        getCities(),
        getDistricts(),
        getDirections()
      ]);

      setHistoryOffset(0);
      setUsers(usrs);
      setVendors(vnds);
      setOrders(ords);
      setActiveOrdersCount(activeOrdCount);
      setCommunications(comms);
      setTrucks(trks);
      setChangeHistory(hist);
      setWarehouses(whs);
      setCities(cts);
      setDistricts(dsts);
      setDirections(dirs);
    } catch (e) {
      console.error('Error synchronizing database:', e);
    } finally {
      isRefreshingRef.current = false;
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

  // Targeted sync data function
  const refreshTable = async (table?: string) => {
    try {
      if (!table) {
        await refreshAllData();
        return;
      }

      // Role-specific targeted refreshes
      if (currentUser?.role === 'driver') {
        const t = table.toLowerCase();
        if (t === 'orders' || t === 'vendors' || t === 'vendor_contacts') {
          const { orders: dOrders, suppliers: dSuppliers } = await getDriverOrdersAndVendors(
            currentUser,
            trucksRef.current.length > 0 ? trucksRef.current : await getTrucks(),
            usersRef.current.length > 0 ? usersRef.current : await getUsers()
          );
          setOrders(dOrders);
          setVendors(dSuppliers);
        } else if (t === 'vehicles' || t === 'trucks') {
          const trks = await getTrucks();
          setTrucks(trks);
        } else if (t === 'warehouses') {
          const whs = await getWarehouses();
          setWarehouses(whs);
        } else if (t === 'profiles' || t === 'users') {
          const usrs = await getUsers();
          setUsers(usrs);
        }
        return;
      }

      if (currentUser?.role === 'vendor') {
        const t = table.toLowerCase();
        if (t === 'orders' || t === 'vendors' || t === 'warehouses') {
          const supplierData = await getSupplierAppData(currentUser);
          setVendors(supplierData.vendor ? [supplierData.vendor] : []);
          setOrders(supplierData.orders);
          setWarehouses(supplierData.warehouses);
        }
        return;
      }

      const t = table.toLowerCase();
      if (t === 'vehicles' || t === 'trucks') {
        const trks = await getTrucks();
        setTrucks(trks);
      } else if (t === 'cities') {
        const cts = await getCities();
        setCities(cts);
      } else if (t === 'districts') {
        const dsts = await getDistricts();
        setDistricts(dsts);
      } else if (t === 'directions') {
        const dirs = await getDirections();
        setDirections(dirs);
      } else if (t === 'warehouses') {
        const whs = await getWarehouses();
        setWarehouses(whs);
      } else if (t === 'profiles' || t === 'users') {
        const usrs = await getUsers();
        setUsers(usrs);
      } else if (t === 'orders') {
        const [ords, activeOrdCount] = await Promise.all([
          getOrders(5),
          getActiveOrdersCount()
        ]);
        setOrders(ords);
        setActiveOrdersCount(activeOrdCount);
      } else if (t === 'vendors') {
        const vnds = await getVendors(100);
        setVendors(vnds);
      } else if (t === 'communications' || t === 'vendor_communications') {
        const comms = await getCommunications(50);
        setCommunications(comms);
      } else if (t === 'change_history') {
        const hist = await getChangeHistory(50, 0);
        setChangeHistory(hist);
      }
    } catch (e) {
      console.error(`Error refreshing table ${table}:`, e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      if (lastLoadedUserIdRef.current !== currentUser.id) {
        lastLoadedUserIdRef.current = currentUser.id;
        refreshAllData();
      }
      // Listen for database broadcasts and live changes across the system
      const unsubscribe = onRealtimeDbChange((table) => {
        refreshTable(table);
      });
      return () => {
        unsubscribe();
      };
    } else {
      lastLoadedUserIdRef.current = null;
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isLoadingAuth && !currentUser) {
      setIsLoading(false);
    }
  }, [isLoadingAuth, currentUser]);

  // Operations
  const handleUserSave = async (user: User) => {
    try {
      const saved = await saveUser(user, currentUser?.name || 'System');
      setUsers(prev => {
        const exists = prev.some(u => u.id === saved.id);
        return exists ? prev.map(u => u.id === saved.id ? saved : u) : [saved, ...prev];
      });
      if (currentUser && user.id === currentUser.id) {
        setCurrentUser(user);
      }
      return saved;
    } catch (e: any) {
      console.error('Error saving user:', e);
      setErrorModal({
        isOpen: true,
        title: 'Authentication / Sync Error',
        errorMsg: e.message || 'Check your permissions.'
      });
    }
  };

  const handleUserDelete = async (id: string, name: string) => {
    try {
      await deleteUser(id, name, currentUser?.name || 'System', currentUser?.role);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (e: any) {
      console.error('Error deleting user:', e);
      setErrorModal({
        isOpen: true,
        title: 'Delete Error',
        errorMsg: e.message || 'Permissions denied.'
      });
    }
  };

  const handleVendorSave = async (vnd: Vendor) => {
    try {
      const saved = await saveVendor(vnd, currentUser?.name || 'System', currentUser?.id);
      setVendors(prev => {
        const exists = prev.some(v => v.id === saved.id);
        return exists ? prev.map(v => v.id === saved.id ? saved : v) : [saved, ...prev];
      });
      return saved;
    } catch (e: any) {
      console.error('Error saving supplier:', e);
      setErrorModal({
        isOpen: true,
        title: 'Supplier Save Error',
        errorMsg: e.message || 'Check connection / permissions.'
      });
      return null;
    }
  };

  const handleVendorDelete = async (id: string, tradeName: string) => {
    try {
      await deleteVendor(id, tradeName, currentUser?.name || 'System');
      setVendors(prev => prev.filter(v => v.id !== id));
    } catch (e: any) {
      console.error('Error deleting supplier:', e);
      setErrorModal({
        isOpen: true,
        title: 'Supplier Delete Error',
        errorMsg: e.message || 'Check permissions.'
      });
    }
  };

  const handleOrderSave = async (ord: Order) => {
    try {
      const saved = await saveOrder(ord, currentUser?.name || 'System');
      setOrders(prev => {
        const exists = prev.some(o => o.id === saved.id);
        return exists ? prev.map(o => o.id === saved.id ? saved : o) : [saved, ...prev];
      });
      return saved;
    } catch (e: any) {
      console.error('Error saving order:', e);
      setErrorModal({
        isOpen: true,
        title: 'Order Save Error',
        errorMsg: e.message || 'Check connection / permissions.'
      });
    }
  };

  const handleOrderDelete = async (id: string, docNum: string) => {
    try {
      await deleteOrder(id, docNum, currentUser?.name || 'System');
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (e: any) {
      console.error('Error deleting order:', e);
      setErrorModal({
        isOpen: true,
        title: 'Order Delete Error',
        errorMsg: e.message || 'Check permissions.'
      });
    }
  };

  const handleCommunicationSave = async (comm: Communication): Promise<void> => {
    try {
      const saved = await saveCommunication(comm, currentUser?.name || 'System', currentUser?.id);
      setCommunications(prev => {
        const exists = prev.some(c => c.id === saved.id);
        return exists ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev];
      });
    } catch (e: any) {
      console.error('Error saving communication:', e);
    }
  };

  const handleCommunicationDelete = async (id: string) => {
    try {
      await deleteCommunication(id, currentUser?.name || 'System');
      setCommunications(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      console.error('Error deleting communication:', e);
    }
  };

  // Lookups updates
  const handleSaveCity = async (c: City) => {
    await saveCity(c, currentUser?.name || 'System', currentUser?.id);
    await refreshTable('cities');
  };
  const handleDeleteCity = async (id: string, name: string) => {
    await deleteCity(id, name, currentUser?.name || 'System');
    await refreshTable('cities');
  };

  const handleSaveDistrict = async (d: District) => {
    await saveDistrict(d, currentUser?.name || 'System', currentUser?.id);
    await refreshTable('districts');
  };
  const handleDeleteDistrict = async (id: string, name: string) => {
    await deleteDistrict(id, name, currentUser?.name || 'System');
    await refreshTable('districts');
  };

  const handleSaveDirection = async (d: Direction) => {
    await saveDirection(d, currentUser?.name || 'System', currentUser?.id);
    await refreshTable('directions');
  };
  const handleDeleteDirection = async (id: string, name: string) => {
    await deleteDirection(id, name, currentUser?.name || 'System');
    await refreshTable('directions');
  };

  const handleSaveTruck = async (t: Truck) => {
    await saveTruck(t, currentUser?.name || 'System', currentUser?.id);
    await refreshTable('vehicles');
  };
  const handleDeleteTruck = async (plate: string) => {
    await deleteTruck(plate, currentUser?.name || 'System');
    await refreshTable('vehicles');
  };

  const handleAddCityDirect = async (name: string) => {
    const newCity: City = {
      id: '',
      name,
      created_by: currentUser?.id
    };
    await handleSaveCity(newCity);
  };

  const handleAddDistrictDirect = async (cityId: string, name: string) => {
    const newDst: District = {
      id: '',
      city_id: cityId,
      name,
      created_by: currentUser?.id
    };
    await handleSaveDistrict(newDst);
  };

  const handleAddWarehouseDirect = async (name: string) => {
    const newWh: Warehouse = {
      id: '',
      name,
      created_by: currentUser?.id
    };
    await saveWarehouse(newWh, currentUser?.name || 'System', currentUser?.id);
    await refreshTable('warehouses');
  };

  const handleSaveWarehouse = async (wh: Warehouse) => {
    await saveWarehouse(wh, currentUser?.name || 'System', currentUser?.id);
    await refreshTable('warehouses');
  };

  const handleDeleteWarehouse = async (id: string, name: string) => {
    await deleteWarehouse(id, name, currentUser?.name || 'System');
    await refreshTable('warehouses');
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

  return {
    currentUser,
    setCurrentUser,
    deleteAlertMessage,
    setDeleteAlertMessage,
    users,
    vendors,
    orders,
    activeOrdersCount,
    communications,
    trucks,
    changeHistory,
    historyOffset,
    isLoadingMore,
    warehouses,
    cities,
    districts,
    directions,
    isLoading,
    activeTab,
    setActiveTab,
    mobileMenuOpen,
    setMobileMenuOpen,
    showStructureDesc,
    setShowStructureDesc,
    refreshAllData,
    handleLoadMoreHistory,
    handleUserSave,
    handleUserDelete,
    handleVendorSave,
    handleVendorDelete,
    handleOrderSave,
    handleOrderDelete,
    handleCommunicationSave,
    handleCommunicationDelete,
    handleSaveCity,
    handleDeleteCity,
    handleSaveDistrict,
    handleDeleteDistrict,
    handleSaveDirection,
    handleDeleteDirection,
    handleSaveTruck,
    handleDeleteTruck,
    handleAddCityDirect,
    handleAddDistrictDirect,
    handleAddWarehouseDirect,
    handleSaveWarehouse,
    handleDeleteWarehouse,
    handleRevertChange,
    handleLogOut,
    errorModal,
    setErrorModal
  };
}
