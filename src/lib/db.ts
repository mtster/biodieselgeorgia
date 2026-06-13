/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { 
  User, Vendor, Order, Communication, Truck, 
  ChangeHistory, Warehouse, City, District 
} from '../types';

// Detect Supabase credentials
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

// Initialize Supabase Client if possible
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ==========================================
// DEFAULT SEED KEYS AND LOCALSTORAGE HELPERS
// ==========================================

const KEY_USERS = 'biodiesel_users_v2';
const KEY_VENDORS = 'biodiesel_vendors_v2';
const KEY_ORDERS = 'biodiesel_orders_v2';
const KEY_COMMUNICATIONS = 'biodiesel_communications_v2';
const KEY_TRUCKS = 'biodiesel_trucks_v2';
const KEY_CHANGE_HISTORY = 'biodiesel_change_history_v2';
const KEY_WAREHOUSES = 'biodiesel_warehouses_v2';
const KEY_CITIES = 'biodiesel_cities_v2';
const KEY_DISTRICTS = 'biodiesel_districts_v2';

const DEFAULT_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Administrator',
    personal_id: '12345678901',
    email: 'admin@biodiesel.ge',
    password: 'admin123',
    phone: '599112233',
    role: 'admin',
    privileges: ['All', 'Manage', 'Order', 'Reports'],
    created_at: new Date().toISOString()
  }
];

const DEFAULT_CITIES: City[] = [
  { id: 'city-tbilisi', name: 'Tbilisi' },
  { id: 'city-kutaisi', name: 'Kutaisi' },
  { id: 'city-batumi', name: 'Batumi' }
];

const DEFAULT_DISTRICTS: District[] = [
  { id: 'dist-sab-tb', city_id: 'city-tbilisi', name: 'Saburtalo' },
  { id: 'dist-vake-tb', city_id: 'city-tbilisi', name: 'Vake' },
  { id: 'dist-gld-tb', city_id: 'city-tbilisi', name: 'Gldani' },
  { id: 'dist-ctr-kut', city_id: 'city-kutaisi', name: 'Center' },
  { id: 'dist-prt-bat', city_id: 'city-batumi', name: 'Port' }
];

const DEFAULT_WAREHOUSES: Warehouse[] = [
  { id: 'wh-main', name: 'Central Warehouse' },
  { id: 'wh-west', name: 'West Warehouse' }
];

const DEFAULT_TRUCKS: Truck[] = [
  { plate_number: 'BB-777-GG', model: 'Scania R500', driver_id: '', companion_id: '' }
];

// LocalStorage loaders
const getLocal = <T>(key: string, preset: T): T => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(preset));
    return preset;
  }
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    return preset;
  }
};

const setLocal = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ==========================================
// SYSTEM AUDIT LOGGING
// ==========================================
export async function trackChange(
  employeeName: string, 
  operation: string, 
  fieldName?: string, 
  oldValue?: string, 
  newValue?: string
) {
  const newLog: ChangeHistory = {
    id: 'ch-' + Math.random().toString(36).substring(2, 9),
    date_time: new Date().toISOString(),
    employee_name: employeeName,
    operation,
    field_name: fieldName,
    old_value: oldValue,
    new_value: newValue
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('change_history').insert([newLog]);
    } catch (e) {
      console.error('Supabase trackChange failed, fallback:', e);
    }
  }

  const logs = getLocal<ChangeHistory[]>(KEY_CHANGE_HISTORY, []);
  setLocal(KEY_CHANGE_HISTORY, [newLog, ...logs]);
}

// ==========================================
// API GETTERS & SETTERS (WITH SUPABASE SYNC)
// ==========================================

// 1. Users
export async function getUsers(): Promise<User[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('is_deleted', false).order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getUsers failed', e);
    }
  }
  return getLocal<User[]>(KEY_USERS, DEFAULT_USERS).filter(item => !item.is_deleted);
}

