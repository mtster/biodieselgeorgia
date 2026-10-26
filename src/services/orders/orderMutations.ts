import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Order } from '../../types';
import { trackChange } from '../historyService';
import { KEY_ORDERS, KEY_TRUCKS as KEY_VEHICLES, getLocal, setLocal } from '../localStorage';
import { notifyDbChange } from '../../lib/realtime';
import { appCache } from '../../utils/cache';
import { generateUuid, cleanUserUuid } from '../vendorService';
import { isValidUuid } from './orderUtils';
import { getRankBetween, sortOrdersByRouteRank } from '../../utils/lexorank';

export async function saveOrder(order: Order, loggerName: string, currentUserId?: string): Promise<Order> {
  const isNew = !order.id;

  const createdByUuid = cleanUserUuid(isNew ? (currentUserId || order.created_by) : order.created_by);

  // When order is new and assigned to a vehicle/driver, position on TOP of vehicle's active orders via LexoRank
  let calculatedRank = order.route_rank;
  if (isNew && !calculatedRank && (order.vehicle_id || order.truck_plate || order.driver_id)) {
    try {
      const allOrders = getLocal<Order[]>(KEY_ORDERS, []);
      const vMatch = (order.truck_plate || order.vehicle_id || '').trim().toLowerCase();
      const vOrders = allOrders.filter(o => 
        !o.is_deleted && 
        o.status !== 'completed' && o.status !== 'cancelled' &&
        ((vMatch && (
          (o.vehicle_id && o.vehicle_id.toLowerCase() === vMatch) || 
          (o.truck_plate && o.truck_plate.toLowerCase() === vMatch)
        )) || (order.driver_id && o.driver_id === order.driver_id))
      );
      const sorted = sortOrdersByRouteRank(vOrders);
      const firstRank = sorted.length > 0 ? sorted[0].route_rank : null;
      calculatedRank = getRankBetween(null, firstRank);
    } catch {}
  }

  const finalOrder = {
    ...order,
    id: isNew ? (order.id || generateUuid()) : order.id,
    route_rank: calculatedRank,
    operator_id: cleanUserUuid(order.operator_id),
    createdByUuid,
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

      // Resolve vehicle_id to valid UUID if plate or non-uuid identifier is present
      let resolvedVehicleId = isValidUuid(finalOrder.vehicle_id) ? finalOrder.vehicle_id : null;
      if (!resolvedVehicleId && (finalOrder.truck_plate || finalOrder.vehicle_id)) {
        const plateCandidate = (finalOrder.truck_plate || finalOrder.vehicle_id || '').trim().toUpperCase();
        const vList = getLocal<any[]>(KEY_VEHICLES, []);
        const matched = vList.find(v => (v.plate_number && v.plate_number.toUpperCase() === plateCandidate) || v.id === plateCandidate);
        if (matched && isValidUuid(matched.id)) {
          resolvedVehicleId = matched.id;
          finalOrder.vehicle_id = matched.id;
          if (matched.plate_number) finalOrder.truck_plate = matched.plate_number;
        } else if (isSupabaseConfigured && supabase) {
          try {
            const { data: vRow } = await supabase
              .from('vehicles')
              .select('id, plate_number')
              .eq('plate_number', plateCandidate)
              .maybeSingle();
            if (vRow && isValidUuid(vRow.id)) {
              resolvedVehicleId = vRow.id;
              finalOrder.vehicle_id = vRow.id;
              if (vRow.plate_number) finalOrder.truck_plate = vRow.plate_number;
            }
          } catch (_) {}
        }
      }

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
        vehicle_id: resolvedVehicleId,
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

      // Synchronize vehicle record in Supabase with assigned driver/assistant
      if (resolvedVehicleId || finalOrder.truck_plate) {
        try {
          const vDriverId = isValidUuid(finalOrder.driver_id) ? finalOrder.driver_id : null;
          const vCompanionId = isValidUuid(finalOrder.companion_id) ? finalOrder.companion_id : null;
          if (resolvedVehicleId) {
            await supabase.from('vehicles').update({
              driver_id: vDriverId,
              companion_id: vCompanionId
            }).eq('id', resolvedVehicleId);
          } else if (finalOrder.truck_plate) {
            await supabase.from('vehicles').update({
              driver_id: vDriverId,
              companion_id: vCompanionId
            }).eq('plate_number', finalOrder.truck_plate.trim().toUpperCase());
          }
        } catch (vSyncErr) {
          console.warn('Sync vehicle driver in saveOrder failed:', vSyncErr);
        }
      }
    } catch (e) {
      console.error('Supabase saveOrder failed', e);
      throw e;
    }
  }

  appCache.clear();

  // Synchronize local storage vehicle cache with assigned driver/assistant
  if (finalOrder.vehicle_id || finalOrder.truck_plate) {
    const vList = getLocal<any[]>(KEY_VEHICLES, []);
    const cleanPlate = (finalOrder.truck_plate || '').trim().toUpperCase();
    const vIdx = vList.findIndex(t => 
      (finalOrder.vehicle_id && t.id === finalOrder.vehicle_id) || 
      (cleanPlate && (t.plate_number === cleanPlate || t.id === cleanPlate))
    );
    if (vIdx >= 0) {
      vList[vIdx] = {
        ...vList[vIdx],
        driver_id: finalOrder.driver_id || null,
        companion_id: finalOrder.companion_id || null
      };
      setLocal(KEY_VEHICLES, vList);
      notifyDbChange('vehicles', 'UPDATE', vList[vIdx].plate_number);
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
      const { error } = await supabase.from('orders').update({ is_deleted: true }).eq('id', id);
      if (error) {
        console.error('Supabase deleteOrder error:', error);
        throw error;
      }
    } catch (e) {
      console.error('Supabase deleteOrder failed', e);
      throw e;
    }
  }

  const list = getLocal<Order[]>(KEY_ORDERS, []);
  setLocal(KEY_ORDERS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Order deleted', 'Document #', docNum, '');
  notifyDbChange('orders', 'DELETE', id);
  return true;
}

