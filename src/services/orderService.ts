import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Order, Vendor } from '../types';
import { trackChange } from './historyService';
import { KEY_ORDERS, getLocal, setLocal } from './localStorage';
import { notifyDbChange } from '../lib/realtime';
import { appCache } from '../utils/cache';
import { sanitizePostgrestSearchTerm } from '../utils/sanitize';
import { generateUuid, cleanUserUuid } from './vendorService';

export { KEY_ORDERS };

export interface PaginatedOrdersResult {
  orders: Order[];
  totalCount: number;
}

export async function getOrdersPaginated(
  limit: number = 12,
  offset: number = 0,
  filters?: {
    searchTerm?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    city?: string;
    district?: string;
    direction?: string;
    directionId?: string;
    vehicle?: string;
    vehicleId?: string;
    driverId?: string;
    vendorId?: string;
  }
): Promise<PaginatedOrdersResult> {
  const filterKey = JSON.stringify(filters || {});
  const countCacheKey = `count_orders_${filterKey}`;
  const pageCacheKey = `orders_limit_${limit}_offset_${offset}_${filterKey}`;

  const cachedPage = appCache.get<PaginatedOrdersResult>(pageCacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const cachedCount = appCache.get<number>(countCacheKey);

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('orders')
        .select('*', cachedCount !== null ? {} : { count: 'exact' })
        .eq('is_deleted', false);

      const safeTerm = sanitizePostgrestSearchTerm(filters?.searchTerm);
      if (safeTerm) {
        const term = `%${safeTerm}%`;
        
        // Find matching vendor IDs by trade_name or company_name
        let matchedVendorIds: string[] = [];
        try {
          const { data: matchedVendors } = await supabase
            .from('vendors')
            .select('id')
            .or(`trade_name.ilike.${term},company_name.ilike.${term}`)
            .eq('is_deleted', false);

          matchedVendorIds = (matchedVendors || []).map(v => v.id);
        } catch (mErr) {
          console.warn('Matching vendors search error:', mErr);
        }

        if (matchedVendorIds.length > 0) {
          query = query.or(`doc_number.ilike.${term},vendor_id.in.(${matchedVendorIds.join(',')})`);
        } else {
          query = query.ilike('doc_number', term);
        }
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('order_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('order_date', filters.endDate + 'T23:59:59');
      }

      // If filtering by location / direction (properties on vendors table)
      const targetCity = filters?.city;
      const targetDistrict = filters?.district;
      const targetDirection = filters?.direction || filters?.directionId;
      if (targetCity || targetDistrict || targetDirection) {
        let vQuery = supabase.from('vendors').select('id').eq('is_deleted', false);
        if (targetCity) vQuery = vQuery.eq('city', targetCity);
        if (targetDistrict) vQuery = vQuery.eq('district', targetDistrict);
        if (targetDirection) vQuery = vQuery.eq('direction_id', targetDirection);
        const { data: vList } = await vQuery;
        const vIds = (vList || []).map(v => v.id);
        if (vIds.length > 0) {
          query = query.in('vendor_id', vIds);
        } else {
          // No vendors match criteria
          return { orders: [], totalCount: 0 };
        }
      }

      const vehicleVal = filters?.vehicle || filters?.vehicleId;
      if (vehicleVal) {
        query = query.eq('vehicle_id', vehicleVal);
      }
      if (filters?.driverId) {
        query = query.eq('driver_id', filters.driverId);
      }
      if (filters?.vendorId) {
        query = query.eq('vendor_id', filters.vendorId);
      }

      query = query.order('order_date', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) {
        if (error.code === 'PGRST103' || error.message?.toLowerCase().includes('satisfiable')) {
          return { orders: [], totalCount: cachedCount || 0 };
        }
        console.error('Supabase getOrdersPaginated error', error);
      }

      if (!error && data) {
        const finalCount = cachedCount !== null ? cachedCount : (count || 0);
        if (cachedCount === null && count !== null) {
          appCache.set(countCacheKey, count);
        }

        // Fetch vendor info for all vendor_ids present on this page (even if soft-deleted/duplicated)
        const vendorIds = Array.from(new Set((data as any[]).map(item => item.vendor_id).filter(Boolean)));
        const vendorMap = new Map<string, any>();
        if (vendorIds.length > 0) {
          try {
            const { data: vendorsData } = await supabase
              .from('vendors')
              .select('id, trade_name, company_name, id_code, address, city, district, direction_id')
              .in('id', vendorIds);
            if (vendorsData) {
              vendorsData.forEach(v => {
                vendorMap.set(v.id, v);
                if (v.id) {
                  vendorMap.set(v.id.toLowerCase().trim(), v);
                }
              });
            }
          } catch (vErr) {
            console.warn('Failed to prefetch vendors for orders page:', vErr);
          }
        }

        const mapped = data.map((o: any) => {
          const v = o.vendor_id ? (vendorMap.get(o.vendor_id) || vendorMap.get(o.vendor_id?.toLowerCase?.().trim())) : null;
          return {
            ...o,
            vendor_name: o.vendor_name || v?.trade_name || v?.company_name || '',
            notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
          };
        });
        const result = {
          orders: mapped,
          totalCount: finalCount
        };
        appCache.set(pageCacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('Supabase getOrdersPaginated failed', e);
    }
  }

  // Local fallback
  const all = getLocal<Order[]>(KEY_ORDERS, []).filter(item => !item.is_deleted).map((o: any) => ({
    ...o,
    notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
  }));

  const localVendors = getLocal<Vendor[]>('biodiesel_vendors', []);
  const vendorMap = new Map(localVendors.map(v => [v.id, v]));

  let filtered = all;
  if (filters?.searchTerm?.trim()) {
    const term = filters.searchTerm.trim().toLowerCase();
    filtered = filtered.filter(o => {
      const docMatch = (o.doc_number || '').toLowerCase().includes(term);
      const vObj = vendorMap.get(o.vendor_id);
      const tradeMatch = (vObj?.trade_name || o.vendor_name || '').toLowerCase().includes(term);
      const companyMatch = (vObj?.company_name || '').toLowerCase().includes(term);
      return docMatch || tradeMatch || companyMatch;
    });
  }
  if (filters?.status) {
    filtered = filtered.filter(o => o.status === filters.status);
  }
  if (filters?.driverId) {
    filtered = filtered.filter(o => o.driver_id === filters.driverId);
  }
  if (filters?.vendorId) {
    filtered = filtered.filter(o => o.vendor_id === filters.vendorId);
  }
  const vehicleVal = filters?.vehicle || filters?.vehicleId;
  if (vehicleVal) {
    filtered = filtered.filter(o => o.vehicle_id === vehicleVal || o.truck_plate === vehicleVal);
  }

  return {
    orders: filtered.slice(offset, offset + limit),
    totalCount: filtered.length
  };
}

export async function getOrders(): Promise<Order[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('is_deleted', false).order('order_date', { ascending: false });
      if (!error && data) {
        return data.map((o: any) => ({
          ...o,
          notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
        }));
      }
    } catch (e) {
      console.warn('Supabase getOrders failed', e);
    }
  }
  return getLocal<Order[]>(KEY_ORDERS, []).filter(item => !item.is_deleted).map((o: any) => ({
    ...o,
    notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
  }));
}