export async function saveUser(user: User, loggerName: string): Promise<User> {
  const isNew = !user.id;
  let finalUser = { ...user };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        // Send a call to full-stack Express Admin user creation API
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) {
          throw new Error('Not authenticated on client');
        }

        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: user.email,
            password: user.password || 'Georgia2026!',
            name: user.name,
            personal_id: user.personal_id,
            phone: user.phone,
            role: user.role,
            privileges: user.privileges
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create user through secure API');
        }

        const resData = await res.json();
        if (resData.user) {
          finalUser = resData.user;
        } else {
          throw new Error('No user data returned from admin creation engine');
        }
      } else {
        // Perform direct update in profiles table
        const { error } = await supabase
          .from('profiles')
          .update({
            name: user.name,
            personal_id: user.personal_id,
            phone: user.phone,
            role: user.role,
            privileges: user.privileges
          })
          .eq('id', user.id);

        if (error) throw error;
      }
    } catch (e: any) {
      console.error('Supabase saveUser failed', e);
      throw e; // throw error so the UI displays it
    }
  } else {
    // Local storage mock mode
    finalUser = {
      ...user,
      id: isNew ? 'user-' + Math.random().toString(36).substring(2, 9) : user.id,
      created_at: user.created_at || new Date().toISOString()
    };
  }

  const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
  if (isNew) {
    setLocal(KEY_USERS, [...list, finalUser]);
    await trackChange(loggerName, 'User added', 'Name', '', finalUser.name);
  } else {
    setLocal(KEY_USERS, list.map(item => item.id === finalUser.id ? finalUser : item));
    await trackChange(loggerName, 'User updated', 'Name', '', finalUser.name);
  }
  return finalUser;
}

export async function deleteUser(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      if (!token) {
        throw new Error('Not authenticated on client');
      }

      const res = await fetch('/api/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Secure API failed to delete user');
      }
    } catch (e: any) {
      console.error('Supabase deleteUser failed', e);
      throw e;
    }
  }

  const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
  setLocal(KEY_USERS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'User deleted', 'Name', name, '');
  return true;
}

// 2. Vendors
export async function getVendors(): Promise<Vendor[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('vendors').select('*').eq('is_deleted', false).order('trade_name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getVendors failed', e);
    }
  }
  return getLocal<Vendor[]>(KEY_VENDORS, []).filter(item => !item.is_deleted);
}

export async function saveVendor(vendor: Vendor, loggerName: string): Promise<Vendor> {
  const isNew = !vendor.id;
  const finalVendor = {
    ...vendor,
    id: isNew ? 'vendor-' + Math.random().toString(36).substring(2, 9) : vendor.id,
    created_at: vendor.created_at || new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('vendors').insert([finalVendor]);
      } else {
        await supabase.from('vendors').update(finalVendor).eq('id', finalVendor.id);
      }
    } catch (e) {
      console.error('Supabase saveVendor failed', e);
    }
  }

  const list = getLocal<Vendor[]>(KEY_VENDORS, []);
  if (isNew) {
    setLocal(KEY_VENDORS, [...list, finalVendor]);
    await trackChange(loggerName, 'Vendor created', 'Trade Name', '', finalVendor.trade_name);
  } else {
    setLocal(KEY_VENDORS, list.map(item => item.id === finalVendor.id ? finalVendor : item));
    await trackChange(loggerName, 'Vendor updated', 'Trade Name', '', finalVendor.trade_name);
  }
  return finalVendor;
}

export async function deleteVendor(id: string, tradeName: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('vendors').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteVendor failed', e);
    }
  }

  const list = getLocal<Vendor[]>(KEY_VENDORS, []);
  setLocal(KEY_VENDORS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Vendor deleted', 'Trade Name', tradeName, '');
  return true;
}

// 3. Orders
export async function getOrders(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('is_deleted', false).order('order_date', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getOrders failed', e);
    }
  }
  return getLocal<Order[]>(KEY_ORDERS, []).filter(item => !item.is_deleted);
}

export async function saveOrder(order: Order, loggerName: string): Promise<Order> {
  const isNew = !order.id;
  const finalOrder = {
    ...order,
    id: isNew ? 'ord-' + Math.random().toString(36).substring(2, 9) : order.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      // Strip virtual UI helper fields before pushing to Supabase
      const { 
        vendor_name, 
        warehouse_name, 
        operator_name, 
        driver_name, 
        companion_name, 
        ...dbOrder 
      } = finalOrder as any;

      if (isNew) {
        await supabase.from('orders').insert([dbOrder]);
      } else {
        await supabase.from('orders').update(dbOrder).eq('id', dbOrder.id);
      }
    } catch (e) {
      console.error('Supabase saveOrder failed', e);
    }
  }

  const list = getLocal<Order[]>(KEY_ORDERS, []);
  if (isNew) {
    setLocal(KEY_ORDERS, [finalOrder, ...list]);
    await trackChange(loggerName, 'Order created', 'Document #', '', finalOrder.doc_number);
  } else {
    // Check if status changed to completed to trigger SMS simulation
    const oldOrder = list.find(o => o.id === finalOrder.id);
    if (oldOrder && oldOrder.status !== 'completed' && finalOrder.status === 'completed') {
      finalOrder.sms_sent = true;
      // Trigger instant simulation of SMS to accountant
      triggerSMS(finalOrder);
    }
    
    setLocal(KEY_ORDERS, list.map(item => item.id === finalOrder.id ? finalOrder : item));
    await trackChange(loggerName, 'Order updated', 'Status', oldOrder?.status || '', finalOrder.status);
  }
  return finalOrder;
}