export interface BatchAssignCrewParams {
  orderIds: string[];
  driverId?: string;
  companionId?: string;
  truckPlate?: string;
  vehicleId?: string;
  loggerName: string;
}

/**
 * Batches crew & vehicle assignment into a single database update query.
 * Eliminates sequential N-round-trip writes, repeated vehicle updates, and refetch cascades.
 */
export async function batchAssignCrewToOrders(params: BatchAssignCrewParams): Promise<void> {
  const { orderIds, driverId, companionId, truckPlate, vehicleId, loggerName } = params;
  if (!orderIds || orderIds.length === 0) return;

  const cleanDriverId = isValidUuid(driverId) ? cleanUserUuid(driverId) : null;
  const cleanCompanionId = isValidUuid(companionId) ? cleanUserUuid(companionId) : null;
  let resolvedVehicleId = isValidUuid(vehicleId) ? vehicleId : null;
  const cleanPlate = (truckPlate || '').trim().toUpperCase();

  // If vehicleId not provided or not valid UUID, attempt resolution from local cache or Supabase
  if (!resolvedVehicleId && (cleanPlate || vehicleId)) {
    const vList = getLocal<any[]>(KEY_VEHICLES, []);
    const matched = vList.find(v => (v.plate_number && v.plate_number.toUpperCase() === cleanPlate) || v.id === vehicleId);
    if (matched && isValidUuid(matched.id)) {
      resolvedVehicleId = matched.id;
    } else if (isSupabaseConfigured && supabase && cleanPlate) {
      try {
        const { data: vRow } = await supabase
          .from('vehicles')
          .select('id, plate_number')
          .eq('plate_number', cleanPlate)
          .maybeSingle();
        if (vRow && isValidUuid(vRow.id)) {
          resolvedVehicleId = vRow.id;
        }
      } catch (_) {}
    }
  }

  const idSet = new Set(orderIds);
  const localOrders = getLocal<Order[]>(KEY_ORDERS, []);

  // Compute LexoRank on top of vehicle's active orders
  const vOrders = localOrders.filter(o => 
    !o.is_deleted && 
    o.status !== 'completed' && o.status !== 'cancelled' &&
    ((resolvedVehicleId && o.vehicle_id === resolvedVehicleId) ||
     (cleanPlate && o.truck_plate === cleanPlate)) &&
    !idSet.has(o.id)
  );
  const sorted = sortOrdersByRouteRank(vOrders);
  let currentTopRank = sorted.length > 0 ? sorted[0].route_rank : null;

  const orderRankMap = new Map<string, string>();
  for (let i = orderIds.length - 1; i >= 0; i--) {
    const rank = getRankBetween(null, currentTopRank);
    orderRankMap.set(orderIds[i], rank);
    currentTopRank = rank;
  }

  // 1. Update Supabase for all selected orders with top LexoRanks
  if (isSupabaseConfigured && supabase) {
    try {
      const updatePromises = orderIds.map(oid => 
        supabase
          .from('orders')
          .update({
            driver_id: cleanDriverId,
            companion_id: cleanCompanionId,
            vehicle_id: resolvedVehicleId,
            status: 'driver_assigned',
            route_rank: orderRankMap.get(oid) || null
          })
          .eq('id', oid)
      );
      await Promise.all(updatePromises);

      // 2. Synchronize vehicle record once
      if (resolvedVehicleId) {
        await supabase
          .from('vehicles')
          .update({
            driver_id: cleanDriverId,
            companion_id: cleanCompanionId
          })
          .eq('id', resolvedVehicleId);
      } else if (cleanPlate) {
        await supabase
          .from('vehicles')
          .update({
            driver_id: cleanDriverId,
            companion_id: cleanCompanionId
          })
          .eq('plate_number', cleanPlate);
      }
    } catch (e) {
      console.error('Batch assign crew failed in Supabase:', e);
      throw e;
    }
  }

  // 3. Atomically update local storage orders
  const updatedOrders = localOrders.map(o => {
    if (idSet.has(o.id)) {
      return {
        ...o,
        driver_id: driverId || undefined,
        companion_id: companionId || undefined,
        vehicle_id: resolvedVehicleId || o.vehicle_id,
        truck_plate: cleanPlate || undefined,
        route_rank: orderRankMap.get(o.id) || o.route_rank,
        status: 'driver_assigned' as const
      };
    }
    return o;
  });
  setLocal(KEY_ORDERS, updatedOrders);

  // 4. Update local storage vehicle
  if (resolvedVehicleId || cleanPlate) {
    const vList = getLocal<any[]>(KEY_VEHICLES, []);
    const vIdx = vList.findIndex(t => 
      (resolvedVehicleId && t.id === resolvedVehicleId) || 
      (cleanPlate && (t.plate_number === cleanPlate || t.id === cleanPlate))
    );
    if (vIdx >= 0) {
      vList[vIdx] = {
        ...vList[vIdx],
        driver_id: driverId || null,
        companion_id: companionId || null
      };
      setLocal(KEY_VEHICLES, vList);
    }
  }

  // 5. Track single change history record for the entire batch
  await trackChange(
    loggerName,
    'Batch crew assignment',
    'Assigned vehicle/driver',
    '',
    `${orderIds.length} orders -> ${cleanPlate || 'vehicle'}`
  );

  // 6. Clear cache and send exactly ONE notifyDbChange
  appCache.clear();
  notifyDbChange('orders', 'UPDATE');
}

