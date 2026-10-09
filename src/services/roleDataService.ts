import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Order, Vendor, Warehouse, Vehicle as Truck } from '../types';
import { getVehicles } from './vehicleService';
import { getUsers } from './userService';
import { getWarehouses } from './lookupService';
import { decodeVendorCustomFields } from './vendorService';
import { sortOrdersByRouteRank } from '../utils/lexorank';
import { KEY_ORDERS, KEY_VENDORS, getLocal } from './localStorage';

// Georgian to English transliteration map for license plate and keyword comparisons
const ge2enPlateMap: Record<string, string> = {
  'ა':'a','ბ':'b','გ':'g','დ':'d','ე':'e','ვ':'v','ზ':'z','თ':'t','ი':'i','კ':'k',
  'ლ':'l','მ':'m','ნ':'n','ო':'o','პ':'p','ჟ':'j','რ':'r','ს':'s','ტ':'t','უ':'u',
  'ფ':'f','ქ':'q','ღ':'r','ყ':'y','შ':'s','ჩ':'c','ც':'c','ძ':'z','წ':'w','ჭ':'c',
  'ხ':'x','ჯ':'j','ჰ':'h'
};

// Sanitizes strings for plate and identifier matching, normalizing Georgian letters to Latin
export const cleanStr = (str?: string): string => {
  if (!str) return '';
  const s = String(str).toLowerCase().trim();
  const transliterated = s.split('').map(c => ge2enPlateMap[c] || c).join('');
  return transliterated.replace(/[^a-z0-9]/g, '');
};

// Normalizes text names (preserving Georgian script and alphanumeric text, stripping symbols and spaces)
export const normalizeText = (str?: string): string => {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[\s\-_.,()]/g, '').trim();
};

const isValidUuid = (val: string | null | undefined): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

/**
 * Checks whether a vehicle belongs to or is assigned to the given user
 */
export function isVehicleMatchingUser(truck: Truck, user: User): boolean {
  if (!truck || !user) return false;

  // 1. Direct auth user ID or vehicle ID match
  if (truck.auth_user_id && truck.auth_user_id === user.id) return true;
  if (truck.id && truck.id === user.id) return true;

  // 2. Direct driver or companion assignment by ID
  if (truck.driver_id && (truck.driver_id === user.id || (user.personal_id && truck.driver_id === user.personal_id))) return true;
  if (truck.companion_id && (truck.companion_id === user.id || (user.personal_id && truck.companion_id === user.personal_id))) return true;

  // 3. Match driver or companion by name
  if (truck.driver_name && user.name && normalizeText(truck.driver_name) === normalizeText(user.name)) return true;
  if (truck.companion_name && user.name && normalizeText(truck.companion_name) === normalizeText(user.name)) return true;

  // 4. Plate number matching against user identifiers
  const tPlateClean = cleanStr(truck.plate_number);
  if (tPlateClean) {
    const uPlateClean = cleanStr((user as any).plate_number);
    if (uPlateClean && (tPlateClean === uPlateClean || tPlateClean.includes(uPlateClean) || uPlateClean.includes(tPlateClean))) return true;

    const uEmail = user.email || '';
    const uEmailPart = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
    const uEmailClean = cleanStr(uEmailPart);
    if (uEmailClean && (tPlateClean === uEmailClean || tPlateClean.includes(uEmailClean) || uEmailClean.includes(tPlateClean))) return true;

    const uNameClean = cleanStr(user.name);
    if (uNameClean && (tPlateClean === uNameClean || tPlateClean.includes(uNameClean) || uNameClean.includes(tPlateClean))) return true;

    const uPidClean = cleanStr(user.personal_id);
    if (uPidClean && tPlateClean === uPidClean) return true;

    const uIdClean = cleanStr(user.id);
    if (uIdClean && tPlateClean === uIdClean) return true;
  }

  return false;
}

/**
 * Finds the assigned vehicle for the current user
 */
export function findUserAssignedTruck(currentUser: User, trucks: Truck[]): Truck | undefined {
  if (!currentUser || !trucks || trucks.length === 0) return undefined;
  return trucks.find(t => isVehicleMatchingUser(t, currentUser));
}

/**
 * Verifies if an order has its pickup date (order_date or pickup_date_time) set as the current date.
 */
