import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vendor, VendorContact } from '../types';
import { trackChange } from './historyService';
import { KEY_VENDORS, getLocal, setLocal } from './localStorage';
import { appCache } from '../utils/cache';
import { notifyDbChange } from '../lib/realtime';

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

export function decodeVendorCustomFields(vendor: Vendor): Vendor {
  const contacts = vendor.contacts || [];
  const customContact = contacts.find(c => c.name === "__DYNAMIC_CUSTOM_FIELDS__");
  const cleanContacts = contacts.filter(c => c.name !== "__DYNAMIC_CUSTOM_FIELDS__");
  
  const decoded = {
    ...vendor,
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

// Fetch all contacts from vendor_contacts table
export async function getVendorContacts(vendorId?: string): Promise<VendorContact[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('vendor_contacts').select('*').eq('is_deleted', false);
      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }
      const { data, error } = await query;
      if (!error && data) {
        // Sort according to rule:
        // 1. is_default / ismain (true first)
        // 2. descending order of sort_order (highest sort_order is top/latest, 1 is bottom/oldest)
        return (data as any[]).sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return (b.sort_order || 0) - (a.sort_order || 0);
        });
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
  
  return filtered.sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return (b.sort_order || 0) - (a.sort_order || 0);
  });
}

// Save/update all contacts for a specific vendor
export async function saveVendorContacts(vendorId: string, contacts: VendorContact[], currentUserId?: string): Promise<void> {
  appCache.clear('contacts_');
  if (isSupabaseConfigured && supabase) {
    try {
      // Find contacts currently in DB to detect which ones were deleted
      const { data: currentDb } = await supabase.from('vendor_contacts').select('id').eq('vendor_id', vendorId).eq('is_deleted', false);
      const incomingIds = contacts.map(c => c.id).filter(Boolean);
      
      if (currentDb && currentDb.length > 0) {
        const deletedIds = currentDb.filter(c => !incomingIds.includes(c.id)).map(c => c.id);
        if (deletedIds.length > 0) {
          await supabase.from('vendor_contacts').update({ is_deleted: true }).in('id', deletedIds);
        }
      }

      // Upsert current list
      if (contacts.length > 0) {
        const payloads = contacts.map((c, idx) => ({
          id: c.id || generateUuid(),
          vendor_id: vendorId,
          name: c.name || '',
          phone: c.phone || '',
          position: c.position || 'other',
          note: c.note || '',
          email: c.email || '',
          is_default: !!c.is_default,
          sort_order: c.sort_order !== undefined ? c.sort_order : (idx + 1),
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
  const updatedPayloads = contacts.map((c, idx) => ({
    ...c,
    vendor_id: vendorId,
    sort_order: c.sort_order !== undefined ? c.sort_order : (idx + 1)
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

      if (searchTerm.trim()) {
        const rawTerm = searchTerm.trim();
        const term = `%${rawTerm}%`;

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
  }
): Promise<PaginatedVendorsResult> {
  const filterKey = JSON.stringify(filters || {});
  const countCacheKey = `count_vendors_${filterKey}`;
  const pageCacheKey = `vendors_limit_${limit}_offset_${offset}_${filterKey}`;

  const cachedPage = appCache.get<PaginatedVendorsResult>(pageCacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const cachedCount = appCache.get<number>(countCacheKey);

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('vendors')
        .select('*', cachedCount !== null ? {} : { count: 'exact' })
        .eq('is_deleted', false);

      if (filters?.searchTerm?.trim()) {
        const term = `%${filters.searchTerm.trim()}%`;
        query = query.or(`trade_name.ilike.${term},company_name.ilike.${term},id_code.ilike.${term},company_code.ilike.${term},address.ilike.${term}`);
      }
      if (filters?.city) {
        query = query.eq('city', filters.city);
      }
      if (filters?.district) {
        query = query.eq('district', filters.district);
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
          const { data: contactsData } = await supabase
            .from('vendor_contacts')
            .select('id, vendor_id, name, phone, position, note, email, is_default, sort_order')
            .in('vendor_id', vendorIds)
            .eq('is_deleted', false);
          if (contactsData) {
            decoded.forEach(v => {
              v.contacts = contactsData.filter(c => c.vendor_id === v.id);
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
  let filtered = all;
  if (filters?.searchTerm?.trim()) {
    const term = filters.searchTerm.trim().toLowerCase();
    filtered = filtered.filter(v => 
      (v.trade_name || '').toLowerCase().includes(term) || 
      (v.company_name || '').toLowerCase().includes(term) ||
      (v.company_code || '').toLowerCase().includes(term) ||
      (v.id_code || '').toLowerCase().includes(term)
    );
  }
  if (filters?.managerId) {
    filtered = filtered.filter(v => v.manager_id === filters.managerId);
  }
  return {
    vendors: filtered.slice(offset, offset + limit),
    totalCount: filtered.length
  };
}

export async function getVendors(): Promise<Vendor[]> {
  let vendors: Vendor[] = [];
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('vendors').select('*').eq('is_deleted', false).order('trade_name').limit(10000);
      if (!error && data) {
        vendors = data.map(v => decodeVendorCustomFields(v));
      }
    } catch (e) {
      console.warn('Supabase getVendors failed', e);
    }
  }
  if (vendors.length === 0) {
    vendors = getLocal<Vendor[]>(KEY_VENDORS, []).filter(item => !item.is_deleted).map(v => decodeVendorCustomFields(v));
  }

  // Populate dynamic contacts
  const allContacts = await getVendorContacts();
  vendors.forEach(v => {
    v.contacts = allContacts.filter(c => c.vendor_id === v.id);
  });

  return vendors;
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

  const isActiveBool = vendor.is_active !== undefined ? !!vendor.is_active : (vendor.status !== 'Closed' && vendor.status !== 'Cancelled');

  const vId = vendor.id || generateUuid();
  const rawCompCode = (vendor.company_code || '').toString().trim();
  const rawIdCode = (vendor.id_code || '').toString().trim();
  const finalCompCode = rawCompCode || (rawIdCode && rawIdCode !== '204857392' ? rawIdCode : `CC-${vId.slice(-8)}`);

  const payload: any = {
    id: vId,
    id_code: vendor.id_code || '',
    company_name: vendor.company_name || vendor.trade_name || '',
    trade_name: vendor.trade_name || '',
    company_code: finalCompCode,
    bank_account: vendor.bank_account || '',
    email: vendor.email || '',
    city: vendor.city || '',
    district: vendor.district || '',
    address: vendor.address || '',
    price_per_liter: Number(vendor.price_per_liter) || 0,
    warehouse_id: vendor.warehouse_id || null,
    manager_id: isValidUuid(managerId) ? managerId : null,
    operator_id: isValidUuid(operatorId) ? operatorId : null,
    direction_id: vendor.direction_id || null,
    working_hours: vendor.working_hours || '',
    comments: Array.isArray(vendor.comments) ? vendor.comments : [],
    is_active: isActiveBool,
    status: vendor.status || (isActiveBool ? 'Active' : 'Closed'),
    is_deleted: !!vendor.is_deleted,
    created_at: vendor.created_at || new Date().toISOString(),
    created_by: isValidUuid(createdBy) ? createdBy : null,
    user_id: vendor.user_id || null,
    username: vendor.username || null,
    overdue_threshold_days: (vendor.overdue_threshold_days === undefined || vendor.overdue_threshold_days === null || vendor.overdue_threshold_days === '') ? null : Number(vendor.overdue_threshold_days),
    is_planned: vendor.is_planned !== undefined ? !!vendor.is_planned : false,
    planned_weekday: vendor.planned_weekday || null
  };

  // Explicitly strip redundant and moved columns from payload
  delete payload.contacts;
  delete payload.last_pickup_date;
  delete payload.average_interval_days;
  delete payload.status;

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

export async function saveVendor(vendor: Vendor, loggerName: string, currentUserId?: string): Promise<Vendor> {
  const list = getLocal<Vendor[]>(KEY_VENDORS, []);
  const isNew = !vendor.id;

  const vId = isNew ? generateUuid() : vendor.id;
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
      // Check if a vendor with the same company_code already exists in DB to reuse its ID
      if (finalCompCode && isNew) {
        const { data: existingComp } = await supabase
          .from('vendors')
          .select('id')
          .eq('is_deleted', false)
          .ilike('company_code', finalCompCode)
          .maybeSingle();

        if (existingComp?.id) {
          finalVendor.id = existingComp.id;
        }
      }

      const dbPayload = cleanVendorDbPayload(finalVendor);
      const { error } = await supabase.from('vendors').upsert([dbPayload], { onConflict: 'id' });
      if (error) {
        console.error('Supabase upsert error details:', error);
        if ((error as any).code === '23505') {
          console.warn('Skipping duplicate company_code conflict in Supabase:', finalCompCode);
          return decodeVendorCustomFields(finalVendor);
        }
        throw error;
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