/**
 * Batches order deletions into a single database update query.
 */
export async function batchDeleteOrders(orderIds: string[], docNums: string[], loggerName: string): Promise<boolean> {
  if (!orderIds || orderIds.length === 0) return true;

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ is_deleted: true })
        .in('id', orderIds);
      if (error) {
        console.error('Supabase batchDeleteOrders error:', error);
        throw error;
      }
    } catch (e) {
      console.error('Supabase batchDeleteOrders failed', e);
      throw e;
    }
  }

  const idSet = new Set(orderIds);
  const list = getLocal<Order[]>(KEY_ORDERS, []);
  setLocal(KEY_ORDERS, list.map(item => idSet.has(item.id) ? { ...item, is_deleted: true } : item));

  await trackChange(
    loggerName,
    'Batch orders deleted',
    'Document #',
    docNums.join(', '),
    ''
  );

  appCache.clear();
  notifyDbChange('orders', 'DELETE');
  return true;
}

/**
 * Unassigns driver, assistant, and vehicle from selected orders.
 * If an order's status was 'driver_assigned', resets it to 'registered'.
 * Otherwise preserves its current status.
 */
export async function batchUnassignCrewFromOrders(params: {
  orderIds: string[];
  orders?: Order[];
  loggerName: string;
}): Promise<void> {
  const { orderIds, orders: providedOrders, loggerName } = params;
  if (!orderIds || orderIds.length === 0) return;

  const localOrders = getLocal<Order[]>(KEY_ORDERS, []);
  const allOrders = providedOrders && providedOrders.length > 0 ? providedOrders : localOrders;
  const idSet = new Set(orderIds);

  const targetOrders = allOrders.filter(o => idSet.has(o.id));
  const driverAssignedIds = targetOrders.filter(o => o.status === 'driver_assigned').map(o => o.id);
  const otherStatusIds = targetOrders.filter(o => o.status !== 'driver_assigned').map(o => o.id);

  orderIds.forEach(id => {
    if (!driverAssignedIds.includes(id) && !otherStatusIds.includes(id)) {
      const match = localOrders.find(o => o.id === id);
      if (match?.status === 'driver_assigned') {
        driverAssignedIds.push(id);
      } else {
        otherStatusIds.push(id);
      }
    }
  });

  if (isSupabaseConfigured && supabase) {
    try {
      if (driverAssignedIds.length > 0) {
        const { error: err1 } = await supabase
          .from('orders')
          .update({
            driver_id: null,
            companion_id: null,
            vehicle_id: null,
            status: 'registered'
          })
          .in('id', driverAssignedIds);
        if (err1) throw err1;
      }

      if (otherStatusIds.length > 0) {
        const { error: err2 } = await supabase
          .from('orders')
          .update({
            driver_id: null,
            companion_id: null,
            vehicle_id: null
          })
          .in('id', otherStatusIds);
        if (err2) throw err2;
      }
    } catch (e) {
      console.error('Supabase batchUnassignCrewFromOrders error:', e);
      throw e;
    }
  }

  // Atomically update local storage
  const driverAssignedSet = new Set(driverAssignedIds);
  const updatedOrders = localOrders.map(o => {
    if (idSet.has(o.id)) {
      const newStatus = driverAssignedSet.has(o.id) ? ('registered' as const) : o.status;
      return {
        ...o,
        driver_id: undefined,
        companion_id: undefined,
        vehicle_id: undefined,
        truck_plate: undefined,
        status: newStatus
      };
    }
    return o;
  });
  setLocal(KEY_ORDERS, updatedOrders);

  await trackChange(
    loggerName,
    'Crew unassigned',
    'Crew removed',
    '',
    `${orderIds.length} orders unassigned`
  );

  appCache.clear();
  notifyDbChange('orders', 'UPDATE');
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

/**
 * Checks whether an active (non-deleted) order already exists for a vendor on the specified calendar date.
 */
export async function checkDuplicateOrder(
  vendorId: string,
  orderDate: string,
  excludeOrderId?: string
): Promise<boolean> {
  if (!vendorId || !orderDate) return false;

  const targetDateStr = orderDate.includes('T') ? orderDate.split('T')[0] : orderDate.substring(0, 10);

  // 1. Check Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      let q = supabase
        .from('orders')
        .select('id, order_date, is_deleted')
        .eq('vendor_id', vendorId)
        .eq('is_deleted', false);

      if (excludeOrderId) {
        q = q.neq('id', excludeOrderId);
      }

      const { data, error } = await q;
      if (!error && data && data.length > 0) {
        const hasDuplicate = data.some(row => {
          const rowDateStr = row.order_date
            ? (row.order_date.includes('T') ? row.order_date.split('T')[0] : row.order_date.substring(0, 10))
            : '';
          return rowDateStr === targetDateStr;
        });
        if (hasDuplicate) return true;
      }
    } catch (e) {
      console.warn('Supabase checkDuplicateOrder warning:', e);
    }
  }

  // 2. Local storage cache check
  const localOrders = getLocal<Order[]>(KEY_ORDERS, []);
  const localMatch = localOrders.some(o => {
    if (o.is_deleted === true) return false;
    if (excludeOrderId && o.id === excludeOrderId) return false;
    if (o.vendor_id !== vendorId) return false;
    const oDateStr = o.order_date
      ? (o.order_date.includes('T') ? o.order_date.split('T')[0] : o.order_date.substring(0, 10))
      : '';
    return oDateStr === targetDateStr;
  });

  return localMatch;
}
