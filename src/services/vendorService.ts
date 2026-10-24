import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vendor, VendorContact, City, District, Communication } from '../types';
import { trackChange } from './historyService';
import { KEY_VENDORS, KEY_CITIES, KEY_DISTRICTS, KEY_COMMUNICATIONS, getLocal, setLocal } from './localStorage';
import { appCache } from '../utils/cache';
import { notifyDbChange } from '../lib/realtime';
import { sanitizePostgrestSearchTerm } from '../utils/sanitize';

export { KEY_VENDORS };

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const cleanUserUuid = (val: string | null | undefined): string | null => {
  if (!val) return null;
  if (val === 'import') return 'import';
  if (val === 'user-admin') return '00000000-0000-4000-a000-000000000000';
  if (val.startsWith('user-')) {
    const suffix = val.substring(5).padEnd(11, '0').slice(0, 11);
    return `00000000-0000-4000-b000-${suffix}`.toLowerCase();
  }
  return val;
};

export function normalizePlannedWeekdays(val: any): number[] | null {
  if (!val) return null;
  if (Array.isArray(val)) {
    const nums = val.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 7);
    return nums.length > 0 ? Array.from(new Set(nums)).sort((a, b) => a - b) : null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parts = trimmed.slice(1, -1).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n >= 1 && n <= 7);
      return parts.length > 0 ? Array.from(new Set(parts)).sort((a, b) => a - b) : null;
    }
    const legacyMap: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7
    };
    if (legacyMap[trimmed]) {
      return [legacyMap[trimmed]];
    }
    const parsedNum = Number(trimmed);
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 7) {
      return [parsedNum];
    }
  }
  return null;
}

export function decodeVendorCustomFields(vendor: any): Vendor {
  const contacts = vendor.contacts || [];
  const customContact = contacts.find((c: any) => c.name === "__DYNAMIC_CUSTOM_FIELDS__");
  const cleanContacts = contacts.filter((c: any) => c.name !== "__DYNAMIC_CUSTOM_FIELDS__");
  
  const statusVal = vendor.status || 'Active';

  const decoded: Vendor = {
    ...vendor,
    planned_weekday: normalizePlannedWeekdays(vendor.planned_weekday) || undefined,
    status: statusVal,
    contacts: cleanContacts
  };

  if (customContact && customContact.note) {
    try {
      const parsed = JSON.parse(customContact.note);
      return {
        ...decoded,
        ...parsed
      };
    } catch (e) {
      console.error('Failed to parse dynamic custom fields', e);
    }
  }
  return decoded;
}

export function sortVendorContacts<T extends { is_default?: boolean | string | null; sort_order?: number | null }>(contacts: T[]): T[] {
  if (!contacts || contacts.length <= 1) return contacts || [];
  return [...contacts].sort((a, b) => {
    const aDef = a.is_default === true || (a.is_default as any) === 'true' || (a.is_default as any) === 1 || (a.is_default as any) === '1';
    const bDef = b.is_default === true || (b.is_default as any) === 'true' || (b.is_default as any) === 1 || (b.is_default as any) === '1';
    if (aDef && !bDef) return -1;
    if (!aDef && bDef) return 1;
    const aOrder = typeof a.sort_order === 'number' && !isNaN(a.sort_order) ? a.sort_order : 0;
    const bOrder = typeof b.sort_order === 'number' && !isNaN(b.sort_order) ? b.sort_order : 0;
    return bOrder - aOrder;
  });
}

const inFlightContacts = new Map<string, Promise<VendorContact[]>>();

// Fetch all contacts from vendor_contacts table with in-flight deduplication and memory caching
export async function getVendorContacts(vendorId?: string): Promise<VendorContact[]> {
  const cacheKey = vendorId ? `vendor_contacts_${vendorId}` : 'vendor_contacts_all';

  // 1. Check in-memory appCache first
  const cached = appCache.get<VendorContact[]>(cacheKey);
  if (cached !== null && cached !== undefined) {
    return cached;
  }

  // 2. In-flight promise deduplication
  if (inFlightContacts.has(cacheKey)) {
    return inFlightContacts.get(cacheKey)!;
  }

  const promise = (async () => {
    let resultContacts: VendorContact[] = [];
    if (isSupabaseConfigured && supabase) {
      try {
        if (vendorId) {
          const { data, error } = await supabase
            .from('vendor_contacts')
            .select('*')
            .eq('is_deleted', false)
            .eq('vendor_id', vendorId)
            .order('is_default', { ascending: false })
            .order('sort_order', { ascending: false })
            .order('id', { ascending: false });
          if (!error && data) {
            resultContacts = sortVendorContacts(data as any[]);
            appCache.set(cacheKey, resultContacts);
            return resultContacts;
          }
        } else {
          // Fetch all contacts in chunks to bypass 1000 row limit
          const CHUNK_SIZE = 1000;
          let from = 0;
          let hasMore = true;
          const allContacts: any[] = [];
          while (hasMore) {
            const { data, error } = await supabase
              .from('vendor_contacts')
              .select('*')
              .eq('is_deleted', false)
              .order('id')
              .range(from, from + CHUNK_SIZE - 1);
            if (error) {
              console.warn('Error fetching vendor contacts chunk:', error);
              break;
            }
            if (data && data.length > 0) {
              allContacts.push(...data);
              from += CHUNK_SIZE;
              if (data.length < CHUNK_SIZE) {
                hasMore = false;
              }
            } else {
              hasMore = false;
            }
          }
          if (allContacts.length > 0) {
            resultContacts = sortVendorContacts(allContacts);
            appCache.set(cacheKey, resultContacts);
            return resultContacts;
          }
        }
      } catch (e) {
        console.warn('Supabase getVendorContacts failed', e);
      }
    }
    // Local fallback
    const allContacts = getLocal<VendorContact[]>('local_vendor_contacts', []);
    const filtered = vendorId 
      ? allContacts.filter(c => c.vendor_id === vendorId && !c.is_deleted) 
      : allContacts.filter(c => !c.is_deleted);
    
    resultContacts = sortVendorContacts(filtered);
    appCache.set(cacheKey, resultContacts);
    return resultContacts;
  })();

  inFlightContacts.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightContacts.delete(cacheKey);
  }
}

