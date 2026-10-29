import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Order, Vendor, User } from '../../types';
import { getLocal } from '../localStorage';
import { appCache } from '../../utils/cache';
import { sanitizePostgrestSearchTerm } from '../../utils/sanitize';
import { cleanUserUuid } from '../vendorService';
import {
  KEY_ORDERS,
  isDateTodayTbilisi,
  checkIsLogisticsManager,
  isValidUuid,
  PaginatedOrdersResult
} from './orderUtils';

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
    managerId?: string;
    salesManagerId?: string;
  },
  currentUser?: User | null
): Promise<PaginatedOrdersResult> {
  const isLogisticsManager = checkIsLogisticsManager(currentUser);
  const todayTbilisi = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());

  const effectiveFilters = { ...(filters || {}) };
  if (isLogisticsManager) {
    effectiveFilters.startDate = todayTbilisi;
    effectiveFilters.endDate = todayTbilisi;
  }

  const filterKey = JSON.stringify({ ...effectiveFilters, isLogisticsManager });
  const countCacheKey = `orders_count_${filterKey}`;
  const pageCacheKey = `orders_limit_${limit}_offset_${offset}_${filterKey}`;

  const cachedPage = appCache.get<PaginatedOrdersResult>(pageCacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const cachedCount = appCache.get<number>(countCacheKey);
  if (cachedCount !== null && offset >= cachedCount && cachedCount > 0) {
    return { orders: [], totalCount: cachedCount };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // If filtering by location / direction (properties on vendors table)
      const targetCity = effectiveFilters?.city;
      const targetDistrict = effectiveFilters?.district;
      const targetDirection = effectiveFilters?.direction || effectiveFilters?.directionId;
      const targetManager = effectiveFilters?.managerId || effectiveFilters?.salesManagerId;
      const hasVendorFilter = Boolean(targetCity || targetDistrict || targetDirection);

      const countConfig = cachedCount !== null ? {} : { count: 'exact' as const };
      const selectQuery = hasVendorFilter 
        ? '*, vendors!inner(id, manager_id, city, district, direction_id, trade_name, company_name, id_code, address)' 
        : '*';

      let query = supabase
        .from('orders')
        .select(selectQuery, countConfig)
        .eq('is_deleted', false);

      const safeTerm = sanitizePostgrestSearchTerm(effectiveFilters?.searchTerm);
      if (safeTerm) {
        const term = `%${safeTerm}%`;
        
        // Find matching vendor IDs by trade_name, company_name, or address with memory cache
        const vendorSearchCacheKey = `matched_vids_${safeTerm.toLowerCase()}`;
        let matchedVendorIds: string[] = appCache.get<string[]>(vendorSearchCacheKey) || [];
        if (!appCache.get(vendorSearchCacheKey)) {
          try {
            const { data: matchedVendors } = await supabase
              .from('vendors')
              .select('id')
              .or(`trade_name.ilike.${term},company_name.ilike.${term},address.ilike.${term}`)
              .eq('is_deleted', false)
              .limit(100);

            matchedVendorIds = (matchedVendors || []).map(v => v.id);
            appCache.set(vendorSearchCacheKey, matchedVendorIds);
          } catch (mErr) {
            console.warn('Matching vendors search error:', mErr);
          }
        }

        if (matchedVendorIds.length > 0) {
          // Guard against URL overflow if too many vendors matched the search term
          const cappedIds = matchedVendorIds.slice(0, 80);
          query = query.or(`doc_number.ilike.${term},vendor_id.in.(${cappedIds.join(',')})`);
        } else {
          query = query.ilike('doc_number', term);
        }
      }

      if (effectiveFilters?.status) {
        query = query.eq('status', effectiveFilters.status);
      }

      // Restrict query: if logistics_manager, strictly enforce current date
      if (isLogisticsManager) {
        query = query.gte('order_date', todayTbilisi).lte('order_date', todayTbilisi + 'T23:59:59.999Z');
      } else {
        if (effectiveFilters?.startDate) {
          query = query.gte('order_date', effectiveFilters.startDate);
        }
        if (effectiveFilters?.endDate) {
          query = query.lte('order_date', effectiveFilters.endDate + 'T23:59:59');
        }
      }

      if (targetCity) {
        query = query.eq('vendors.city', targetCity);
      }
      if (targetDistrict) {
        query = query.eq('vendors.district', targetDistrict);
      }
      if (targetDirection) {
        query = query.eq('vendors.direction_id', targetDirection);
      }
      if (targetManager) {
        const cleanedMgr = cleanUserUuid(targetManager) || targetManager;
        if (isValidUuid(cleanedMgr)) {
          query = query.or(`created_by.eq.${cleanedMgr},and(created_by.is.null,operator_id.eq.${cleanedMgr})`);
        }
      }

      const vehicleVal = filters?.vehicle || filters?.vehicleId;
      if (vehicleVal) {
        if (isValidUuid(vehicleVal)) {
          query = query.eq('vehicle_id', vehicleVal);
        } else {
          try {
            const { data: vData } = await supabase
              .from('vehicles')
              .select('id')
              .eq('plate_number', vehicleVal)
              .maybeSingle();

            if (vData?.id && isValidUuid(vData.id)) {
              query = query.eq('vehicle_id', vData.id);
            } else {
              const { data: tData } = await supabase
                .from('trucks')
                .select('id')
                .eq('plate_number', vehicleVal)
                .maybeSingle();
              if (tData?.id && isValidUuid(tData.id)) {
                query = query.eq('vehicle_id', tData.id);
              } else {
                query = query.eq('vehicle_id', '00000000-0000-0000-0000-000000000000');
              }
            }
          } catch {
            query = query.eq('vehicle_id', '00000000-0000-0000-0000-000000000000');
          }
        }
      }
      if (filters?.driverId && isValidUuid(filters.driverId)) {
        query = query.eq('driver_id', filters.driverId);
      }
      if (filters?.vendorId && isValidUuid(filters.vendorId)) {
        query = query.eq('vendor_id', filters.vendorId);
      }

      // Enforce scoping if current user is a supplier (vendor)
      if (currentUser?.role === 'vendor') {
        let supplierVendorId = currentUser.vendor_id;
        if (!supplierVendorId && currentUser.id && isSupabaseConfigured && supabase) {
          try {
            const { data: vRow } = await supabase
              .from('vendors')
              .select('id')
              .eq('user_id', currentUser.id)
              .eq('is_deleted', false)
              .maybeSingle();
            if (vRow?.id) {
              supplierVendorId = vRow.id;
            }
          } catch (vErr) {
            console.warn('Failed to resolve vendor_id for supplier user:', vErr);
          }
        }

        if (supplierVendorId && isValidUuid(supplierVendorId)) {
          query = query.eq('vendor_id', supplierVendorId);
        } else {
          return { orders: [], totalCount: 0 };
        }
      }

      query = query
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('order_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

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

        // Fetch vendor info for all vendor_ids present on this page in chunks
        const vendorIds = Array.from(new Set((data as any[]).map(item => item.vendor_id).filter(id => typeof id === 'string' && id.trim().length > 0)));
        const vendorMap = new Map<string, any>();
        if (vendorIds.length > 0) {
          try {
            const vendorChunks: string[][] = [];
            for (let i = 0; i < vendorIds.length; i += 35) {
              vendorChunks.push(vendorIds.slice(i, i + 35));
            }
            await Promise.all(vendorChunks.map(async (chunk) => {
              const { data: vendorsData } = await supabase
                .from('vendors')
                .select('id, trade_name, company_name, id_code, address, city, district, direction_id')
                .in('id', chunk);
              if (vendorsData) {
                vendorsData.forEach(v => {
                  vendorMap.set(v.id, v);
                  if (v.id) {
                    vendorMap.set(v.id.toLowerCase().trim(), v);
                  }
                });
              }
            }));
          } catch (vErr) {
            console.warn('Failed to prefetch vendors for orders page:', vErr);
          }
        }

        // Prefetch vehicle info for plate numbers in chunks
        const vehicleIds = Array.from(new Set((data as any[]).map(item => item.vehicle_id).filter(id => typeof id === 'string' && id.trim().length > 0)));
        const vehicleMap = new Map<string, string>();
        if (vehicleIds.length > 0) {
          try {
            const vhChunks: string[][] = [];
            for (let i = 0; i < vehicleIds.length; i += 35) {
              vhChunks.push(vehicleIds.slice(i, i + 35));
            }
            await Promise.all(vhChunks.map(async (chunk) => {
              const { data: vhData } = await supabase
                .from('vehicles')
                .select('id, plate_number')
                .in('id', chunk);
              if (vhData) {
                vhData.forEach(vh => {
                  if (vh.id) {
                    vehicleMap.set(vh.id, vh.plate_number);
                  }
                });
              }
            }));
          } catch (vhErr) {
            console.warn('Failed to prefetch vehicles for orders page:', vhErr);
          }
        }

        // Prefetch contact info for all orders on this page in chunks
        const contactIds = Array.from(new Set((data as any[]).map(item => item.contact_id).filter(id => typeof id === 'string' && id.trim().length > 0)));
        const contactMap = new Map<string, any>();
        if (contactIds.length > 0) {
          try {
            const contactChunks: string[][] = [];
            for (let i = 0; i < contactIds.length; i += 35) {
              contactChunks.push(contactIds.slice(i, i + 35));
            }
            await Promise.all(contactChunks.map(async (chunk) => {
              const { data: contactsData } = await supabase
                .from('vendor_contacts')
                .select('id, vendor_id, name, phone, is_default, position')
                .in('id', chunk);
              if (contactsData) {
                contactsData.forEach(c => {
                  contactMap.set(c.id, c);
                });
              }
            }));
          } catch (cErr) {
            console.warn('Failed to prefetch contacts by id for orders page:', cErr);
          }
        }

        // Also prefetch default contacts for vendors of orders that don't have a contact_id or if contact wasn't found in chunks
        const unresolvedVendorIds = Array.from(new Set(
          (data as any[])
            .filter(item => !item.contact_id || !contactMap.has(item.contact_id))
            .map(item => item.vendor_id)
            .filter(id => typeof id === 'string' && id.trim().length > 0)
        ));
        const vendorContactsMap = new Map<string, any[]>();
        if (unresolvedVendorIds.length > 0) {
          try {
            const unresChunks: string[][] = [];
            for (let i = 0; i < unresolvedVendorIds.length; i += 35) {
              unresChunks.push(unresolvedVendorIds.slice(i, i + 35));
            }
            await Promise.all(unresChunks.map(async (chunk) => {
              const { data: vContactsData } = await supabase
                .from('vendor_contacts')
                .select('id, vendor_id, name, phone, is_default, position')
                .in('vendor_id', chunk)
                .eq('is_deleted', false);
              if (vContactsData) {
                vContactsData.forEach(c => {
                  if (!vendorContactsMap.has(c.vendor_id)) {
                    vendorContactsMap.set(c.vendor_id, []);
                  }
                  vendorContactsMap.get(c.vendor_id)!.push(c);
                });
              }
            }));
          } catch (vcErr) {
            console.warn('Failed to prefetch contacts by vendor_id for orders page:', vcErr);
          }
        }

        const mapped = data.map((o: any) => {
          const v = o.vendor_id ? (vendorMap.get(o.vendor_id) || vendorMap.get(o.vendor_id?.toLowerCase?.().trim())) : null;
          const plate = o.truck_plate || (o.vehicle_id ? vehicleMap.get(o.vehicle_id) : '') || '';
          
          let c = o.contact_id ? contactMap.get(o.contact_id) : null;
          if (!c && o.vendor_id) {
            const vContacts = vendorContactsMap.get(o.vendor_id) || [];
            c = vContacts.find(item => item.is_default) || vContacts[0] || null;
          }

          return {
            ...o,
            contact: c || null,
            contact_name: c?.name || '',
            contact_phone: c?.phone || '',
            completed_at: o.completed_at || null,
            truck_plate: plate,
            vendor_name: o.vendor_name || o.vendors?.trade_name || o.vendors?.company_name || v?.trade_name || v?.company_name || '',
            address: o.address || v?.address || '',
            city: o.city || v?.city || '',
            district: o.district || v?.district || '',
            direction_id: o.direction_id || v?.direction_id || null,
            vendor: v || o.vendors || null,
            notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
          };
        });

        const finalOrders = isLogisticsManager 
          ? mapped.filter(o => isDateTodayTbilisi(o.order_date)) 
          : mapped;

        const result = {
          orders: finalOrders,
          totalCount: isLogisticsManager ? finalOrders.length : finalCount
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
  if (isLogisticsManager) {
    filtered = filtered.filter(item => isDateTodayTbilisi(item.order_date));
  } else {
    if (effectiveFilters?.startDate) {
      filtered = filtered.filter(item => !item.order_date || item.order_date >= effectiveFilters.startDate!);
    }
    if (effectiveFilters?.endDate) {
      filtered = filtered.filter(item => !item.order_date || item.order_date <= effectiveFilters.endDate! + 'T23:59:59');
    }
  }

  if (effectiveFilters?.searchTerm?.trim()) {
    const term = effectiveFilters.searchTerm.trim().toLowerCase();
    filtered = filtered.filter(o => {
      const docMatch = (o.doc_number || '').toLowerCase().includes(term);
      const vObj = vendorMap.get(o.vendor_id);
      const tradeMatch = (vObj?.trade_name || o.vendor_name || '').toLowerCase().includes(term);
      const companyMatch = (vObj?.company_name || '').toLowerCase().includes(term);
      const addressMatch = (vObj?.address || '').toLowerCase().includes(term);
      return docMatch || tradeMatch || companyMatch || addressMatch;
    });
  }
  if (effectiveFilters?.status) {
    filtered = filtered.filter(o => o.status === effectiveFilters.status);
  }
  if (effectiveFilters?.driverId) {
    filtered = filtered.filter(o => o.driver_id === effectiveFilters.driverId);
  }
  if (effectiveFilters?.vendorId) {
    filtered = filtered.filter(o => o.vendor_id === effectiveFilters.vendorId);
  }
  if (currentUser?.role === 'vendor') {
    const sVendorId = currentUser.vendor_id || localVendors.find(v => v.user_id === currentUser.id)?.id;
    if (sVendorId) {
      filtered = filtered.filter(o => o.vendor_id === sVendorId);
    } else {
      filtered = [];
    }
  }
  const vehicleVal = effectiveFilters?.vehicle || effectiveFilters?.vehicleId;
  if (vehicleVal) {
    filtered = filtered.filter(o => o.vehicle_id === vehicleVal || o.truck_plate === vehicleVal);
  }
  const targetMgr = effectiveFilters?.managerId || effectiveFilters?.salesManagerId;
  if (targetMgr) {
    const cleanedMgr = cleanUserUuid(targetMgr) || targetMgr;
    filtered = filtered.filter(o => {
      const creator = o.created_by || o.operator_id;
      return creator === cleanedMgr || creator === targetMgr;
    });
  }

  filtered.sort((a, b) => {
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (createdB !== createdA) return createdB - createdA;
    const orderA = a.order_date ? new Date(a.order_date).getTime() : 0;
    const orderB = b.order_date ? new Date(b.order_date).getTime() : 0;
    if (orderB !== orderA) return orderB - orderA;
    return (b.id || '').localeCompare(a.id || '');
  });

  return {
    orders: filtered.slice(offset, offset + limit),
    totalCount: filtered.length
  };
}

export async function getActiveOrdersCount(currentUser?: User | null): Promise<number> {
  const isLogisticsManager = checkIsLogisticsManager(currentUser);
  const todayTbilisi = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());

  if (isSupabaseConfigured && supabase) {
    try {
      let q = supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status', 'registered');

      if (isLogisticsManager) {
        q = q.gte('order_date', todayTbilisi).lte('order_date', todayTbilisi + 'T23:59:59.999Z');
      }

      const { count, error } = await q;

      if (!error && typeof count === 'number') {
        return count;
      }
    } catch (e) {
      console.warn('Supabase getActiveOrdersCount failed:', e);
    }
  }

  let localList = getLocal<Order[]>(KEY_ORDERS, []).filter(item => !item.is_deleted && item.status === 'registered');
  if (isLogisticsManager) {
    localList = localList.filter(item => isDateTodayTbilisi(item.order_date));
  }
  return localList.length;
}

export async function getOrders(limit = 1000, currentUser?: User | null): Promise<Order[]> {
  const isLogisticsManager = checkIsLogisticsManager(currentUser);
  const todayTbilisi = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());

  if (isSupabaseConfigured && supabase) {
    try {
      let q = supabase
        .from('orders')
        .select('*')
        .eq('is_deleted', false);

      if (isLogisticsManager) {
        q = q.gte('order_date', todayTbilisi).lte('order_date', todayTbilisi + 'T23:59:59.999Z');
      }

      const { data, error } = await q
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('order_date', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(limit);

      if (!error && data && data.length > 0) {
        // Retrieve cached reference maps without issuing secondary network queries
        const cachedVendorsMap = appCache.get<Map<string, any>>('vendors_map');
        const cachedWarehousesMap = appCache.get<Map<string, string>>('warehouses_map');
        const cachedVehiclesMap = appCache.get<Map<string, string>>('vehicles_map');

        const vendorMap = new Map<string, any>(cachedVendorsMap || []);
        const warehouseMap = new Map<string, string>(cachedWarehousesMap || []);
        const vehicleMap = new Map<string, string>(cachedVehiclesMap || []);

        // Fallback to local storage if in-memory cache has not initialized yet
        if (vendorMap.size === 0) {
          const localVendors = getLocal<Vendor[]>('vendors', []);
          localVendors.forEach(v => {
            if (v && v.id) {
              vendorMap.set(v.id, v);
              vendorMap.set(String(v.id).trim().toLowerCase(), v);
            }
          });
        }
        if (warehouseMap.size === 0) {
          const localWarehouses = getLocal<any[]>('warehouses', []);
          localWarehouses.forEach(w => {
            if (w && w.id) warehouseMap.set(w.id, w.name);
          });
        }
        if (vehicleMap.size === 0) {
          const localVehicles = getLocal<any[]>('vehicles', []);
          localVehicles.forEach(vh => {
            if (vh && vh.id) vehicleMap.set(vh.id, vh.plate_number);
          });
        }

        const mapped = data.map((o: any) => {
          const cleanVId = o.vendor_id ? String(o.vendor_id).trim().toLowerCase() : '';
          const v = o.vendor_id ? (vendorMap.get(o.vendor_id) || vendorMap.get(cleanVId)) : null;
          const targetWhId = o.warehouse_id || v?.warehouse_id;
          const wName = targetWhId ? warehouseMap.get(targetWhId) : null;
          const plate = o.truck_plate || (o.vehicle_id ? vehicleMap.get(o.vehicle_id) : '') || '';

          return {
            ...o,
            vendor: v || null,
            city: o.city || v?.city || '',
            district: o.district || v?.district || '',
            address: o.address || v?.address || '',
            manager_id: o.manager_id || v?.manager_id || null,
            truck_plate: plate,
            vendor_name: o.vendor_name || v?.trade_name || v?.company_name || '',
            warehouse_name: o.warehouse_name || wName || '',
            warehouse_id: o.warehouse_id || v?.warehouse_id || '',
            contact_name: o.contact_name || '',
            contact_phone: o.contact_phone || '',
            completed_at: o.completed_at || null,
            notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
          };
        });

        if (isLogisticsManager) {
          return mapped.filter(o => isDateTodayTbilisi(o.order_date));
        }
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase getOrders failed', e);
    }
  }

  let localOrders = getLocal<Order[]>(KEY_ORDERS, []).filter(item => !item.is_deleted);
  if (isLogisticsManager) {
    localOrders = localOrders.filter(item => isDateTodayTbilisi(item.order_date));
  }
  return localOrders.slice(0, limit).map((o: any) => ({
    ...o,
    notes: Array.isArray(o.notes) ? o.notes : (o.note ? [{ id: 'note-1', comment: o.note, date: o.order_date || new Date().toISOString(), user_name: 'System' }] : [])
  }));
}

export async function getSMSLogs(): Promise<any[]> {
  return getLocal<any[]>('biodiesel_sms_logs', []);
}
