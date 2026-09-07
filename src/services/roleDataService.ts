import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Order, Vendor, Warehouse, Vehicle as Truck } from '../types';
import { getVehicles } from './vehicleService';
import { getUsers } from './userService';
import { getWarehouses } from './lookupService';
import { decodeVendorCustomFields } from './vendorService';

// Helper to sanitize strings for plate and driver matching
const cleanStr = (str?: string) => (str ? str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '');

/**
 * Finds the assigned vehicle for the current user
 */
export function findUserAssignedTruck(currentUser: User, trucks: Truck[]): Truck | undefined {
  const uEmail = currentUser.email || '';
  const uEmailPart = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
  const uEmailClean = cleanStr(uEmailPart);
  const uNameClean = cleanStr(currentUser.name);
  const uPidClean = cleanStr(currentUser.personal_id);
  const uIdClean = cleanStr(currentUser.id);

  return trucks.find(t => {
    if (!t) return false;

    // 1. Match by auth_user_id or vehicle id
    if (t.auth_user_id && t.auth_user_id === currentUser.id) return true;
    if (t.id && t.id === currentUser.id) return true;

    // 2. Match by driver_id or companion_id
    if (t.driver_id && (t.driver_id === currentUser.id || (currentUser.personal_id && t.driver_id === currentUser.personal_id))) return true;
    if (t.companion_id && (t.companion_id === currentUser.id || (currentUser.personal_id && t.companion_id === currentUser.personal_id))) return true;

    // 3. Match sanitized plate number
    const tPlateClean = cleanStr(t.plate_number);
    if (tPlateClean) {
      if (uEmailClean && (tPlateClean === uEmailClean || tPlateClean.includes(uEmailClean) || uEmailClean.includes(tPlateClean))) return true;
      if (uNameClean && (tPlateClean === uNameClean || tPlateClean.includes(uNameClean) || uNameClean.includes(tPlateClean))) return true;
      if (uPidClean && tPlateClean === uPidClean) return true;
      if (uIdClean && tPlateClean === uIdClean) return true;
    }

    return false;
  });
}

/**
 * Fetches ONLY today's orders assigned to the logged-in driver / vehicle,
 * and ONLY the specific vendors (and their contacts) for those orders.
 */
export async function getDriverOrdersAndVendors(
  currentUser: User,
  trucks: Truck[],
  employees: User[] = []
): Promise<{ orders: Order[]; suppliers: Vendor[] }> {
  const myTruck = findUserAssignedTruck(currentUser, trucks);
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());

  const uEmail = currentUser.email || '';
  const uEmailPart = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
  const uEmailClean = cleanStr(uEmailPart);
  const uNameClean = cleanStr(currentUser.name);
  const uPidClean = cleanStr(currentUser.personal_id);

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
    const nameMatch = employees.find(e => e && e.name && e.name.toLowerCase() === trimmed.toLowerCase());
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

  let driverOrders: Order[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      // Query recent orders ordered by order_date desc (valid indexed column)
      const { data: rawOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('is_deleted', false)
        .order('order_date', { ascending: false })
        .limit(300);

      if (!error && rawOrders) {
        driverOrders = (rawOrders as any[])
          .filter(o => {
            if (!o || o.is_deleted) return false;

            // Strict date verification in Tbilisi timezone
            const rawDate = o.order_date || o.pickup_date_time || o.created_at;
            if (rawDate) {
              try {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                  const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(d);
                  if (dStr !== todayStr) return false;
                } else {
                  const datePart = String(rawDate).slice(0, 10);
                  if (datePart !== todayStr) return false;
                }
              } catch {
                const datePart = String(rawDate).slice(0, 10);
                if (datePart !== todayStr) return false;
              }
            }

            // 1. Match by vehicle id
            if (myTruck?.id && o.vehicle_id && o.vehicle_id === myTruck.id) return true;

            // 2. Match by truck plate
            const oPlateClean = cleanStr(o.truck_plate);
            if (oPlateClean) {
              if (myTruck?.plate_number && (cleanStr(myTruck.plate_number) === oPlateClean || cleanStr(myTruck.plate_number).includes(oPlateClean) || oPlateClean.includes(cleanStr(myTruck.plate_number)))) return true;
              if (uEmailClean && (oPlateClean === uEmailClean || oPlateClean.includes(uEmailClean) || uEmailClean.includes(oPlateClean))) return true;
              if (uNameClean && (oPlateClean === uNameClean || oPlateClean.includes(uNameClean) || uNameClean.includes(oPlateClean))) return true;
              if (uPidClean && oPlateClean === uPidClean) return true;
            }

            // 3. Match by driver_id or companion_id
            if (o.driver_id) {
              if (o.driver_id === currentUser.id || (currentUser.personal_id && o.driver_id === currentUser.personal_id)) return true;
              if (myTruck?.driver_id && o.driver_id === myTruck.driver_id) return true;
              if (driverObj?.id && o.driver_id === driverObj.id) return true;
            }
            if (o.companion_id) {
              if (o.companion_id === currentUser.id || (currentUser.personal_id && o.companion_id === currentUser.personal_id)) return true;
              if (myTruck?.companion_id && o.companion_id === myTruck.companion_id) return true;
              if (companionObj?.id && o.companion_id === companionObj.id) return true;
            }

            // 4. Match by driver_name or companion_name
            if (o.driver_name && assignedDriverName && (cleanStr(o.driver_name) === cleanStr(assignedDriverName) || cleanStr(o.driver_name) === uNameClean)) return true;
            if (o.companion_name && assignedCompanionName && (cleanStr(o.companion_name) === cleanStr(assignedCompanionName) || cleanStr(o.companion_name) === uNameClean)) return true;

            return false;
          })
          .map(o => ({
            ...o,
            notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
          }));
      }
    } catch (e) {
      console.warn('Error fetching driver-specific orders:', e);
    }
  }

  // Fetch ONLY the vendors referenced by this driver's orders
  const vendorIds = Array.from(new Set(driverOrders.map(o => o.vendor_id).filter(Boolean)));
  let assignedVendors: Vendor[] = [];

  if (vendorIds.length > 0 && isSupabaseConfigured && supabase) {
    try {
      const [vRes, cRes] = await Promise.all([
        supabase.from('vendors').select('*').in('id', vendorIds).eq('is_deleted', false),
        supabase.from('vendor_contacts').select('*').in('vendor_id', vendorIds).eq('is_deleted', false)
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

  return {
    orders: driverOrders,
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