export interface PaginatedVendorContactsResult {
  contacts: VendorContact[];
  totalCount: number;
}

const inFlightVendorContactsPaginated = new Map<string, Promise<PaginatedVendorContactsResult>>();

// Fetch paginated contacts for a specific vendor from vendor_contacts table
export async function getVendorContactsPaginated(
  vendorId: string,
  limit: number = 4,
  offset: number = 0
): Promise<PaginatedVendorContactsResult> {
  if (!vendorId) {
    return { contacts: [], totalCount: 0 };
  }

  const countCacheKey = `count_vendor_contacts_${vendorId}`;
  const pageCacheKey = `vendor_contacts_${vendorId}_limit_${limit}_offset_${offset}`;

  const cachedPage = appCache.get<PaginatedVendorContactsResult>(pageCacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const cachedCount = appCache.get<number>(countCacheKey);
  if (cachedCount !== null && offset >= cachedCount && cachedCount > 0) {
    return { contacts: [], totalCount: cachedCount };
  }

  if (inFlightVendorContactsPaginated.has(pageCacheKey)) {
    return inFlightVendorContactsPaginated.get(pageCacheKey)!;
  }

  const promise = (async (): Promise<PaginatedVendorContactsResult> => {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('vendor_contacts')
          .select('*', cachedCount !== null ? {} : { count: 'exact' })
          .eq('is_deleted', false)
          .eq('vendor_id', vendorId)
          .order('is_default', { ascending: false })
          .order('sort_order', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + limit - 1);

        const { data, count, error } = await query;

        if (!error && data) {
          const finalCount = cachedCount !== null ? cachedCount : (count || 0);
          if (cachedCount === null && count !== null) {
            appCache.set(countCacheKey, count);
          }

          const sorted = sortVendorContacts(data as any[]);

          const result: PaginatedVendorContactsResult = {
            contacts: sorted,
            totalCount: finalCount
          };

          appCache.set(pageCacheKey, result);
          return result;
        }
      } catch (e) {
        console.warn('Supabase getVendorContactsPaginated failed', e);
      }
    }

    // Local fallback
    const allContacts = getLocal<VendorContact[]>('local_vendor_contacts', []);
    const filtered = allContacts.filter(c => c.vendor_id === vendorId && !c.is_deleted);
    const sorted = sortVendorContacts(filtered);

    const sliced = sorted.slice(offset, offset + limit);
    const result: PaginatedVendorContactsResult = {
      contacts: sliced,
      totalCount: sorted.length
    };
    appCache.set(pageCacheKey, result);
    return result;
  })();

  inFlightVendorContactsPaginated.set(pageCacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightVendorContactsPaginated.delete(pageCacheKey);
  }
}

// Save/update all contacts for a specific vendor
export async function saveVendorContacts(vendorId: string, contacts: VendorContact[], currentUserId?: string): Promise<void> {
  notifyDbChange('vendor_contacts', 'UPDATE', vendorId);
  appCache.clear('contacts_');
  appCache.clear('vendor_contacts_');
  appCache.clear('count_vendor_contacts_');

  // Ensure contacts are properly sorted with primary first before saving
  const sortedContacts = sortVendorContacts(contacts);

  if (isSupabaseConfigured && supabase) {
    try {
      // Find contacts currently in DB to detect which ones were deleted
      const { data: currentDb } = await supabase.from('vendor_contacts').select('id').eq('vendor_id', vendorId).eq('is_deleted', false);
      const incomingIds = sortedContacts.map(c => c.id).filter(Boolean);
      
      if (currentDb && currentDb.length > 0) {
        const deletedIds = currentDb.filter(c => !incomingIds.includes(c.id)).map(c => c.id);
        if (deletedIds.length > 0) {
          await supabase.from('vendor_contacts').update({ is_deleted: true }).in('id', deletedIds);
        }
      }

      // Upsert current list
      if (sortedContacts.length > 0) {
        const payloads = sortedContacts.map((c, idx) => ({
          id: c.id || generateUuid(),
          vendor_id: vendorId,
          name: c.name || '',
          phone: c.phone || '',
          position: c.position || 'other',
          note: c.note || '',
          email: c.email || '',
          is_default: !!(c.is_default === true || (c.is_default as any) === 'true'),
          is_active: c.is_active !== false,
          sort_order: typeof c.sort_order === 'number' && !isNaN(c.sort_order) ? c.sort_order : (sortedContacts.length - idx),
          created_by: cleanUserUuid(c.created_by || currentUserId) || null,
          is_deleted: false
        }));

        const { error } = await supabase.from('vendor_contacts').upsert(payloads, { onConflict: 'id' });
        if (error) {
          console.error('Supabase saveVendorContacts upsert error:', error);
          throw error;
        }
      }
    } catch (e) {
      console.error('Supabase saveVendorContacts failed', e);
      throw e;
    }
  }

  // Local fallback
  const localContacts = getLocal<VendorContact[]>('local_vendor_contacts', []);
  const otherContacts = localContacts.filter(c => c.vendor_id !== vendorId);
  const updatedPayloads = sortedContacts.map((c, idx) => ({
    ...c,
    vendor_id: vendorId,
    is_default: !!(c.is_default === true || (c.is_default as any) === 'true'),
    is_active: c.is_active !== false,
    sort_order: typeof c.sort_order === 'number' && !isNaN(c.sort_order) ? c.sort_order : (sortedContacts.length - idx)
  }));
  setLocal('local_vendor_contacts', [...otherContacts, ...updatedPayloads]);
}

