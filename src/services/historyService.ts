import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ChangeHistory, User, Vendor, Order, Vehicle, Warehouse, City, District } from '../types';
import { KEY_CHANGE_HISTORY, getLocal, setLocal } from './localStorage';
import { appCache } from '../utils/cache';

// We import services for revert operations
import { deleteUser } from './userService';
import { deleteVendor } from './vendorService';
import { deleteOrder } from './orderService';
import { deleteVehicle } from './vehicleService';
import { deleteWarehouse, deleteCity, deleteDistrict } from './lookupService';

export async function trackChange(
  employeeName: string, 
  operation: string, 
  fieldName?: string, 
  oldValue?: string, 
  newValue?: string
) {
  appCache.clear('history_');
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

export async function getChangeHistory(limit: number = 50, offset: number = 0): Promise<ChangeHistory[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('change_history')
        .select('*')
        .order('date_time', { ascending: false })
        .range(offset, offset + limit - 1);
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getChangeHistory failed', e);
    }
  }
  return getLocal<ChangeHistory[]>(KEY_CHANGE_HISTORY, []);
}

export interface PaginatedHistoryResult {
  logs: ChangeHistory[];
  totalCount: number;
}

export async function getChangeHistoryPaginated(
  limit: number = 15,
  offset: number = 0,
  startDate?: string,
  endDate?: string,
  searchTerm?: string,
  selectedUser?: string,
  selectedOperation?: string,
  selectedField?: string
): Promise<PaginatedHistoryResult> {
  const cacheKey = `history_limit_${limit}_offset_${offset}_start_${startDate || ''}_end_${endDate || ''}_search_${searchTerm || ''}_user_${selectedUser || ''}_op_${selectedOperation || ''}_field_${selectedField || ''}`;
  const cached = appCache.get<PaginatedHistoryResult>(cacheKey);
  if (cached) {
    return cached;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('change_history')
        .select('*', { count: 'exact' });

      if (startDate) {
        const startISO = new Date(startDate);
        startISO.setHours(0, 0, 0, 0);
        query = query.gte('date_time', startISO.toISOString());
      }
      if (endDate) {
        const endISO = new Date(endDate);
        endISO.setHours(23, 59, 59, 999);
        query = query.lte('date_time', endISO.toISOString());
      }

      if (selectedUser) {
        query = query.eq('employee_name', selectedUser);
      }
      if (selectedOperation) {
        query = query.eq('operation', selectedOperation);
      }
      if (selectedField) {
        query = query.eq('field_name', selectedField);
      }

      if (searchTerm && searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        query = query.or(`employee_name.ilike.${term},operation.ilike.${term},field_name.ilike.${term},old_value.ilike.${term},new_value.ilike.${term}`);
      }

      query = query
        .order('date_time', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (!error && data) {
        const result = {
          logs: data as ChangeHistory[],
          totalCount: count || 0
        };
        appCache.set(cacheKey, result);
        return result;
      } else if (error) {
        console.error('Supabase getChangeHistoryPaginated error', error);
      }
    } catch (e) {
      console.warn('Supabase getChangeHistoryPaginated failed', e);
    }
  }

  // Local fallback
  const allLogs = getLocal<ChangeHistory[]>(KEY_CHANGE_HISTORY, []);
  const filtered = allLogs.filter(log => {
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const logDate = new Date(log.date_time);
      if (logDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const logDate = new Date(log.date_time);
      if (logDate > end) return false;
    }
    if (selectedUser && log.employee_name !== selectedUser) return false;
    if (selectedOperation && log.operation !== selectedOperation) return false;
    if (selectedField && log.field_name !== selectedField) return false;

    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchUser = log.employee_name?.toLowerCase().includes(term);
      const matchOp = log.operation?.toLowerCase().includes(term);
      const matchField = log.field_name?.toLowerCase().includes(term);
      const matchOld = log.old_value?.toLowerCase().includes(term);
      const matchNew = log.new_value?.toLowerCase().includes(term);
      if (!matchUser && !matchOp && !matchField && !matchOld && !matchNew) {
        return false;
      }
    }
    return true;
  });

  filtered.sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());

  const paginated = filtered.slice(offset, offset + limit);
  const result = {
    logs: paginated,
    totalCount: filtered.length
  };
  appCache.set(cacheKey, result);
  return result;
}