export function checkOrderPickupDateIsToday(o: Order, customTodayStr?: string): boolean {
  if (!o || o.is_deleted) return false;

  const todayTbilisi = customTodayStr || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());
  const todayLocal = new Date().toISOString().slice(0, 10);

  // Candidate pickup date fields:
  // 1. o.order_date ("შეკვეთის გატანის თარიღი" / Order pickup date)
  // 2. o.pickup_date_time (pickup / completion timestamp)
  const candidateDates = [o.order_date, o.pickup_date_time].filter(Boolean) as string[];
  if (candidateDates.length === 0 && o.created_at) {
    candidateDates.push(o.created_at);
  }

  for (const raw of candidateDates) {
    const rawStr = String(raw).trim();
    if (!rawStr) continue;

    // Check direct date string prefix (e.g. "2026-10-09")
    const datePart = rawStr.includes('T') ? rawStr.split('T')[0] : rawStr.slice(0, 10);
    if (datePart === todayTbilisi || datePart === todayLocal) {
      return true;
    }

    // Check with Asia/Tbilisi timezone conversion
    try {
      const d = new Date(rawStr);
      if (!isNaN(d.getTime())) {
        const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(d);
        if (dStr === todayTbilisi || dStr === todayLocal) {
          return true;
        }
      }
    } catch {}
  }

  return false;
}

/**
 * Checks whether an order is specifically assigned to the user's vehicle (or driver).
 * For vehicle accounts, strictly requires that the order is assigned to THIS vehicle,
 * and does not belong to another vehicle.
 */
export function isOrderAssignedToVehicle(o: Order, currentUser: User, trucks: Truck[]): boolean {
  if (!o || o.is_deleted || !currentUser) return false;

  const myTruck = findUserAssignedTruck(currentUser, trucks);
  const userTrucks = trucks.filter(t => isVehicleMatchingUser(t, currentUser));
  if (myTruck && !userTrucks.some(ut => ut.id === myTruck.id)) {
    userTrucks.push(myTruck);
  }

  const uEmail = currentUser.email || '';
  const uEmailPart = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
  const uEmailClean = cleanStr(uEmailPart);
  const uPlateClean = cleanStr((currentUser as any).plate_number);

  // Collect all valid IDs and plates identifying THIS vehicle
  const myVehicleIds = new Set<string>();
  if (myTruck?.id) myVehicleIds.add(myTruck.id);
  userTrucks.forEach(t => { if (t.id) myVehicleIds.add(t.id); });
  if (currentUser.id) myVehicleIds.add(currentUser.id);

  const myVehiclePlates = new Set<string>();
  if (myTruck?.plate_number) myVehiclePlates.add(cleanStr(myTruck.plate_number));
  userTrucks.forEach(t => { if (t.plate_number) myVehiclePlates.add(cleanStr(t.plate_number)); });
  if (uPlateClean && uPlateClean.length >= 2) myVehiclePlates.add(uPlateClean);
  if (uEmailClean && uEmailClean.length >= 3 && uEmailClean !== 'driver' && uEmailClean !== 'admin') {
    myVehiclePlates.add(uEmailClean);
  }
  if (currentUser.name) {
    const withoutPrefix = cleanStr(currentUser.name.replace(/^vehicle\s*/i, ''));
    if (withoutPrefix && withoutPrefix.length >= 3 && !withoutPrefix.includes('administrator')) {
      myVehiclePlates.add(withoutPrefix);
    }
  }

  // Identify other trucks in the fleet that do NOT belong to this user
  const otherVehicleIds = new Set<string>();
  const otherVehiclePlates = new Set<string>();
  trucks.forEach(t => {
    const isMine = (t.id && myVehicleIds.has(t.id)) || (t.plate_number && myVehiclePlates.has(cleanStr(t.plate_number)));
    if (!isMine) {
      if (t.id) otherVehicleIds.add(t.id);
      if (t.plate_number) otherVehiclePlates.add(cleanStr(t.plate_number));
    }
  });

  const oVehicleId = (o.vehicle_id || '').trim();
  const oPlateClean = cleanStr(o.truck_plate);

  // If the order is explicitly assigned to a DIFFERENT vehicle, reject it immediately
  if (oVehicleId && (otherVehicleIds.has(oVehicleId) || otherVehiclePlates.has(cleanStr(oVehicleId)))) {
    return false;
  }
  if (oPlateClean && (otherVehiclePlates.has(oPlateClean) || otherVehicleIds.has(oPlateClean))) {
    return false;
  }

  // Check if order references a known truck in `trucks`
  if (oVehicleId || oPlateClean) {
    const ordTruck = trucks.find(t =>
      (oVehicleId && (t.id === oVehicleId || cleanStr(t.plate_number) === cleanStr(oVehicleId))) ||
      (oPlateClean && (cleanStr(t.plate_number) === oPlateClean || t.id === o.truck_plate))
    );
    if (ordTruck) {
      const isOurTruck = (ordTruck.id && myVehicleIds.has(ordTruck.id)) ||
        (ordTruck.plate_number && myVehiclePlates.has(cleanStr(ordTruck.plate_number))) ||
        isVehicleMatchingUser(ordTruck, currentUser);
      if (!isOurTruck) {
        return false;
      }
      return true;
    }
  }

  // Check direct vehicle ID match
  if (oVehicleId) {
    if (myVehicleIds.has(oVehicleId)) return true;
    if (myVehiclePlates.has(cleanStr(oVehicleId))) return true;
  }

  // Check direct truck plate match
  if (oPlateClean) {
    if (myVehiclePlates.has(oPlateClean)) return true;
    if (myVehicleIds.has(o.truck_plate || '')) return true;
  }

  // For vehicle accounts (where a vehicle is associated with this account),
  // orders MUST have this vehicle assigned specifically to them.
  const hasVehicle = myVehicleIds.size > 0 && (myTruck || userTrucks.length > 0 || myVehiclePlates.size > 0);
  if (hasVehicle) {
    return false;
  }

  // Only for standalone individual drivers without an assigned vehicle:
  if (o.driver_id && (o.driver_id === currentUser.id || (currentUser.personal_id && o.driver_id === currentUser.personal_id))) {
    return true;
  }
  if (o.companion_id && (o.companion_id === currentUser.id || (currentUser.personal_id && o.companion_id === currentUser.personal_id))) {
    return true;
  }

  return false;
}