export async function saveOrder(order: Order, loggerName: string, currentUserId?: string): Promise<Order> {
  const isNew = !order.id;

  const createdByUuid = cleanUserUuid(isNew ? (currentUserId || order.created_by) : order.created_by);

  const finalOrder = {
    ...order,
    id: isNew ? (order.id || generateUuid()) : order.id,
    operator_id: cleanUserUuid(order.operator_id),
    created_by: createdByUuid,
    driver_id: cleanUserUuid(order.driver_id),
    companion_id: cleanUserUuid(order.companion_id),
    notes: Array.isArray(order.notes) ? order.notes : (order.note ? [{ id: 'c-1', comment: order.note, date: new Date().toISOString(), user_name: 'System' }] : [])
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const isValidUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      // Whitelist only columns that exist in the Supabase `orders` table schema
      const dbOrder: Record<string, any> = {
        id: finalOrder.id,
        order_date: finalOrder.order_date || new Date().toISOString(),
        doc_number: finalOrder.doc_number,
        vendor_id: finalOrder.vendor_id,
        warehouse_id: finalOrder.warehouse_id || null,
        qty_requested: finalOrder.qty_requested ?? null,
        tanks_to_leave: Number(finalOrder.tanks_to_leave) || 0,
        tanks_to_bring: Number(finalOrder.tanks_to_bring) || 0,
        pickup_date_time: finalOrder.pickup_date_time || null,
        operator_id: isValidUuid(finalOrder.operator_id) ? finalOrder.operator_id : null,
        created_by: isValidUuid(finalOrder.created_by) ? finalOrder.created_by : null,
        driver_id: isValidUuid(finalOrder.driver_id) ? finalOrder.driver_id : null,
        companion_id: isValidUuid(finalOrder.companion_id) ? finalOrder.companion_id : null,
        vehicle_id: isValidUuid(finalOrder.vehicle_id) ? finalOrder.vehicle_id : null,
        fact_qty: Number(finalOrder.fact_qty) || 0,
        fact_tank_dropoff: Number(finalOrder.fact_tank_dropoff) || 0,
        fact_tank_pickup: Number(finalOrder.fact_tank_pickup) || 0,
        waybill_qty: Number(finalOrder.waybill_qty) || 0,
        status: finalOrder.status || 'registered',
        sms_sent: Boolean(finalOrder.sms_sent),
        is_deleted: Boolean(finalOrder.is_deleted),
        contact_id: finalOrder.contact_id || null,
        notes: Array.isArray(finalOrder.notes) ? finalOrder.notes : []
      };

      if (isNew) {
        const { error } = await supabase.from('orders').insert([dbOrder]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('orders').update(dbOrder).eq('id', dbOrder.id);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Supabase saveOrder failed', e);
      throw e; // Propagate the error to show in UI
    }
  }

  appCache.clear();

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

  notifyDbChange('orders', isNew ? 'CREATE' : 'UPDATE', finalOrder.id);
  return finalOrder;
}

// SMS log simulator
function triggerSMS(order: Order) {
  const logs = getLocal<any[]>('biodiesel_sms_logs', []);
  const newSMS = {
    id: 'sms-' + Math.random().toString(36).substring(2, 9),
    date_time: new Date().toISOString(),
    recipient: 'Accounting / Directors',
    message: `Biodiesel Georgia: Order doc #${order.doc_number} completed. Quantity: ${order.fact_qty || order.qty_requested} liters.`,
    status: 'Sent (Simulated)',
  };
  setLocal('biodiesel_sms_logs', [newSMS, ...logs]);
}

export async function getSMSLogs(): Promise<any[]> {
  return getLocal<any[]>('biodiesel_sms_logs', []);
}

export async function createDatabaseOrderColumn(columnName: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      console.log('Provisioning order custom column via RPC:', columnName);
      const { error } = await supabase.rpc('add_custom_column_to_orders', { column_name: columnName, column_type: 'TEXT' });
      if (error) {
        console.error('Database column provisioning RPC error:', error);
      } else {
        console.log('Successfully completed dynamic database column RPC for:', columnName);
      }
    } catch (e) {
      console.error('Dynamic column creation exception:', e);
    }
  }
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
  notifyDbChange('orders', 'DELETE', id);
  return true;
}
