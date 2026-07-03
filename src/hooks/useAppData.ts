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
  getOrders, saveOrder, deleteOrder,
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

export function useAppData() {
  const { currentUser, setCurrentUser, isLoadingAuth, handleLogOut } = useAuth();

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
  const [directions, setDirections] = useState<Direction[]>([]);

  // System status
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showStructureDesc, setShowStructureDesc] = useState(false);

  // Sync data function
  const refreshAllData = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await createDatabaseOrderColumn('waybill_qty');
      }
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
      const dirs = await getDirections();

      setUsers(usrs);
      setVendors(vnds);
      setOrders(ords);
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

  useEffect(() => {
    if (!isLoadingAuth && !currentUser) {
      setIsLoading(false);
    }
  }, [isLoadingAuth, currentUser]);

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
    await deleteCommunication(id, currentUser?.name || 'System');
    await refreshAllData();
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

  const handleSaveDirection = async (d: Direction) => {
    await saveDirection(d, currentUser?.name || 'System');
    await refreshAllData();
  };
  const handleDeleteDirection = async (id: string, name: string) => {
    if (confirm(`Delete direction ${name}?`)) {
      await deleteDirection(id, name, currentUser?.name || 'System');
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

  return {
    currentUser,
    setCurrentUser,
    deleteAlertMessage,
    setDeleteAlertMessage,
    users,
    vendors,
    orders,
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
    handleLogOut
  };
}