/**
 * Fetches ONLY today's orders assigned specifically to the logged-in driver / vehicle,
 * and ONLY the specific vendors (and their contacts) for those orders.
 */
export async function getDriverOrdersAndVendors(
  currentUser: User,
  trucks: Truck[],
  employees: User[] = [],
  cachedVendors: Vendor[] = []
): Promise<{ orders: Order[]; suppliers: Vendor[] }> {
  const myTruck = findUserAssignedTruck(currentUser, trucks);
  const userTrucks = trucks.filter(t => isVehicleMatchingUser(t, currentUser));
  if (myTruck && !userTrucks.some(ut => ut.id === myTruck.id)) {
    userTrucks.push(myTruck);
  }

  const isVehicleAccount = Boolean(
    myTruck ||
    userTrucks.length > 0 ||
    (currentUser as any).plate_number ||
    (currentUser as any).vehicle_role === 'vehicle' ||
    (currentUser as any).user_metadata?.vehicle_role === 'vehicle' ||
    (currentUser as any).app_metadata?.vehicle_role === 'vehicle'
  );

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());

  // Helper to match an employee
  const findEmp = (idOrName?: string) => {
    if (!idOrName || !idOrName.trim()) return undefined;
    const trimmed = idOrName.trim();
    const exactMatch = employees.find(e => 
      e && (
        (e.id && e.id.toLowerCase() === trimmed.toLowerCase()) || 
        (e.personal_id && e.personal_id.toLowerCase() === trimmed.toLowerCase())
      )
    );
    if (exactMatch) return exactMatch;
    const nameMatch = employees.find(e => e && e.name && normalizeText(e.name) === normalizeText(trimmed));
    if (nameMatch) return nameMatch;
    const targetClean = cleanStr(trimmed);
    if (targetClean.length >= 2) {
      return employees.find(e => {
        if (!e) return false;
        if (e.name && cleanStr(e.name) === targetClean) return true;
        if (e.email && cleanStr(e.email.split('@')[0]) === targetClean) return true;
        return false;
      });
    }
    return undefined;
  };

  const driverObj = findEmp(myTruck?.driver_id) || findEmp(myTruck?.driver_name);
  const companionObj = findEmp(myTruck?.companion_id) || findEmp(myTruck?.companion_name);

  let assignedDriverName = driverObj?.name || myTruck?.driver_name;
  if (!assignedDriverName && (myTruck?.driver_id === currentUser.id || myTruck?.driver_id === currentUser.personal_id)) {
    assignedDriverName = currentUser.name;
  }

  let assignedCompanionName = companionObj?.name || myTruck?.companion_name;
  if (!assignedCompanionName && (myTruck?.companion_id === currentUser.id || myTruck?.companion_id === currentUser.personal_id)) {
    assignedCompanionName = currentUser.name;
  }

  // Determines if a candidate order belongs to this vehicle / driver with pickup date set as current date
  const orderBelongsToUser = (o: Order): boolean => {
    if (!o || o.is_deleted) return false;
    if (!checkOrderPickupDateIsToday(o, todayStr)) return false;
    return isOrderAssignedToVehicle(o, currentUser, trucks);
  };

  let driverOrders: Order[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      // Build targeted query with strictly valid UUID parameters for Supabase
      let query = supabase
        .from('orders')
        .select('*')
        .eq('is_deleted', false);

      const orParts: string[] = [];
      userTrucks.forEach(t => {
        if (isValidUuid(t.id)) orParts.push(`vehicle_id.eq.${t.id}`);
      });

      if (isValidUuid(currentUser?.id)) {
        orParts.push(`vehicle_id.eq.${currentUser.id}`);
      }

      if (!isVehicleAccount) {
        if (isValidUuid(currentUser?.id)) {
          orParts.push(`driver_id.eq.${currentUser.id}`);
          orParts.push(`companion_id.eq.${currentUser.id}`);
        }
        if (isValidUuid(driverObj?.id)) {
          orParts.push(`driver_id.eq.${driverObj.id}`);
        }
        if (isValidUuid(companionObj?.id)) {
          orParts.push(`companion_id.eq.${companionObj.id}`);
        }
      }

      if (orParts.length > 0) {
        query = query.or(Array.from(new Set(orParts)).join(','));
      }

      const { data: rawOrders, error } = await query
        .order('order_date', { ascending: false })
        .limit(500);

      if (!error && rawOrders) {
        driverOrders = (rawOrders as any[])
          .map(o => {
            const ordVehicleId = o.vehicle_id;
            const ordTruck = trucks.find(t => 
              (ordVehicleId && (t.id === ordVehicleId || cleanStr(t.plate_number) === cleanStr(ordVehicleId))) ||
              (o.truck_plate && (cleanStr(t.plate_number) === cleanStr(o.truck_plate) || t.id === o.truck_plate))
            );
            return {
              ...o,
              truck_plate: o.truck_plate || ordTruck?.plate_number || myTruck?.plate_number || '',
              driver_name: o.driver_name || (o.driver_id ? findEmp(o.driver_id)?.name : '') || ordTruck?.driver_name || assignedDriverName || '',
              companion_name: o.companion_name || (o.companion_id ? findEmp(o.companion_id)?.name : '') || ordTruck?.companion_name || assignedCompanionName || '',
              notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
            };
          })
          .filter(orderBelongsToUser);
      }
    } catch (e) {
      console.warn('Error fetching driver-specific orders from Supabase:', e);
    }
  }

  // Fallback to local storage cache if Supabase returned 0 orders or is offline
  if (driverOrders.length === 0) {
    const cachedOrders = getLocal<Order[]>(KEY_ORDERS, []);
    if (cachedOrders && cachedOrders.length > 0) {
      driverOrders = cachedOrders
        .map(o => {
          const ordVehicleId = o.vehicle_id;
          const ordTruck = trucks.find(t => 
            (ordVehicleId && (t.id === ordVehicleId || cleanStr(t.plate_number) === cleanStr(ordVehicleId))) ||
            (o.truck_plate && (cleanStr(t.plate_number) === cleanStr(o.truck_plate) || t.id === o.truck_plate))
          );
          return {
            ...o,
            truck_plate: o.truck_plate || ordTruck?.plate_number || myTruck?.plate_number || '',
            driver_name: o.driver_name || (o.driver_id ? findEmp(o.driver_id)?.name : '') || ordTruck?.driver_name || assignedDriverName || '',
            companion_name: o.companion_name || (o.companion_id ? findEmp(o.companion_id)?.name : '') || ordTruck?.companion_name || assignedCompanionName || ''
          };
        })
        .filter(orderBelongsToUser);
    }
  }

  // Fetch ONLY the vendors referenced by this driver's orders
  const vendorIds = Array.from(new Set(driverOrders.map(o => o.vendor_id).filter(Boolean)));
  let assignedVendors: Vendor[] = [];

  // Use cached vendors if they already include all needed vendor IDs
  const missingVendorIds = vendorIds.filter(id => !cachedVendors.some(v => v.id === id));
  if (missingVendorIds.length === 0 && cachedVendors.length > 0 && vendorIds.length > 0) {
    assignedVendors = cachedVendors.filter(v => vendorIds.includes(v.id));
  } else if (vendorIds.length > 0 && isSupabaseConfigured && supabase) {
    try {
      const [vRes, cRes] = await Promise.all([
        supabase
          .from('vendors')
          .select('*')
          .in('id', vendorIds)
          .eq('is_deleted', false),
        supabase
          .from('vendor_contacts')
          .select('*')
          .in('vendor_id', vendorIds)
          .eq('is_deleted', false)
      ]);

      if (vRes.data) {
        const contacts = cRes.data || [];
        assignedVendors = vRes.data.map(v => {
          const decoded = decodeVendorCustomFields(v);
          decoded.contacts = contacts
            .filter((c: any) => c.vendor_id === v.id)
            .sort((a: any, b: any) => {
              if (a.is_default && !b.is_default) return -1;
              if (!a.is_default && b.is_default) return 1;
              return (b.sort_order || 0) - (a.sort_order || 0);
            });
          return decoded;
        });
      }
    } catch (e) {
      console.warn('Error fetching vendors for driver orders:', e);
    }
  }

  // Fallback to local vendors cache if offline or not returned by Supabase
  if (assignedVendors.length === 0 && vendorIds.length > 0) {
    const allVendors = getLocal<Vendor[]>(KEY_VENDORS, []);
    if (allVendors && allVendors.length > 0) {
      assignedVendors = allVendors.filter(v => vendorIds.includes(v.id));
    }
  }

  return {
    orders: sortOrdersByRouteRank(driverOrders),
    suppliers: assignedVendors
  };
}