// SMS log simulator
function triggerSMS(order: Order) {
  const logs = getLocal<any[]>('biodiesel_sms_logs', []);
  const newSMS = {
    id: 'sms-' + Math.random().toString(36).substring(2, 9),
    date_time: new Date().toISOString(),
    recipient: 'Accounting / Directors',
    message: `Biodiesel Georgia: Order doc #${order.doc_number} completed. Quantity: ${order.qty_actual || order.qty_requested} liters.`,
    status: 'Sent (Simulated)',
  };
  setLocal('biodiesel_sms_logs', [newSMS, ...logs]);
}

export async function getSMSLogs(): Promise<any[]> {
  return getLocal<any[]>('biodiesel_sms_logs', []);
}

export async function deleteOrder(id: string, docNum: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('orders').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteOrder failed', e);
    }
  }

  const list = getLocal<Order[]>(KEY_ORDERS, []);
  setLocal(KEY_ORDERS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Order deleted', 'Document #', docNum, '');
  return true;
}

// 4. Communications
export async function getCommunications(): Promise<Communication[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('communications').select('*').eq('is_deleted', false).order('date_time', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getCommunications failed', e);
    }
  }
  return getLocal<Communication[]>(KEY_COMMUNICATIONS, []).filter(item => !item.is_deleted);
}

export async function saveCommunication(comm: Communication, loggerName: string): Promise<Communication> {
  const isNew = !comm.id;
  const finalComm = {
    ...comm,
    id: isNew ? 'comm-' + Math.random().toString(36).substring(2, 9) : comm.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      // Strip virtual UI helper fields before pushing to Supabase
      const { 
        vendor_name, 
        user_name, 
        vendor_contact_name, 
        ...dbComm 
      } = finalComm as any;

      if (isNew) {
        await supabase.from('communications').insert([dbComm]);
      } else {
        await supabase.from('communications').update(dbComm).eq('id', dbComm.id);
      }
    } catch (e) {
      console.error('Supabase saveCommunication failed', e);
    }
  }

  const list = getLocal<Communication[]>(KEY_COMMUNICATIONS, []);
  if (isNew) {
    setLocal(KEY_COMMUNICATIONS, [finalComm, ...list]);
    await trackChange(loggerName, 'Communication logged', 'Comment', '', finalComm.comment);
  } else {
    setLocal(KEY_COMMUNICATIONS, list.map(item => item.id === finalComm.id ? finalComm : item));
    await trackChange(loggerName, 'Communication updated', 'Comment', '', finalComm.comment);
  }
  return finalComm;
}

export async function deleteCommunication(id: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('communications').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteCommunication failed', e);
    }
  }

  const list = getLocal<Communication[]>(KEY_COMMUNICATIONS, []);
  setLocal(KEY_COMMUNICATIONS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Communication deleted', 'ID', id, '');
  return true;
}

// 5. Trucks
export async function getTrucks(): Promise<Truck[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('trucks').select('*').eq('is_deleted', false).order('plate_number');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getTrucks failed', e);
    }
  }
  return getLocal<Truck[]>(KEY_TRUCKS, DEFAULT_TRUCKS).filter(item => !item.is_deleted);
}

export async function saveTruck(truck: Truck, loggerName: string): Promise<Truck> {
  const list = getLocal<Truck[]>(KEY_TRUCKS, DEFAULT_TRUCKS);
  const exists = list.some(t => t.plate_number === truck.plate_number);

  if (isSupabaseConfigured && supabase) {
    try {
      if (!exists) {
        await supabase.from('trucks').insert([truck]);
      } else {
        await supabase.from('trucks').update(truck).eq('plate_number', truck.plate_number);
      }
    } catch (e) {
      console.error('Supabase saveTruck failed', e);
    }
  }

  if (!exists) {
    setLocal(KEY_TRUCKS, [...list, truck]);
    await trackChange(loggerName, 'Truck added', 'Plate Number', '', truck.plate_number);
  } else {
    setLocal(KEY_TRUCKS, list.map(item => item.plate_number === truck.plate_number ? truck : item));
    await trackChange(loggerName, 'Truck updated', 'Model', '', truck.model);
  }
  return truck;
}