export interface PaginatedContactsResult {
  contacts: any[];
  totalCount: number;
}

// Fetch paginated contacts from vendor_contacts table with relation join to vendors
export async function getContactsPaginated(
  limit: number = 12,
  offset: number = 0,
  searchTerm: string = ''
): Promise<PaginatedContactsResult> {
  const filterKey = `search_${searchTerm.trim().toLowerCase()}`;
  const countCacheKey = `count_contacts_${filterKey}`;
  const pageCacheKey = `contacts_limit_${limit}_offset_${offset}_${filterKey}`;

  const cachedPage = appCache.get<PaginatedContactsResult>(pageCacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const cachedCount = appCache.get<number>(countCacheKey);
  if (cachedCount !== null && offset >= cachedCount && cachedCount > 0) {
    return { contacts: [], totalCount: cachedCount };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // Retrieve contacts flat without heavy embedded join, using cached count
      let query = supabase
        .from('vendor_contacts')
        .select('*', cachedCount !== null ? {} : { count: 'exact' })
        .eq('is_deleted', false);

      const safeSearch = sanitizePostgrestSearchTerm(searchTerm);
      if (safeSearch) {
        const term = `%${safeSearch}%`;

        // Search in vendors as well so user can search by company name, trade name or code
        let matchedVendorIds: string[] = [];
        try {
          const { data: matchedVendors } = await supabase
            .from('vendors')
            .select('id')
            .or(`trade_name.ilike.${term},company_name.ilike.${term},company_code.ilike.${term},id_code.ilike.${term}`);
          matchedVendorIds = (matchedVendors || []).map(v => v.id).filter(Boolean);
        } catch {
          // ignore error in vendor search lookup
        }

        if (matchedVendorIds.length > 0) {
          query = query.or(`name.ilike.${term},phone.ilike.${term},position.ilike.${term},email.ilike.${term},note.ilike.${term},vendor_id.in.(${matchedVendorIds.join(',')})`);
        } else {
          query = query.or(`name.ilike.${term},phone.ilike.${term},position.ilike.${term},email.ilike.${term},note.ilike.${term}`);
        }
      }

      // Always arrange is_default first, then other contacts descending by sort_order
      query = query
        .order('is_default', { ascending: false })
        .order('sort_order', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) {
        if (error.code === 'PGRST103' || error.message?.toLowerCase().includes('satisfiable')) {
          return { contacts: [], totalCount: cachedCount || 0 };
        }
        console.error('Supabase getContactsPaginated error', error);
      }

      if (!error && data) {
        const finalCount = cachedCount !== null ? cachedCount : (count || 0);
        if (cachedCount === null && count !== null) {
          appCache.set(countCacheKey, count);
        }

        // Fetch vendor info efficiently for only the vendor_ids present on this page
        const vendorIds = Array.from(new Set((data as any[]).map(item => item.vendor_id).filter(Boolean)));
        const vendorsMap = new Map<string, any>();
        if (vendorIds.length > 0) {
          try {
            const { data: vendorsData } = await supabase
              .from('vendors')
              .select('id, trade_name, company_name, company_code, id_code, address, city, district, direction_id')
              .in('id', vendorIds);
            if (vendorsData) {
              vendorsData.forEach(v => {
                vendorsMap.set(v.id, v);
                if (v.id) {
                  vendorsMap.set(String(v.id).toLowerCase().trim(), v);
                }
              });
            }
          } catch (vErr) {
            console.warn('Failed to prefetch vendors for contacts page:', vErr);
          }
        }

        const mapped = (data as any[]).map(item => {
          const cleanId = item.vendor_id ? String(item.vendor_id).toLowerCase().trim() : '';
          const v = item.vendor_id ? (vendorsMap.get(item.vendor_id) || (cleanId ? vendorsMap.get(cleanId) : null)) : null;
          const tradeOrCompName = v ? (v.trade_name || v.company_name || '-') : '-';
          const compCode = v ? (v.company_code || v.id_code || '-') : '-';

          return {
            id: item.id,
            vendor_id: item.vendor_id,
            name: item.name,
            phone: item.phone,
            position: item.position,
            note: item.note,
            email: item.email,
            is_default: item.is_default,
            is_active: item.is_active !== false,
            sort_order: item.sort_order,
            company_name: tradeOrCompName,
            vendor_name: v?.trade_name || v?.company_name || '',
            company_code: compCode,
            vendor: v ? decodeVendorCustomFields(v) : undefined
          };
        });
        const result = {
          contacts: mapped,
          totalCount: finalCount
        };
        appCache.set(pageCacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('Supabase getContactsPaginated failed', e);
    }
  }

  // Local fallback
  const allContacts = getLocal<VendorContact[]>('local_vendor_contacts', []).filter(c => !c.is_deleted);
  const localVendors = getLocal<Vendor[]>(KEY_VENDORS, []).filter(v => !v.is_deleted);
  
  const mappedContacts = allContacts.map(c => {
    const cleanId = String(c.vendor_id || '').toLowerCase().trim();
    const v = localVendors.find(vend => vend.id === c.vendor_id || (vend.id && String(vend.id).toLowerCase().trim() === cleanId));
    return {
      ...c,
      is_active: c.is_active !== false,
      company_name: v ? (v.trade_name || v.company_name || '-') : '-',
      vendor_name: v?.trade_name || v?.company_name || '',
      company_code: v ? (v.company_code || v.id_code || '-') : '-',
      vendor: v
    };
  });

  const filtered = mappedContacts.filter(c => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term) ||
      (c.email || '').toLowerCase().includes(term) ||
      c.position.toLowerCase().includes(term) ||
      c.company_name.toLowerCase().includes(term) ||
      c.company_code.toLowerCase().includes(term)
    );
  });

  filtered.sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return (b.sort_order || 0) - (a.sort_order || 0);
  });

  const result = {
    contacts: filtered.slice(offset, offset + limit),
    totalCount: filtered.length
  };
  appCache.set(pageCacheKey, result);
  return result;
}

