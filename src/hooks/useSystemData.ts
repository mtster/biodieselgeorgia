import { useState, useEffect } from 'react';
import { User, Vendor, Order, Communication, Vehicle as Truck, ChangeHistory, Warehouse, City, District } from '../types';
import { 
  getUsers, getVendors, getOrders, getCommunications, getVehicles, getChangeHistory, 
  getWarehouses, getCities, getDistricts
} from '../lib/db';

export function useSystemData(currentUser: User | null) {
  const [data, setData] = useState({
    users: [] as User[],
    vendors: [] as Vendor[],
    orders: [] as Order[],
    communications: [] as Communication[],
    trucks: [] as Truck[],
    changeHistory: [] as ChangeHistory[],
    warehouses: [] as Warehouse[],
    cities: [] as City[],
    districts: [] as District[]
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshAllData = async () => {
    try {
      const [users, vendors, orders, communications, trucks, changeHistory, warehouses, cities, districts] = await Promise.all([
        getUsers(), getVendors(), getOrders(), getCommunications(), getVehicles(), 
        getChangeHistory(), getWarehouses(), getCities(), getDistricts()
      ]);
      setData({ users, vendors, orders, communications, trucks, changeHistory, warehouses, cities, districts });
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

  return { ...data, isLoading, refreshAllData };
}
