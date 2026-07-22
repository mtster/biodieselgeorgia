import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Order } from '../types';
import { trackChange } from './historyService';
import { KEY_ORDERS, getLocal, setLocal } from './localStorage';

export { KEY_ORDERS };

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

  const cleanUserUuid = (val: string | null | undefined): string | null => {
    if (!val) return null;
    if (val === 'user-admin') return '00000000-0000-4000-a000-000000000000';
    if (val.startsWith('user-')) {
      const suffix = val.substring(5).padEnd(11, '0').slice(0, 11);
      return `00000000-0000-4000-b000-${suffix}`.toLowerCase();
    }
    return val;
  };

  const createdByUuid = cleanUserUuid(isNew ? (currentUserId || order.created_by) : order.created_by);

  const finalOrder = {
    ...order,
    id: isNew ? 'ord-' + Math.random().toString(36).substring(2, 9) : order.id,
    operator_id: cleanUserUuid(order.operator_id),
    created_by: createdByUuid,
    driver_id: cleanUserUuid(order.driver_id),
    companion_id: cleanUserUuid(order.companion_id),
    notes: Array.isArray(order.notes) ? order.notes : (order.note ? [{ id: 'c-1', comment: order.note, date: new Date().toISOString(), user_name: 'System' }] : [])
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

      // Sanitize UUID fields so empty or non-valid UUID strings are saved as null in Supabase
      const isValidUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      
      dbOrder.operator_id = isValidUuid(dbOrder.operator_id) ? dbOrder.operator_id : null;
      dbOrder.created_by = isValidUuid(dbOrder.created_by) ? dbOrder.created_by : null;
      dbOrder.driver_id = isValidUuid(dbOrder.driver_id) ? dbOrder.driver_id : null;
      dbOrder.companion_id = isValidUuid(dbOrder.companion_id) ? dbOrder.companion_id : null;
      dbOrder.truck_plate = typeof dbOrder.truck_plate === 'string' && dbOrder.truck_plate.trim() !== "" ? dbOrder.truck_plate : null;
      dbOrder.notes = Array.isArray(dbOrder.notes) ? dbOrder.notes : [];

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
  return true;
}