export interface PaginatedVendorsResult {
  vendors: Vendor[];
  totalCount: number;
}

export async function getVendorsPaginated(
  limit: number = 12,
  offset: number = 0,
  filters?: {
    searchTerm?: string;
    city?: string;
    district?: string;
    managerId?: string;
    operatorId?: string;
    directionId?: string;
    hasBankAccount?: string;
  },
  options?: {
    includeContacts?: boolean;
  }
): Promise<PaginatedVendorsResult> {
  const filterKey = JSON.stringify({ filters: filters || {}, options: options || {} });
  const countCacheKey = `count_vendors_${JSON.stringify(filters || {})}`;
  const pageCacheKey = `vendors_limit_${limit}_offset_${offset}_${filterKey}`;

  const cachedPage = appCache.get<PaginatedVendorsResult>(pageCacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const cachedCount = appCache.get<number>(countCacheKey);
  if (cachedCount !== null && offset >= cachedCount && cachedCount > 0) {
    return { vendors: [], totalCount: cachedCount };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('vendors')
        .select('*', cachedCount !== null ? {} : { count: 'exact' })
        .eq('is_deleted', false);

      const safeTerm = sanitizePostgrestSearchTerm(filters?.searchTerm);
      if (safeTerm) {
        const term = `%${safeTerm}%`;
        const digitsOnly = safeTerm.replace(/[^0-9]/g, '');

        let matchedVendorIds: string[] = [];
        // Only search contacts phone numbers if the user typed at least 3 digits (e.g., phone numbers).
        // If the user typed letters/words (e.g. Georgian letters), skip querying contacts by phone completely.
        if (digitsOnly.length >= 3) {
          try {
            let contactSearch = supabase
              .from('vendor_contacts')
              .select('vendor_id')
              .eq('is_deleted', false)
              .eq('is_active', true);

            contactSearch = contactSearch.or(`phone.ilike.${term},phone.ilike.%${digitsOnly}%`);

            // Logical limit scaled to search page size instead of fetching 500 rows
            const contactLimit = Math.max(5, Math.min(limit * 2, 20));
            const { data: matchedContacts } = await contactSearch.limit(contactLimit);
            if (matchedContacts && matchedContacts.length > 0) {
              matchedVendorIds = Array.from(new Set(matchedContacts.map(c => c.vendor_id).filter(Boolean)));
            }
          } catch (cErr) {
            console.warn('Supabase vendor_contacts phone search failed:', cErr);
          }
        }

        if (matchedVendorIds.length > 0) {
          query = query.or(`trade_name.ilike.${term},company_name.ilike.${term},id_code.ilike.${term},company_code.ilike.${term},address.ilike.${term},id.in.(${matchedVendorIds.join(',')})`);
        } else {
          query = query.or(`trade_name.ilike.${term},company_name.ilike.${term},id_code.ilike.${term},company_code.ilike.${term},address.ilike.${term}`);
        }
      }
      if (filters?.city) {
        const localCities = getLocal<City[]>(KEY_CITIES, []);
        const cObj = localCities.find(c => c.id === filters.city || c.name === filters.city);
        if (cObj && cObj.id !== cObj.name) {
          query = query.or(`city.eq.${cObj.id},city.eq.${cObj.name}`);
        } else {
          query = query.eq('city', filters.city);
        }
      }
      if (filters?.district) {
        const localDistricts = getLocal<District[]>(KEY_DISTRICTS, []);
        const dObj = localDistricts.find(d => d.id === filters.district || d.name === filters.district);
        if (dObj && dObj.id !== dObj.name) {
          query = query.or(`district.eq.${dObj.id},district.eq.${dObj.name}`);
        } else {
          query = query.eq('district', filters.district);
        }
      }
      if (filters?.managerId) {
        query = query.eq('manager_id', filters.managerId);
      }
      if (filters?.operatorId) {
        query = query.eq('operator_id', filters.operatorId);
      }
      if (filters?.directionId) {
        query = query.eq('direction_id', filters.directionId);
      }
      if (filters?.hasBankAccount === 'has') {
        query = query.not('bank_account', 'is', null).neq('bank_account', '');
      } else if (filters?.hasBankAccount === 'has_not') {
        query = query.or('bank_account.is.null,bank_account.eq.');
      }

      query = query.order('trade_name', { ascending: true }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;

      if (error) {
        if (error.code === 'PGRST103' || error.message?.toLowerCase().includes('satisfiable')) {
          return { vendors: [], totalCount: cachedCount || 0 };
        }
        console.error('Supabase getVendorsPaginated error', error);
      }

      if (!error && data) {
        const finalCount = cachedCount !== null ? cachedCount : (count || 0);
        if (cachedCount === null && count !== null) {
          appCache.set(countCacheKey, count);
        }

        const decoded = data.map(v => decodeVendorCustomFields(v));
        const vendorIds = decoded.map(v => v.id);
        if (vendorIds.length > 0) {
          let contactsData: VendorContact[] | null = null;
          let commsData: Communication[] | null = null;

          if (options?.includeContacts !== false) {
            const { data: cData } = await supabase
              .from('vendor_contacts')
              .select('id, vendor_id, name, phone, position, note, email, is_default, is_active, sort_order')
              .in('vendor_id', vendorIds)
              .eq('is_deleted', false);
            contactsData = (cData as VendorContact[]) || null;
          }

          const { data: cmData } = await supabase
            .from('communications')
            .select('*')
            .in('vendor_id', vendorIds)
            .eq('is_deleted', false)
            .order('date_time', { ascending: false });
          commsData = (cmData as Communication[]) || null;

          if (contactsData) {
            decoded.forEach(v => {
              const vContacts = sortVendorContacts<VendorContact>(contactsData!.filter(c => c.vendor_id === v.id));
              v.contacts = vContacts;
              if (v.id) {
                appCache.set(`vendor_contacts_${v.id}`, vContacts);
              }
            });
          }

          if (commsData) {
            decoded.forEach(v => {
              v.communications = commsData!.filter(c => c.vendor_id === v.id);
            });
          }
        }
        const result = {
          vendors: decoded,
          totalCount: finalCount
        };
        appCache.set(pageCacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('Supabase getVendorsPaginated failed', e);
    }
  }

  const all = getLocal<Vendor[]>(KEY_VENDORS, []).filter(v => !v.is_deleted).map(v => decodeVendorCustomFields(v));
  const allContacts = getLocal<VendorContact[]>('local_vendor_contacts', []).filter(c => !c.is_deleted);
  const allComms = getLocal<Communication[]>(KEY_COMMUNICATIONS, []).filter(c => !c.is_deleted);
  all.forEach(v => {
    v.contacts = sortVendorContacts(allContacts.filter(c => c.vendor_id === v.id));
    v.communications = allComms.filter(c => c.vendor_id === v.id).sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
  });

  let filtered = all;
  if (filters?.searchTerm?.trim()) {
    const rawTerm = filters.searchTerm.trim().toLowerCase();
    const digitsOnly = rawTerm.replace(/[^0-9]/g, '');
    filtered = filtered.filter(v => {
      const matchDirect = 
        (v.trade_name || '').toLowerCase().includes(rawTerm) || 
        (v.company_name || '').toLowerCase().includes(rawTerm) ||
        (v.company_code || '').toLowerCase().includes(rawTerm) ||
        (v.id_code || '').toLowerCase().includes(rawTerm) ||
        (v.address || '').toLowerCase().includes(rawTerm);
      if (matchDirect) return true;

      // Check active contacts only
      const activeContacts = (v.contacts || []).filter(c => !c.is_deleted && c.is_active !== false);
      return activeContacts.some(c => {
        const phone = (c.phone || '').toLowerCase();
        const pDigits = phone.replace(/[^0-9]/g, '');
        return phone.includes(rawTerm) || (digitsOnly.length >= 3 && pDigits.includes(digitsOnly));
      });
    });
  }
  if (filters?.managerId) {
    filtered = filtered.filter(v => v.manager_id === filters.managerId);
  }
  if (filters?.hasBankAccount === 'has') {
    filtered = filtered.filter(v => typeof v.bank_account === 'string' && v.bank_account.trim().length > 0);
  } else if (filters?.hasBankAccount === 'has_not') {
    filtered = filtered.filter(v => !v.bank_account || !v.bank_account.trim());
  }
  return {
    vendors: filtered.slice(offset, offset + limit),
    totalCount: filtered.length
  };
}

const inFlightVendorById = new Map<string, Promise<Vendor | null>>();

export async function getVendorById(id: string): Promise<Vendor | null> {
  if (!id) return null;
  const cacheKey = `vendor_${id}`;
  const cached = appCache.get<Vendor>(cacheKey);
  if (cached) {
    return cached;
  }
  if (inFlightVendorById.has(id)) {
    return inFlightVendorById.get(id)!;
  }

  const promise = (async (): Promise<Vendor | null> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('vendors').select('*').eq('id', id).single();
        if (!error && data) {
          const decoded = decodeVendorCustomFields(data);
          const contacts = await getVendorContacts(id);
          decoded.contacts = contacts;
          appCache.set(cacheKey, decoded);
          return decoded;
        }
      } catch (e) {
        console.warn('Supabase getVendorById failed:', e);
      }
    }
    const localVendors = getLocal<Vendor[]>(KEY_VENDORS, []);
    const found = localVendors.find(v => v.id === id || String(v.id).toLowerCase().trim() === String(id).toLowerCase().trim());
    if (found) {
      const contacts = await getVendorContacts(id);
      const res = { ...decodeVendorCustomFields(found), contacts };
      appCache.set(cacheKey, res);
      return res;
    }
    return null;
  })();

  inFlightVendorById.set(id, promise);
  try {
    return await promise;
  } finally {
    inFlightVendorById.delete(id);
  }
}

