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
 * Fetches ONLY today's orders assigned to the logged-in driver / vehicle,
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

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());

  const uEmail = currentUser.email || '';
  const uEmailPart = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
  const uEmailClean = cleanStr(uEmailPart);
  const uNameClean = cleanStr(currentUser.name);
  const uNameNorm = normalizeText(currentUser.name);
  const uPidClean = cleanStr(currentUser.personal_id);
  const uPlateClean = cleanStr((currentUser as any).plate_number);

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

  // Set of plate strings that associate with this user/vehicle
  const userPlateSet = new Set<string>();
  if (uPlateClean) userPlateSet.add(uPlateClean);
  if (uEmailClean) userPlateSet.add(uEmailClean);
  if (uNameClean) userPlateSet.add(uNameClean);
  if (uPidClean) userPlateSet.add(uPidClean);
  userTrucks.forEach(t => {
    if (t.plate_number) userPlateSet.add(cleanStr(t.plate_number));
  });

  // Determines if a candidate order belongs to this vehicle / driver
  const orderBelongsToUser = (o: Order): boolean => {
    if (!o || o.is_deleted) return false;

    // Strict date verification in Tbilisi timezone (or any active assigned order)
    const rawDate = o.order_date || o.pickup_date_time || o.created_at;
    let matchesDate = false;
    if (rawDate) {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(d);
          if (dStr === todayStr) matchesDate = true;
        } else {
          const datePart = String(rawDate).slice(0, 10);
          if (datePart === todayStr) matchesDate = true;
        }
      } catch {
        const datePart = String(rawDate).slice(0, 10);
        if (datePart === todayStr) matchesDate = true;
      }
    }

    const isActiveOrder = o.status !== 'completed' && o.status !== 'cancelled';
    if (!matchesDate && !isActiveOrder) return false;

    // 1. Check vehicle linked on the order
    const oVehicleId = o.vehicle_id;
    const ordTruck = trucks.find(t => 
      (oVehicleId && (t.id === oVehicleId || cleanStr(t.plate_number) === cleanStr(oVehicleId))) ||
      (o.truck_plate && (cleanStr(t.plate_number) === cleanStr(o.truck_plate) || t.id === o.truck_plate))
    );

    if (ordTruck && userTrucks.some(ut => ut.id === ordTruck.id || cleanStr(ut.plate_number) === cleanStr(ordTruck.plate_number))) return true;
    if (ordTruck && isVehicleMatchingUser(ordTruck, currentUser)) return true;

    // 2. Match order vehicle ID directly
    if (oVehicleId) {
      if (myTruck?.id && oVehicleId === myTruck.id) return true;
      if (myTruck?.plate_number && cleanStr(oVehicleId) === cleanStr(myTruck.plate_number)) return true;
      if (userTrucks.some(ut => ut.id === oVehicleId || cleanStr(ut.plate_number) === cleanStr(oVehicleId))) return true;
      if (userPlateSet.has(cleanStr(oVehicleId))) return true;
      if (oVehicleId === currentUser.id) return true;
    }

    // 3. Match truck plate
    const oPlateClean = cleanStr(o.truck_plate);
    if (oPlateClean) {
      if (userPlateSet.has(oPlateClean)) return true;
      if (userTrucks.some(ut => {
        const p = cleanStr(ut.plate_number);
        return p && (p === oPlateClean || p.includes(oPlateClean) || oPlateClean.includes(p));
      })) return true;
    }

    // 4. Match by driver_id or companion_id
    if (o.driver_id) {
      if (o.driver_id === currentUser.id || (currentUser.personal_id && o.driver_id === currentUser.personal_id)) return true;
      if (userTrucks.some(ut => ut.driver_id && o.driver_id === ut.driver_id)) return true;
      if (driverObj?.id && o.driver_id === driverObj.id) return true;
    }
    if (o.companion_id) {
      if (o.companion_id === currentUser.id || (currentUser.personal_id && o.companion_id === currentUser.personal_id)) return true;
      if (userTrucks.some(ut => ut.companion_id && o.companion_id === ut.companion_id)) return true;
      if (companionObj?.id && o.companion_id === companionObj.id) return true;
    }

    // 5. Match by driver_name or companion_name
    if (o.driver_name) {
      const oDrvNorm = normalizeText(o.driver_name);
      if (oDrvNorm && (oDrvNorm === uNameNorm || (assignedDriverName && oDrvNorm === normalizeText(assignedDriverName)))) return true;
    }
    if (o.companion_name) {
      const oCmpNorm = normalizeText(o.companion_name);
      if (oCmpNorm && (oCmpNorm === uNameNorm || (assignedCompanionName && oCmpNorm === normalizeText(assignedCompanionName)))) return true;
    }

    return false;
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
        if (isValidUuid(t.driver_id)) orParts.push(`driver_id.eq.${t.driver_id}`);
        if (isValidUuid(t.companion_id)) orParts.push(`companion_id.eq.${t.companion_id}`);
      });

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
