import { useState, useEffect, useRef } from 'react';
import { 
  User, Vendor, Order, Communication, Vehicle as Truck, 
  ChangeHistory, Warehouse, City, District, Direction 
} from '../../types';
import { 
  getUsers, getVendors, getOrders, getActiveOrdersCount,
  getCommunications, getVehicles as getTrucks, getChangeHistory,
  getWarehouses, getCities, getDistricts, getDirections
} from '../../lib/db';
import { onRealtimeDbChange } from '../../lib/realtime';
import { 
  getDriverLogisticsData, 
  getDriverOrdersAndVendors, 
  getSupplierAppData 
} from '../../services/roleDataService';

export function useAppDataFetch(currentUser: User | null, isLoadingAuth: boolean) {
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
  const [isLoading, setIsLoading] = useState(true);

  const isRefreshingRef = useRef(false);
  const lastLoadedUserIdRef = useRef<string | null>(null);
  const trucksRef = useRef<Truck[]>([]);
  const usersRef = useRef<User[]>([]);
  const vendorsRef = useRef<Vendor[]>([]);

  useEffect(() => {
    trucksRef.current = trucks;
  }, [trucks]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  useEffect(() => {
    vendorsRef.current = vendors;
  }, [vendors]);

  // Sync data function
  const refreshAllData = async () => {
    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;
    try {
      // 1. Specialized lightweight loader for Drivers / Mobile Logistics
      if (currentUser?.role === 'driver' || currentUser?.role === 'driver_assistant') {
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
        getVendors(1000),
        getOrders(1000, currentUser),
        getActiveOrdersCount(currentUser),
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
      if (currentUser?.role === 'driver' || currentUser?.role === 'driver_assistant') {
        const t = table.toLowerCase();
        if (t === 'orders' || t === 'vendors' || t === 'vendor_contacts') {
          const { orders: dOrders, suppliers: dSuppliers } = await getDriverOrdersAndVendors(
            currentUser,
            trucksRef.current.length > 0 ? trucksRef.current : await getTrucks(),
            usersRef.current.length > 0 ? usersRef.current : await getUsers(),
            vendorsRef.current
          );
          setOrders(dOrders);
          if (dSuppliers.length > 0) {
            setVendors(dSuppliers);
          }
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
          getOrders(1000, currentUser),
          getActiveOrdersCount(currentUser)
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

  return {
    users,
    setUsers,
    vendors,
    setVendors,
    orders,
    setOrders,
    activeOrdersCount,
    setActiveOrdersCount,
    communications,
    setCommunications,
    trucks,
    setTrucks,
    changeHistory,
    setChangeHistory,
    historyOffset,
    isLoadingMore,
    warehouses,
    setWarehouses,
    cities,
    setCities,
    districts,
    setDistricts,
    directions,
    setDirections,
    isLoading,
    refreshAllData,
    refreshTable,
    handleLoadMoreHistory
  };
}
