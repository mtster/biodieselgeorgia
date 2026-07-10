import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vendor, VendorContact } from '../types';
import { trackChange } from './historyService';
import { KEY_VENDORS, getLocal, setLocal } from './localStorage';
import { appCache } from '../utils/cache';

export { KEY_VENDORS };

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
export async function saveVendorContacts(vendorId: string, contacts: VendorContact[]): Promise<void> {
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
          id: c.id || 'vc-' + Math.random().toString(36).substring(2, 9),
          vendor_id: vendorId,
          name: c.name || '',
          phone: c.phone || '',
          position: c.position || 'other',
          note: c.note || '',
          email: c.email || '',
          is_default: !!c.is_default,
          sort_order: c.sort_order !== undefined ? c.sort_order : (idx + 1),
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
  const cacheKey = `contacts_limit_${limit}_offset_${offset}_search_${searchTerm}`;
  const cached = appCache.get<PaginatedContactsResult>(cacheKey);
  if (cached) {
    return cached;
  }

  if (isSupabaseConfigured && supabase) {
    try {
      // Retrieve the table size instantly with indexed query count
      let query = supabase
        .from('vendor_contacts')
        .select('*, vendors(*)', { count: 'exact' })
        .eq('is_deleted', false);

      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        // Search across fields
        query = query.or(`name.ilike.${term},phone.ilike.${term},position.ilike.${term},email.ilike.${term}`);
      }

      // Always arrange is_default first, then other contacts descending by sort_order
      query = query
        .order('is_default', { ascending: false })
        .order('sort_order', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (!error && data) {
        const mapped = (data as any[]).map(item => {
          const v = item.vendors;
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
            company_name: v ? (v.trade_name || v.company_name || '-') : '-',
            company_code: v ? (v.company_code || v.id_code || '-') : '-',
            vendor: v ? decodeVendorCustomFields(v) : undefined
          };
        });
        const result = {
          contacts: mapped,
          totalCount: count || 0
        };
        appCache.set(cacheKey, result);
        return result;
      } else if (error) {
        console.error('Supabase getContactsPaginated error', error);
      }
    } catch (e) {
      console.warn('Supabase getContactsPaginated failed', e);
    }
  }

  // Local fallback
  const allContacts = getLocal<VendorContact[]>('local_vendor_contacts', []).filter(c => !c.is_deleted);
  const localVendors = getLocal<Vendor[]>(KEY_VENDORS, []).filter(v => !v.is_deleted);
  
  const mappedContacts = allContacts.map(c => {
    const v = localVendors.find(vend => vend.id === c.vendor_id);
    return {
      ...c,
      company_name: v ? (v.trade_name || v.company_name || '-') : '-',
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
  appCache.set(cacheKey, result);
  return result;
}

export async function getVendors(): Promise<Vendor[]> {
  let vendors: Vendor[] = [];
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('vendors').select('*').eq('is_deleted', false).order('trade_name');
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

  const payload: any = {
    id: vendor.id,
    id_code: vendor.id_code || '',
    company_name: vendor.company_name || vendor.trade_name || '',
    trade_name: vendor.trade_name || '',
    company_code: (vendor.company_code || vendor.id_code || vendor.id || '').trim(),
    bank_account: vendor.bank_account || '',
    city: vendor.city || '',
    district: vendor.district || '',
    address: vendor.address || '',
    price_per_liter: Number(vendor.price_per_liter) || 0,
    warehouse_id: vendor.warehouse_id || null,
    manager_id: isValidUuid(managerId) ? managerId : null,
    operator_id: isValidUuid(operatorId) ? operatorId : null,
    direction_id: vendor.direction_id || null,
    working_hours: vendor.working_hours || '',
    contacts: [], // Decoupled: keep vendors table's column empty
    comments: Array.isArray(vendor.comments) ? vendor.comments : [],
    status: vendor.status || 'Active',
    is_deleted: !!vendor.is_deleted,
    created_at: vendor.created_at || new Date().toISOString(),
    user_id: vendor.user_id || null,
    username: vendor.username || null,
    overdue_threshold_days: (vendor.overdue_threshold_days === undefined || vendor.overdue_threshold_days === null || vendor.overdue_threshold_days === '') ? null : Number(vendor.overdue_threshold_days),
    is_planned: vendor.is_planned !== undefined ? !!vendor.is_planned : false,
    planned_weekday: vendor.planned_weekday || null
  };

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

export async function saveVendor(vendor: Vendor, loggerName: string): Promise<Vendor> {
  const list = getLocal<Vendor[]>(KEY_VENDORS, []);
  const isNew = !vendor.id;

  const cleanUserUuid = (val: string | null | undefined): string | null => {
    if (!val) return null;
    if (val === 'user-admin') return '00000000-0000-4000-a000-000000000000';
    if (val.startsWith('user-')) {
      const suffix = val.substring(5).padEnd(11, '0').slice(0, 11);
      return `00000000-0000-4000-b000-${suffix}`.toLowerCase();
    }
    return val;
  };

  const finalVendor = {
    ...vendor,
    id: isNew ? 'vendor-' + Math.random().toString(36).substring(2, 9) : vendor.id,
    manager_id: cleanUserUuid(vendor.manager_id),
    operator_id: cleanUserUuid(vendor.operator_id),
    created_at: vendor.created_at || new Date().toISOString()
  };

  // Ensure contact lists are clean of old system indicator
  let cleanContacts = (finalVendor.contacts || []).filter(c => c.name !== "__DYNAMIC_CUSTOM_FIELDS__");
  finalVendor.contacts = cleanContacts;

  if (isSupabaseConfigured && supabase) {
    try {
      const dbPayload = cleanVendorDbPayload(finalVendor);
      const { error } = await supabase.from('vendors').upsert([dbPayload], { onConflict: 'id' });
      if (error) {
        console.error('Supabase upsert error details:', error);
        throw error;
      }
      
      // Save contacts to separate table
      await saveVendorContacts(finalVendor.id, cleanContacts);
    } catch (e) {
      console.error('Supabase saveVendor failed', e);
      throw e;
    }
  } else {
    // Local save
    await saveVendorContacts(finalVendor.id, cleanContacts);
  }

  const existsInLocal = list.some(item => item.id === finalVendor.id);
  if (isNew || !existsInLocal) {
    setLocal(KEY_VENDORS, [...list.filter(item => item.id !== finalVendor.id), finalVendor]);
    await trackChange(loggerName, isNew ? 'Vendor created' : 'Vendor updated', 'Trade Name', '', finalVendor.trade_name);
  } else {
    setLocal(KEY_VENDORS, list.map(item => item.id === finalVendor.id ? finalVendor : item));
    await trackChange(loggerName, 'Vendor updated', 'Trade Name', '', finalVendor.trade_name);
  }
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
  return true;
}