export async function getVendors(limit = 250): Promise<Vendor[]> {
  let vendors: Vendor[] = [];
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_deleted', false)
        .order('trade_name', { ascending: true })
        .limit(limit);

      if (!error && data && data.length > 0) {
        vendors = data.map(v => decodeVendorCustomFields(v));
      }
    } catch (e) {
      console.warn('Supabase getVendors failed', e);
    }
  }
  if (vendors.length === 0) {
    vendors = getLocal<Vendor[]>(KEY_VENDORS, []).filter(item => !item.is_deleted).slice(0, limit).map(v => decodeVendorCustomFields(v));
  }

  // Populate default contacts array safely without downloading entire contacts table
  const vendorMap = new Map<string, any>();
  vendors.forEach(v => {
    v.contacts = v.contacts || [];
    if (v && v.id) {
      vendorMap.set(v.id, v);
      vendorMap.set(String(v.id).trim().toLowerCase(), v);
    }
  });

  // Cache vendors in memory for fast synchronous enrichment
  appCache.set('vendors_list', vendors);
  appCache.set('vendors_map', vendorMap);

  return vendors;
}

/**
 * Computes the next free numeric company_code that is not in use by any active vendor.
 * Finds the lowest missing positive integer starting from 1 (continuous 1..1500 sequence, ignoring outliers like 10001).
 */
