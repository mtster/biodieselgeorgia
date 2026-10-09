import React from 'react';
import { 
  User, Vendor, Order, Communication, Vehicle as Truck, 
  ChangeHistory, Warehouse, City, District, Direction 
} from '../../types';
import { t } from '../../utils/lang';
import { 
  saveUser, deleteUser,
  saveVendor, deleteVendor,
  saveOrder, deleteOrder,
  saveCommunication, deleteCommunication,
  saveVehicle as saveTruck, deleteVehicle as deleteTruck,
  saveWarehouse, deleteWarehouse,
  saveCity, deleteCity,
  saveDistrict, deleteDistrict,
  saveDirection, deleteDirection,
  revertChange
} from '../../lib/db';

interface UseAppDataMutationsParams {
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  communications: Communication[];
  setCommunications: React.Dispatch<React.SetStateAction<Communication[]>>;
  trucks: Truck[];
  setTrucks: React.Dispatch<React.SetStateAction<Truck[]>>;
  refreshTable: (table?: string) => Promise<void>;
  refreshAllData: () => Promise<void>;
  setErrorModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; title: string; errorMsg: string }>>;
}

export function useAppDataMutations({
  currentUser,
  setCurrentUser,
  users,
  setUsers,
  vendors,
  setVendors,
  orders,
  setOrders,
  communications,
  setCommunications,
  trucks,
  setTrucks,
  refreshTable,
  refreshAllData,
  setErrorModal
}: UseAppDataMutationsParams) {

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
    const canDelete = currentUser?.role === 'admin' || currentUser?.permissions?.['suppliers']?.includes('delete');
    if (!canDelete) {
      setErrorModal({
        isOpen: true,
        title: 'წვდომა შეზღუდულია',
        errorMsg: 'მომწოდებლის წაშლის უფლება არ გაქვთ.'
      });
      return;
    }
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

      // Synchronize vehicle assignment when driver and/or assistant are assigned via order
      const targetTruck = trucks.find(t => 
        (saved.vehicle_id && t.id === saved.vehicle_id) || 
        (saved.truck_plate && (t.plate_number === saved.truck_plate || t.id === saved.truck_plate))
      );
      if (targetTruck) {
        const newDriverId = saved.driver_id || null;
        const newCompanionId = saved.companion_id || null;
        if (targetTruck.driver_id !== newDriverId || targetTruck.companion_id !== newCompanionId) {
          const dObj = users.find(u => u.id === newDriverId);
          const cObj = users.find(u => u.id === newCompanionId);
          const updatedTruck: Truck = {
            ...targetTruck,
            driver_id: newDriverId,
            driver_name: dObj?.name || (newDriverId ? targetTruck.driver_name : ''),
            companion_id: newCompanionId,
            companion_name: cObj?.name || (newCompanionId ? targetTruck.companion_name : '')
          };
          try {
            await saveTruck(updatedTruck, currentUser?.name || 'System', currentUser?.id);
            setTrucks(prev => prev.map(t => (t.id === updatedTruck.id || t.plate_number === updatedTruck.plate_number) ? updatedTruck : t));
          } catch (tErr) {
            console.warn('Vehicle driver sync error on order save:', tErr);
          }
        }
      }

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
    const canDelete = currentUser?.role === 'admin' || currentUser?.permissions?.['orders']?.includes('delete');
    if (!canDelete) {
      setErrorModal({
        isOpen: true,
        title: 'წვდომა შეზღუდულია',
        errorMsg: 'შეკვეთის წაშლის უფლება არ გაქვთ.'
      });
      return;
    }
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

  const handleSaveTruck = async (truck: Truck) => {
    try {
      await saveTruck(truck, currentUser?.name || 'System', currentUser?.id);
      await refreshTable('vehicles');
    } catch (err: any) {
      console.error('handleSaveTruck error:', err);
      setErrorModal({
        isOpen: true,
        title: t('Vehicle Specifications') || 'ავტომობილი',
        errorMsg: err?.message || 'ავტომობილის შენახვა ვერ მოხერხდა'
      });
      throw err;
    }
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
    handleRevertChange
  };
}
