import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Order } from '../../types';
import { trackChange } from '../historyService';
import { KEY_ORDERS, getLocal, setLocal } from '../localStorage';
import { notifyDbChange } from '../../lib/realtime';
import { appCache } from '../../utils/cache';
import { generateUuid, cleanUserUuid } from '../vendorService';
import { isValidUuid } from './orderUtils';

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
      const normalizeOrderDate = (dateVal?: string | null) => {
        if (!dateVal) return new Date().toISOString();
        if (typeof dateVal === 'string' && !dateVal.includes('Z') && !dateVal.includes('+') && !/-\d\d:\d\d$/.test(dateVal)) {
          if (dateVal.includes('T')) {
            const [datePart, timePart] = dateVal.split('T');
            const [y, m, day] = datePart.split('-').map(Number);
            const [h, min] = (timePart || '00:00').split(':').map(Number);
            const local = new Date(y, (m || 1) - 1, day || 1, h || 0, min || 0);
            return !isNaN(local.getTime()) ? local.toISOString() : dateVal;
          } else {
            const [y, m, day] = dateVal.split('-').map(Number);
            const local = new Date(y, (m || 1) - 1, day || 1, 0, 0);
            return !isNaN(local.getTime()) ? local.toISOString() : dateVal;
          }
        }
        const d = new Date(dateVal);
        return !isNaN(d.getTime()) ? d.toISOString() : dateVal;
      };

      const normalizedOrderDate = normalizeOrderDate(finalOrder.order_date);
      finalOrder.order_date = normalizedOrderDate;

      const completionTimestamp = finalOrder.status === 'completed'
        ? (finalOrder.completed_at ? normalizeOrderDate(finalOrder.completed_at) : new Date().toISOString())
        : null;
      finalOrder.completed_at = completionTimestamp;

      // Whitelist only columns that exist in the Supabase `orders` table schema
      const dbOrder: Record<string, any> = {
        id: finalOrder.id,
        order_date: normalizedOrderDate,
        doc_number: finalOrder.doc_number,
        vendor_id: finalOrder.vendor_id,
        warehouse_id: finalOrder.warehouse_id || null,
        qty_requested: finalOrder.qty_requested ?? null,
        tanks_to_leave: Number(finalOrder.tanks_to_leave) || 0,
        tanks_to_bring: Number(finalOrder.tanks_to_bring) || 0,
        pickup_date_time: finalOrder.pickup_date_time ? normalizeOrderDate(finalOrder.pickup_date_time) : null,
        completed_at: completionTimestamp,
        operator_id: isValidUuid(finalOrder.operator_id) ? finalOrder.operator_id : null,
        created_by: isValidUuid(finalOrder.created_by) ? finalOrder.created_by : null,
        driver_id: isValidUuid(finalOrder.driver_id) ? finalOrder.driver_id : null,
        companion_id: isValidUuid(finalOrder.companion_id) ? finalOrder.companion_id : null,
        vehicle_id: isValidUuid(finalOrder.vehicle_id) ? finalOrder.vehicle_id : null,
        fact_qty: Number(finalOrder.fact_qty) || 0,
        fact_tank_dropoff: Number(finalOrder.fact_tank_dropoff) || 0,
        fact_tank_pickup: Number(finalOrder.fact_tank_pickup) || 0,
        status: finalOrder.status || 'registered',
        sms_sent: Boolean(finalOrder.sms_sent),
        is_deleted: Boolean(finalOrder.is_deleted),
        contact_id: finalOrder.contact_id || null,
        route_rank: finalOrder.route_rank || null,
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
      throw e;
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
      triggerSMS(finalOrder);
    }
    
    setLocal(KEY_ORDERS, list.map(item => item.id === finalOrder.id ? finalOrder : item));
    await trackChange(loggerName, 'Order updated', 'Status', oldOrder?.status || '', finalOrder.status);
  }

  // Update vendor's last_order_date on database if order is completed
  if (finalOrder.status === 'completed' && finalOrder.vendor_id) {
    const orderDate = finalOrder.order_date || finalOrder.pickup_date_time || new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      void (async () => {
        try {
          await supabase.from('vendors').update({ last_order_date: orderDate }).eq('id', finalOrder.vendor_id);
        } catch {
          // Ignore background update errors
        }
      })();
    }
  }

  notifyDbChange('orders', isNew ? 'CREATE' : 'UPDATE', finalOrder.id);
  return finalOrder;
}

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

export async function updateOrdersRouteRanks(updates: { id: string; route_rank: string }[]): Promise<void> {
  if (!updates || updates.length === 0) return;

  // 1. Instantly update client local storage cache
  const list = getLocal<Order[]>(KEY_ORDERS, []);
  const updateMap = new Map(updates.map(u => [u.id, u.route_rank]));
  const updatedList = list.map(o => {
    if (updateMap.has(o.id)) {
      return { ...o, route_rank: updateMap.get(o.id)! };
    }
    return o;
  });
  setLocal(KEY_ORDERS, updatedList);
  appCache.clear();

  // 2. Persist to database via server API (bypasses RLS) or direct Supabase fallback
  let persisted = false;
  try {
    const res = await fetch('/api/update-route-ranks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });
    if (res.ok) {
      persisted = true;
    }
  } catch (err) {
    console.warn('Server /api/update-route-ranks failed, falling back to direct Supabase:', err);
  }

  if (!persisted && isSupabaseConfigured && supabase) {
    try {
      await Promise.all(
        updates.map(u =>
          supabase
            .from('orders')
            .update({ route_rank: u.route_rank })
            .eq('id', u.id)
        )
      );
    } catch (e) {
      console.warn('Supabase direct updateOrdersRouteRanks error:', e);
    }
  }

  notifyDbChange('orders', 'UPDATE');
}