export async function computeNextFreeCompanyCode(excludeVendorId?: string, cachedVendors?: Vendor[]): Promise<string> {
  let existingCodes: string[] = [];

  // 1. Check provided in-memory list (0 ms, 0 network payload)
  if (cachedVendors && cachedVendors.length > 0) {
    existingCodes = cachedVendors
      .filter(v => !v.is_deleted && v.id !== excludeVendorId)
      .map(v => (v.company_code || '').toString().trim())
      .filter(Boolean);
  }

  // 2. Check appCache in-memory vendors
  if (existingCodes.length === 0) {
    const memVendors = appCache.get<Vendor[]>('vendors_list');
    if (memVendors && memVendors.length > 0) {
      existingCodes = memVendors
        .filter(v => !v.is_deleted && v.id !== excludeVendorId)
        .map(v => (v.company_code || '').toString().trim())
        .filter(Boolean);
    }
  }

  // 3. Check local storage cache
  if (existingCodes.length === 0) {
    const localVendors = getLocal<Vendor[]>(KEY_VENDORS, []);
    if (localVendors && localVendors.length > 0) {
      existingCodes = localVendors
        .filter(v => !v.is_deleted && v.id !== excludeVendorId)
        .map(v => (v.company_code || '').toString().trim())
        .filter(Boolean);
    }
  }

  // 4. Fallback to Supabase if local state is completely empty: select ONLY company_code column
  if (existingCodes.length === 0 && isSupabaseConfigured && supabase) {
    try {
      let q = supabase
        .from('vendors')
        .select('company_code')
        .eq('is_deleted', false);
      if (excludeVendorId) {
        q = q.neq('id', excludeVendorId);
      }
      const { data } = await q;
      if (data) {
        existingCodes = data
          .map(v => (v.company_code || '').toString().trim())
          .filter(Boolean);
      }
    } catch (e) {
      console.warn('Failed to fetch existing codes for next code calculation:', e);
    }
  }

  // Extract all pure positive integer numbers into a Set
  const numSet = new Set<number>();
  for (const c of existingCodes) {
    const match = c.match(/^(\d+)$/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (parsed > 0) {
        numSet.add(parsed);
      }
    }
  }

  // Find the lowest available positive integer starting from 1 (MEX algorithm)
  // e.g. for continuous sequence 1..1500, candidate will reach 1501 and return 1501 even if 10001 exists
  let candidate = 1;
  while (numSet.has(candidate)) {
    candidate++;
  }

  return String(candidate);
}

/**
 * Verifies if a given company_code is already assigned to another vendor in Supabase or local storage.
 * Prioritizes local in-memory checks and uses indexed exact queries instead of expensive ilike table scans.
 */
export async function checkCompanyCodeDuplicate(code: string, currentVendorId?: string, cachedVendors?: Vendor[]): Promise<boolean> {
  const cleanCode = (code || '').trim().toLowerCase();
  if (!cleanCode) return false;

  // 1. Fast in-memory check (0 ms, 0 network overhead)
  const candidateVendors = (cachedVendors && cachedVendors.length > 0)
    ? cachedVendors
    : (appCache.get<Vendor[]>('vendors_list') || getLocal<Vendor[]>(KEY_VENDORS, []));

  if (candidateVendors && candidateVendors.length > 0) {
    const match = candidateVendors.find(v => 
      !v.is_deleted &&
      v.id !== currentVendorId &&
      (v.company_code || '').toString().trim().toLowerCase() === cleanCode
    );
    if (match) {
      return true;
    }
  }

  // 2. Fast indexed query in Supabase (exact equality with limit 1, uses B-tree index)
  if (isSupabaseConfigured && supabase) {
    try {
      let q = supabase
        .from('vendors')
        .select('id')
        .eq('is_deleted', false)
        .eq('company_code', (code || '').trim())
        .limit(1);

      if (currentVendorId) {
        q = q.neq('id', currentVendorId);
      }

      const { data, error } = await q;
      if (!error && data && data.length > 0) {
        return true;
      }
    } catch (e) {
      console.warn('Supabase checkCompanyCodeDuplicate error:', e);
    }
  }

  return false;
}