export async function deleteTruck(plate: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('trucks').update({ is_deleted: true }).eq('plate_number', plate);
    } catch (e) {
      console.error('Supabase deleteTruck failed', e);
    }
  }

  const list = getLocal<Truck[]>(KEY_TRUCKS, DEFAULT_TRUCKS);
  setLocal(KEY_TRUCKS, list.map(item => item.plate_number === plate ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Truck deleted', 'Plate Number', plate, '');
  return true;
}

// 6. Change History
export async function getChangeHistory(): Promise<ChangeHistory[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('change_history').select('*').order('date_time', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getChangeHistory failed', e);
    }
  }
  return getLocal<ChangeHistory[]>(KEY_CHANGE_HISTORY, []);
}

// 7. Warehouses
export async function getWarehouses(): Promise<Warehouse[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('warehouses').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getWarehouses failed', e);
    }
  }
  return getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
}

export async function saveWarehouse(wh: Warehouse, loggerName: string): Promise<Warehouse> {
  const isNew = !wh.id;
  const finalWh = {
    ...wh,
    id: isNew ? 'wh-' + Math.random().toString(36).substring(2, 9) : wh.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('warehouses').insert([finalWh]);
      } else {
        await supabase.from('warehouses').update(finalWh).eq('id', finalWh.id);
      }
    } catch (e) {
      console.error('Supabase saveWarehouse failed', e);
    }
  }

  const list = getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
  if (isNew) {
    setLocal(KEY_WAREHOUSES, [...list, finalWh]);
    await trackChange(loggerName, 'Warehouse added', 'Name', '', finalWh.name);
  } else {
    setLocal(KEY_WAREHOUSES, list.map(item => item.id === finalWh.id ? finalWh : item));
    await trackChange(loggerName, 'Warehouse updated', 'Name', '', finalWh.name);
  }
  return finalWh;
}

export async function deleteWarehouse(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('warehouses').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteWarehouse failed', e);
    }
  }

  const list = getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
  setLocal(KEY_WAREHOUSES, list.filter(item => item.id !== id));
  await trackChange(loggerName, 'Warehouse deleted', 'Name', name, '');
  return true;
}

// 8. Cities
export async function getCities(): Promise<City[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('cities').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getCities failed', e);
    }
  }
  return getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
}

export async function saveCity(city: City, loggerName: string): Promise<City> {
  const isNew = !city.id;
  const finalCity = {
    ...city,
    id: isNew ? 'city-' + Math.random().toString(36).substring(2, 9) : city.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('cities').insert([finalCity]);
      } else {
        await supabase.from('cities').update(finalCity).eq('id', finalCity.id);
      }
    } catch (e) {
      console.error('Supabase saveCity failed', e);
    }
  }

  const list = getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
  if (isNew) {
    setLocal(KEY_CITIES, [...list, finalCity]);
    await trackChange(loggerName, 'City added', 'Name', '', finalCity.name);
  } else {
    setLocal(KEY_CITIES, list.map(item => item.id === finalCity.id ? finalCity : item));
    await trackChange(loggerName, 'City updated', 'Name', '', finalCity.name);
  }
  return finalCity;
}

export async function deleteCity(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('cities').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteCity failed', e);
    }
  }

  const list = getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
  setLocal(KEY_CITIES, list.filter(item => item.id !== id));
  await trackChange(loggerName, 'City deleted', 'Name', name, '');
  return true;
}

// 9. Districts
export async function getDistricts(): Promise<District[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('districts').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getDistricts failed', e);
    }
  }
  return getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
}