/**
 * Targeted light-weight data loader for mobile logistics drivers.
 * Fetches only trucks, employees, warehouses, today's driver orders, and assigned vendors.
 */
export async function getDriverLogisticsData(currentUser: User): Promise<{
  trucks: Truck[];
  employees: User[];
  warehouses: Warehouse[];
  orders: Order[];
  suppliers: Vendor[];
}> {
  const [trks, usrs, whs] = await Promise.all([
    getVehicles(),
    getUsers(),
    getWarehouses()
  ]);

  const { orders, suppliers } = await getDriverOrdersAndVendors(currentUser, trks, usrs);

  return {
    trucks: trks,
    employees: usrs,
    warehouses: whs,
    orders,
    suppliers
  };
}

/**
 * Targeted light-weight data loader for suppliers.
 * Fetches only the supplier's own profile, their orders, and warehouses.
 */
export async function getSupplierAppData(currentUser: User): Promise<{
  vendor: Vendor | null;
  orders: Order[];
  warehouses: Warehouse[];
}> {
  const whsPromise = getWarehouses();
  let vendorObj: Vendor | null = null;
  let vendorOrders: Order[] = [];

  const vendorId = currentUser.vendor_id;

  if (vendorId && isSupabaseConfigured && supabase) {
    try {
      const [vRes, cRes, oRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('id', vendorId).maybeSingle(),
        supabase.from('vendor_contacts').select('*').eq('vendor_id', vendorId).eq('is_deleted', false),
        supabase.from('orders').select('*').eq('vendor_id', vendorId).eq('is_deleted', false).order('order_date', { ascending: false })
      ]);

      if (vRes.data) {
        vendorObj = decodeVendorCustomFields(vRes.data);
        const contacts = cRes.data || [];
        vendorObj.contacts = contacts.sort((a: any, b: any) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return (b.sort_order || 0) - (a.sort_order || 0);
        });
      }

      if (oRes.data) {
        vendorOrders = oRes.data.map((o: any) => ({
          ...o,
          notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
        }));
      }
    } catch (e) {
      console.warn('Error fetching supplier data:', e);
    }
  }

  const whs = await whsPromise;

  return {
    vendor: vendorObj,
    orders: vendorOrders,
    warehouses: whs
  };
}