export function cleanVendorDbPayload(vendor: any): any {
  const isValidUuid = (val: string | null | undefined): boolean => {
    if (!val) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  };

  const cleanUserUuid = (val: string | null | undefined): string | null => {
    if (!val) return null;
    if (val === 'user-admin') return '00000000-0000-4000-a000-000000000000';
    if (val.startsWith('user-')) {
      const suffix = val.substring(5).padEnd(11, '0').slice(0, 11);
      return `00000000-0000-4000-b000-${suffix}`.toLowerCase();
    }
    return val;
  };

  const managerId = cleanUserUuid(vendor.manager_id);
  const operatorId = cleanUserUuid(vendor.operator_id);
  const createdByRaw = vendor.created_by;
  const createdBy = createdByRaw === 'import' ? 'import' : (isValidUuid(cleanUserUuid(createdByRaw)) ? cleanUserUuid(createdByRaw) : (createdByRaw || null));
  const vId = vendor.id || generateUuid();
  const rawCompCode = (vendor.company_code || '').toString().trim();
  const rawIdCode = (vendor.id_code || '').toString().trim();
  const finalCompCode = rawCompCode || (rawIdCode && rawIdCode !== '204857392' ? rawIdCode : `CC-${vId.slice(-8)}`);

  const str = (val: any): string => typeof val === 'string' ? val.trim() : (val || '');

  const payload: any = {
    id: vId,
    id_code: str(vendor.id_code),
    company_name: str(vendor.company_name),
    trade_name: str(vendor.trade_name),
    company_code: str(finalCompCode),
    bank_account: str(vendor.bank_account),
    email: str(vendor.email),
    city: str(vendor.city),
    district: str(vendor.district),
    address: str(vendor.address),
    price_per_liter: Number(vendor.price_per_liter) || 0,
    warehouse_id: vendor.warehouse_id || null,
    manager_id: isValidUuid(managerId) ? managerId : null,
    operator_id: isValidUuid(operatorId) ? operatorId : null,
    direction_id: vendor.direction_id || null,
    working_hours: str(vendor.working_hours),
    comments: Array.isArray(vendor.comments) ? vendor.comments : [],
    status: vendor.status || 'Active',
    is_deleted: !!vendor.is_deleted,
    created_at: vendor.created_at || new Date().toISOString(),
    created_by: isValidUuid(createdBy) ? createdBy : null,
    user_id: vendor.user_id || null,
    username: vendor.username || null,
    overdue_threshold_days: (vendor.overdue_threshold_days === undefined || vendor.overdue_threshold_days === null || vendor.overdue_threshold_days === '') ? null : Number(vendor.overdue_threshold_days),
    last_order_date: vendor.last_order_date || null,
    is_planned: vendor.is_planned !== undefined ? !!vendor.is_planned : false,
    planned_weekday: normalizePlannedWeekdays(vendor.planned_weekday),
    frequency_weeks: vendor.frequency_weeks ? Number(vendor.frequency_weeks) : 1,
    tanks_to_bring: Number(vendor.tanks_to_bring) || 0,
    tanks_to_leave: Number(vendor.tanks_to_leave) || 0,
    latitude: (vendor.latitude !== undefined && vendor.latitude !== null && vendor.latitude !== '') ? Number(vendor.latitude) : null,
    longitude: (vendor.longitude !== undefined && vendor.longitude !== null && vendor.longitude !== '') ? Number(vendor.longitude) : null
  };

  // Explicitly strip redundant and moved columns from payload
  delete payload.contacts;
  delete payload.is_active;
  delete payload.last_pickup_date;
  delete payload.average_interval_days;

  // Preserve any custom column fields on the actual DB payload!
  Object.keys(vendor).forEach(key => {
    if (key.startsWith('custom_')) {
      payload[key] = vendor[key] !== undefined ? vendor[key] : null;
    }
  });

  return payload;
}