export async function saveDistrict(dist: District, loggerName: string): Promise<District> {
  const isNew = !dist.id;
  const finalDist = {
    ...dist,
    id: isNew ? 'dist-' + Math.random().toString(36).substring(2, 9) : dist.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('districts').insert([finalDist]);
      } else {
        await supabase.from('districts').update(finalDist).eq('id', finalDist.id);
      }
    } catch (e) {
      console.error('Supabase saveDistrict failed', e);
    }
  }

  const list = getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
  if (isNew) {
    setLocal(KEY_DISTRICTS, [...list, finalDist]);
    await trackChange(loggerName, 'District added', 'Name', '', finalDist.name);
  } else {
    setLocal(KEY_DISTRICTS, list.map(item => item.id === finalDist.id ? finalDist : item));
    await trackChange(loggerName, 'District updated', 'Name', '', finalDist.name);
  }
  return finalDist;
}

export async function deleteDistrict(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('districts').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteDistrict failed', e);
    }
  }

  const list = getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
  setLocal(KEY_DISTRICTS, list.filter(item => item.id !== id));
  await trackChange(loggerName, 'District deleted', 'Name', name, '');
  return true;
}

// 10. REVERT/ROLLBACK UTILITY
export async function revertChange(log: ChangeHistory, loggerName: string): Promise<boolean> {
  const op = log.operation.toLowerCase();
  
  try {
    // 1. USER REVERTS
    if (op.includes('user')) {
      const list = getLocal<User[]>(KEY_USERS, DEFAULT_USERS);
      if (op.includes('added') || op.includes('created')) {
        const user = list.find(u => u.name === log.new_value && !u.is_deleted);
        if (user) {
          await deleteUser(user.id, user.name, loggerName);
        }
      } else if (op.includes('deleted')) {
        const user = list.find(u => u.name === log.old_value && u.is_deleted);
        if (user) {
          user.is_deleted = false;
          if (isSupabaseConfigured && supabase) {
            await supabase.from('profiles').update({ is_deleted: false }).eq('id', user.id);
          }
          setLocal(KEY_USERS, list.map(u => u.id === user.id ? user : u));
          await trackChange(loggerName, 'User restored', 'Name', '', user.name);
        }
      } else if (op.includes('updated')) {
        const user = list.find(u => u.name === log.new_value && !u.is_deleted) || list.find(u => u.name === log.old_value && !u.is_deleted);
        if (user) {
          const field = log.field_name || 'Name';
          if (field === 'Name') user.name = log.old_value || user.name;
          if (field === 'Role') user.role = (log.old_value as any) || user.role;
          if (field === 'Phone') user.phone = log.old_value || user.phone;
          
          if (isSupabaseConfigured && supabase) {
            await supabase.from('profiles').update({
              name: user.name,
              role: user.role,
              phone: user.phone
            }).eq('id', user.id);
          }
          setLocal(KEY_USERS, list.map(u => u.id === user.id ? user : u));
          await trackChange(loggerName, 'User update reverted', field, log.new_value, log.old_value);
        }
      }
    }
    
    // 2. VENDOR REVERTS
    else if (op.includes('vendor') || op.includes('supplier')) {
      const list = getLocal<Vendor[]>(KEY_VENDORS, []);
      if (op.includes('added') || op.includes('created')) {
        const vendor = list.find(v => v.trade_name === log.new_value && !v.is_deleted);
        if (vendor) {
          await deleteVendor(vendor.id, vendor.trade_name, loggerName);
        }
      } else if (op.includes('deleted')) {
        const vendor = list.find(v => v.trade_name === log.old_value && v.is_deleted);
        if (vendor) {
          vendor.is_deleted = false;
          if (isSupabaseConfigured && supabase) {
            await supabase.from('vendors').update({ is_deleted: false }).eq('id', vendor.id);
          }
          setLocal(KEY_VENDORS, list.map(v => v.id === vendor.id ? vendor : v));
          await trackChange(loggerName, 'Vendor restored', 'Trade Name', '', vendor.trade_name);
        }
      } else if (op.includes('updated')) {
        const vendor = list.find(v => v.trade_name === log.new_value && !v.is_deleted) || list.find(v => v.trade_name === log.old_value && !v.is_deleted);
        if (vendor) {
          const field = log.field_name || 'Trade Name';
          if (field === 'Trade Name') vendor.trade_name = log.old_value || vendor.trade_name;
          if (field === 'Price' || field === 'Price per Liter' || field === 'Price Per Liter') vendor.price_per_liter = Number(log.old_value) || vendor.price_per_liter;
          if (field === 'Bank Account') vendor.bank_account = log.old_value || vendor.bank_account;
          
          if (isSupabaseConfigured && supabase) {
            await supabase.from('vendors').update(vendor).eq('id', vendor.id);
          }
          setLocal(KEY_VENDORS, list.map(v => v.id === vendor.id ? vendor : v));
          await trackChange(loggerName, 'Vendor update reverted', field, log.new_value, log.old_value);
        }
      }
    }
    
    // 3. ORDER REVERTS
    else if (op.includes('order')) {
      const list = getLocal<Order[]>(KEY_ORDERS, []);
      if (op.includes('added') || op.includes('created')) {
        const order = list.find(o => o.doc_number === log.new_value && !o.is_deleted);
        if (order) {
          await deleteOrder(order.id, order.doc_number, loggerName);
        }
      } else if (op.includes('deleted')) {
        const order = list.find(o => o.doc_number === log.old_value && o.is_deleted);
        if (order) {
          order.is_deleted = false;
          if (isSupabaseConfigured && supabase) {
            await supabase.from('orders').update({ is_deleted: false }).eq('id', order.id);
          }
          setLocal(KEY_ORDERS, list.map(o => o.id === order.id ? order : o));
          await trackChange(loggerName, 'Order restored', 'Document #', '', order.doc_number);
        }
      } else if (op.includes('updated')) {
        const order = list.find(o => o.doc_number === log.new_value && !o.is_deleted) || list.find(o => o.doc_number === log.old_value && !o.is_deleted);
        if (order) {
          const field = log.field_name || 'Status';
          if (field === 'Status') order.status = (log.old_value as any) || order.status;
          
          if (isSupabaseConfigured && supabase) {
            await supabase.from('orders').update({ status: order.status }).eq('id', order.id);
          }
          setLocal(KEY_ORDERS, list.map(o => o.id === order.id ? order : o));
          await trackChange(loggerName, 'Order update reverted', field, log.new_value, log.old_value);
        }
      }
    }
  
    // 4. TRUCK REVERTS
    else if (op.includes('truck')) {
      const list = getLocal<Truck[]>(KEY_TRUCKS, DEFAULT_TRUCKS);
      if (op.includes('added') || op.includes('created')) {
        const truck = list.find(t => t.plate_number === log.new_value && !t.is_deleted);
        if (truck) {
          await deleteTruck(truck.plate_number, loggerName);
        }
      } else if (op.includes('deleted')) {
        const truck = list.find(t => t.plate_number === log.old_value && t.is_deleted);
        if (truck) {
          truck.is_deleted = false;
          if (isSupabaseConfigured && supabase) {
            await supabase.from('trucks').update({ is_deleted: false }).eq('plate_number', truck.plate_number);
          }
          setLocal(KEY_TRUCKS, list.map(t => t.plate_number === truck.plate_number ? truck : t));
          await trackChange(loggerName, 'Truck restored', 'Plate Number', '', truck.plate_number);
        }
      }
    }
  
    // 5. OTHER UTILITIES (Warehouses, Cities, Districts)
    else if (op.includes('warehouse')) {
      const list = getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
      if (op.includes('added') || op.includes('created')) {
        const entry = list.find(w => w.name === log.new_value);
        if (entry) {
          await deleteWarehouse(entry.id, entry.name, loggerName);
        }
      }
    } else if (op.includes('city')) {
      const list = getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
      if (op.includes('added') || op.includes('created')) {
        const entry = list.find(c => c.name === log.new_value);
        if (entry) {
          await deleteCity(entry.id, entry.name, loggerName);
        }
      }
    } else if (op.includes('district')) {
      const list = getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
      if (op.includes('added') || op.includes('created')) {
        const entry = list.find(d => d.name === log.new_value);
        if (entry) {
          await deleteDistrict(entry.id, entry.name, loggerName);
        }
      }
    }
  } catch (e) {
    console.error('Failed to revert change:', e);
    return false;
  }
  return true;
}

// 11. SYSTEM RESET
export function resetSystemDatabase() {
  localStorage.removeItem(KEY_USERS);
  localStorage.removeItem(KEY_VENDORS);
  localStorage.removeItem(KEY_ORDERS);
  localStorage.removeItem(KEY_COMMUNICATIONS);
  localStorage.removeItem(KEY_TRUCKS);
  localStorage.removeItem(KEY_CHANGE_HISTORY);
  localStorage.removeItem(KEY_WAREHOUSES);
  localStorage.removeItem(KEY_CITIES);
  localStorage.removeItem(KEY_DISTRICTS);
  localStorage.removeItem('biodiesel_sms_logs');
  localStorage.removeItem('biodiesel_notifications');
}
