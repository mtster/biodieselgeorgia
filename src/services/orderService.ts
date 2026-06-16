import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Order } from '../types';
import { trackChange } from './historyService';
import { KEY_ORDERS, getLocal, setLocal } from './localStorage';

export { KEY_ORDERS };

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

      // Sanitize UUID fields so empty or non-valid UUID strings are saved as null in Supabase
      const isValidUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      
      dbOrder.operator_id = isValidUuid(dbOrder.operator_id) ? dbOrder.operator_id : null;
      dbOrder.driver_id = isValidUuid(dbOrder.driver_id) ? dbOrder.driver_id : null;
      dbOrder.companion_id = isValidUuid(dbOrder.companion_id) ? dbOrder.companion_id : null;

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