export async function createDatabaseColumn(columnName: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      console.log('Provisioning vendor custom column via RPC:', columnName);
      const { error } = await supabase.rpc('add_custom_column_to_vendors', { column_name: columnName, column_type: 'TEXT' });
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

export async function saveVendor(
  vendor: Vendor,
  loggerName: string,
  currentUserId?: string,
  currentUserRole?: string
): Promise<Vendor> {
  const list = getLocal<Vendor[]>(KEY_VENDORS, []);
  let isNew = !vendor.id;

  // If vendor.id is provided, verify whether this vendor actually exists in DB or local store.
  // If it does not exist, it MUST be treated as a new vendor (insert) so the vendor record
  // is inserted into 'vendors' before child records like 'vendor_contacts' reference it.
  if (!isNew && vendor.id) {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: existingVendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('id', vendor.id)
          .maybeSingle();
        if (!existingVendor) {
          isNew = true;
        }
      } catch (err) {
        console.warn('Failed to verify vendor existence in Supabase:', err);
        const existsInLocal = list.some(item => item.id === vendor.id);
        if (!existsInLocal) {
          isNew = true;
        }
      }
    } else {
      const existsInLocal = list.some(item => item.id === vendor.id);
      if (!existsInLocal) {
        isNew = true;
      }
    }
  }

  const vId = isNew ? (vendor.id || generateUuid()) : vendor.id;
  const rawCompCode = (vendor.company_code || '').toString().trim();
  const rawIdCode = (vendor.id_code || '').toString().trim();
  const finalCompCode = rawCompCode || (rawIdCode && rawIdCode !== '204857392' ? rawIdCode : `CC-${vId.slice(-8)}`);

  const finalVendor = {
    ...vendor,
    id: vId,
    company_code: finalCompCode,
    manager_id: cleanUserUuid(vendor.manager_id),
    operator_id: cleanUserUuid(vendor.operator_id),
    created_by: vendor.created_by === 'import' ? 'import' : (isNew ? cleanUserUuid(currentUserId || vendor.created_by) : cleanUserUuid(vendor.created_by || currentUserId)),
    created_at: vendor.created_at || new Date().toISOString()
  };

  // Ensure contact lists are clean of old system indicator
  let cleanContacts = (finalVendor.contacts || []).filter(c => c.name !== "__DYNAMIC_CUSTOM_FIELDS__");
  finalVendor.contacts = cleanContacts;

  if (isSupabaseConfigured && supabase) {
    try {
      // Determine if acting user is an operator
      let isOperator = currentUserRole === 'operator';
      if (!isOperator && supabase) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const uid = sessionData.session?.user?.id;
          const role = sessionData.session?.user?.app_metadata?.role || sessionData.session?.user?.user_metadata?.role;
          if (role === 'operator') {
            isOperator = true;
          } else if (!role && uid) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
            if (profile?.role === 'operator') {
              isOperator = true;
            }
          }
        } catch {
          // ignore session retrieval error
        }
      }

      if (isNew) {
        const dbPayload = cleanVendorDbPayload(finalVendor);
        const { error } = await supabase.from('vendors').insert([dbPayload]);
        if (error) {
          console.error('Supabase insert error details:', error);
          if ((error as any).code === '23505') {
            console.warn('Skipping duplicate company_code conflict in Supabase:', finalCompCode);
            return decodeVendorCustomFields(finalVendor);
          }
          throw error;
        }
      } else {
        // Updating existing vendor - NEVER use upsert!
        if (isOperator) {
          // Compare whether comments actually changed before issuing update to vendors table
          // If operator only modified contacts, skip updating vendors table to avoid unnecessary triggers
          const existingVendor = list.find(item => item.id === finalVendor.id);
          const existingCommentsJson = JSON.stringify(existingVendor?.comments || []);
          const newCommentsJson = JSON.stringify(finalVendor.comments || []);
          const commentsChanged = existingCommentsJson !== newCommentsJson;

          if (commentsChanged && finalVendor.comments !== undefined) {
            const { error: commentsErr } = await supabase
              .from('vendors')
              .update({ comments: Array.isArray(finalVendor.comments) ? finalVendor.comments : [] })
              .eq('id', finalVendor.id);

            if (commentsErr) {
              console.error('Supabase operator comments update error:', commentsErr);
              throw commentsErr;
            }
          }
        } else {
          // Full update for authorized users (admin, manager, or users with suppliers.modify)
          const dbPayload = cleanVendorDbPayload(finalVendor);
          delete dbPayload.id; // Do not alter primary key
          const { error } = await supabase
            .from('vendors')
            .update(dbPayload)
            .eq('id', finalVendor.id);

          if (error) {
            console.error('Supabase update vendor error details:', error);
            if ((error as any).code === '23505') {
              console.warn('Skipping duplicate company_code conflict in Supabase:', finalCompCode);
              return decodeVendorCustomFields(finalVendor);
            }
            throw error;
          }
        }
      }
      
      // Save contacts to separate table
      await saveVendorContacts(finalVendor.id, cleanContacts, currentUserId);
    } catch (e: any) {
      if (e?.code === '23505') {
        console.warn('Duplicate key constraint caught in saveVendor, continuing safely:', e);
        return decodeVendorCustomFields(finalVendor);
      }
      console.error('Supabase saveVendor failed', e);
      throw e;
    }
  } else {
    // Local save
    await saveVendorContacts(finalVendor.id, cleanContacts, currentUserId);
  }

  const existsInLocal = list.some(item => item.id === finalVendor.id);
  if (isNew || !existsInLocal) {
    setLocal(KEY_VENDORS, [...list.filter(item => item.id !== finalVendor.id), finalVendor]);
    await trackChange(loggerName, isNew ? 'Vendor created' : 'Vendor updated', 'Trade Name', '', finalVendor.trade_name);
  } else {
    setLocal(KEY_VENDORS, list.map(item => item.id === finalVendor.id ? finalVendor : item));
    await trackChange(loggerName, 'Vendor updated', 'Trade Name', '', finalVendor.trade_name);
  }

  notifyDbChange('vendors', isNew ? 'CREATE' : 'UPDATE', finalVendor.id);

  return decodeVendorCustomFields(finalVendor);
}

export async function deleteVendor(id: string, tradeName: string, loggerName: string): Promise<boolean> {
  appCache.clear('contacts_');
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('vendors').update({ is_deleted: true }).eq('id', id);
      // Soft-delete contacts too
      await supabase.from('vendor_contacts').update({ is_deleted: true }).eq('vendor_id', id);
    } catch (e) {
      console.error('Supabase deleteVendor failed', e);
    }
  }

  const list = getLocal<Vendor[]>(KEY_VENDORS, []);
  setLocal(KEY_VENDORS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  
  const localContacts = getLocal<VendorContact[]>('local_vendor_contacts', []);
  setLocal('local_vendor_contacts', localContacts.map(c => c.vendor_id === id ? { ...c, is_deleted: true } : c));
  
  await trackChange(loggerName, 'Vendor deleted', 'Trade Name', tradeName, '');
  notifyDbChange('vendors', 'DELETE', id);
  return true;
}