export async function revertChange(log: ChangeHistory, loggerName: string): Promise<boolean> {
  appCache.clear('history_');
  const op = log.operation.toLowerCase();
  
  try {
    // 1. USER REVERTS
    if (op.includes('user')) {
      const { KEY_USERS, DEFAULT_USERS } = await import('./userService');
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
      const { KEY_VENDORS } = await import('./vendorService');
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
            const { cleanVendorDbPayload } = await import('./vendorService');
            const cleanDbPayload = cleanVendorDbPayload(vendor);
            await supabase.from('vendors').update(cleanDbPayload).eq('id', vendor.id);
          }
          setLocal(KEY_VENDORS, list.map(v => v.id === vendor.id ? vendor : v));
          await trackChange(loggerName, 'Vendor update reverted', field, log.new_value, log.old_value);
        }
      }
    }
    
    // 3. ORDER REVERTS
    else if (op.includes('order')) {
      const { KEY_ORDERS } = await import('./orderService');
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
  
    // 4. VEHICLE REVERTS
    else if (op.includes('truck') || op.includes('vehicle')) {
      const { KEY_VEHICLES, deleteVehicle } = await import('./vehicleService');
      const list = getLocal<Vehicle[]>(KEY_VEHICLES, []);
      if (op.includes('added') || op.includes('created') || op.includes('Vehicle added')) {
        const vehicle = list.find(v => v.plate_number === log.new_value && !v.is_deleted);
        if (vehicle) {
          await deleteVehicle(vehicle.plate_number, loggerName);
        }
      } else if (op.includes('deleted')) {
        const vehicle = list.find(v => v.plate_number === log.old_value && v.is_deleted);
        if (vehicle) {
          vehicle.is_deleted = false;
          if (isSupabaseConfigured && supabase) {
            try {
              await supabase.from('vehicles').update({ is_deleted: true }).eq('plate_number', vehicle.plate_number);
            } catch (err) {
              await supabase.from('trucks').update({ is_deleted: true }).eq('plate_number', vehicle.plate_number);
            }
          }
          setLocal(KEY_VEHICLES, list.map(v => v.plate_number === vehicle.plate_number ? vehicle : v));
          await trackChange(loggerName, 'Vehicle restored', 'Plate Number', '', vehicle.plate_number);
        }
      }
    }
  
    // 5. OTHER UTILITIES (Warehouses, Cities, Districts)
    else if (op.includes('warehouse')) {
      const { KEY_WAREHOUSES, DEFAULT_WAREHOUSES } = await import('./lookupService');
      const list = getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
      if (op.includes('added') || op.includes('created')) {
        const entry = list.find(w => w.name === log.new_value);
        if (entry) {
          await deleteWarehouse(entry.id, entry.name, loggerName);
        }
      }
    } else if (op.includes('city')) {
      const { KEY_CITIES, DEFAULT_CITIES } = await import('./lookupService');
      const list = getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
      if (op.includes('added') || op.includes('created')) {
        const entry = list.find(c => c.name === log.new_value);
        if (entry) {
          await deleteCity(entry.id, entry.name, loggerName);
        }
      }
    } else if (op.includes('district')) {
      const { KEY_DISTRICTS, DEFAULT_DISTRICTS } = await import('./lookupService');
      const list = getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
      if (op.includes('added') || op.includes('created')) {
        const entry = list.find(d => d.name === log.new_value);
        if (entry) {
          await deleteDistrict(entry.id, entry.name, loggerName);
        }
      }
    }

    // Mark the log as reverted in local storage
    const historyList = getLocal<ChangeHistory[]>(KEY_CHANGE_HISTORY, []);
    const updatedHistory = historyList.map(item => item.id === log.id ? { ...item, is_reverted: true } : item);
    setLocal(KEY_CHANGE_HISTORY, updatedHistory);

    // Sync to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('change_history').update({ is_reverted: true }).eq('id', log.id);
      } catch (err) {
        console.warn('Could not update change_history column is_reverted, fallback ok:', err);
      }
    }
  } catch (e) {
    console.error('Failed to revert change:', e);
    return false;
  }
  return true;
}

export interface UniqueFiltersResult {
  users: string[];
  operations: string[];
  fields: string[];
}

export async function getUniqueHistoryFilters(): Promise<UniqueFiltersResult> {
  const cacheKey = 'history_unique_filters';
  const cached = appCache.get<UniqueFiltersResult>(cacheKey);
  if (cached) return cached;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('change_history')
        .select('employee_name, operation, field_name');
      if (!error && data) {
        const users = Array.from(new Set(data.map(d => d.employee_name).filter(Boolean))).sort() as string[];
        const operations = Array.from(new Set(data.map(d => d.operation).filter(Boolean))).sort() as string[];
        const fields = Array.from(new Set(data.map(d => d.field_name).filter(Boolean))).sort() as string[];
        const result = { users, operations, fields };
        appCache.set(cacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('Failed to fetch unique history filters', e);
    }
  }

  // Local fallback
  const allLogs = getLocal<ChangeHistory[]>(KEY_CHANGE_HISTORY, []);
  const users = Array.from(new Set(allLogs.map(d => d.employee_name).filter(Boolean))).sort();
  const operations = Array.from(new Set(allLogs.map(d => d.operation).filter(Boolean))).sort();
  const fields = Array.from(new Set(allLogs.map(d => d.field_name).filter(Boolean))).sort();
  const result = { users, operations, fields };
  appCache.set(cacheKey, result);
  return result;
}

