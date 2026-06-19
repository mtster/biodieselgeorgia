import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vendor } from '../types';
import { trackChange } from './historyService';
import { KEY_VENDORS, getLocal, setLocal } from './localStorage';

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

export async function getVendors(): Promise<Vendor[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('vendors').select('*').eq('is_deleted', false).order('trade_name');
      if (!error && data) {
        return data.map(v => decodeVendorCustomFields(v));
      }
    } catch (e) {
      console.warn('Supabase getVendors failed', e);
    }
  }
  return getLocal<Vendor[]>(KEY_VENDORS, []).filter(item => !item.is_deleted).map(v => decodeVendorCustomFields(v));
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

  return {
    id: vendor.id,
    id_code: vendor.id_code || '',
    company_name: vendor.company_name || vendor.trade_name || '',
    trade_name: vendor.trade_name || '',
    company_code: vendor.company_code || vendor.id_code || '',
    bank_account: vendor.bank_account || '',
    city: vendor.city || '',
    district: vendor.district || '',
    address: vendor.address || '',
    price_per_liter: Number(vendor.price_per_liter) || 0,
    warehouse_id: vendor.warehouse_id || null,
    manager_id: isValidUuid(managerId) ? managerId : null,
    operator_id: isValidUuid(operatorId) ? operatorId : null,
    working_hours: vendor.working_hours || '',
    contacts: Array.isArray(vendor.contacts) ? vendor.contacts : [],
    comments: Array.isArray(vendor.comments) ? vendor.comments : [],
    fact_qty: Number(vendor.fact_qty) || 0,
    fact_tank_dropoff: Number(vendor.fact_tank_dropoff) || 0,
    fact_tank_pickup: Number(vendor.fact_tank_pickup) || 0,
    is_deleted: !!vendor.is_deleted,
    created_at: vendor.created_at || new Date().toISOString()
  };
}

export async function saveVendor(vendor: Vendor, loggerName: string): Promise<Vendor> {
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

  const customFieldsObj: Record<string, any> = {};
  Object.keys(finalVendor).forEach(key => {
    if (key.startsWith('custom_') || ['status', 'fact_qty', 'fact_tank_dropoff', 'fact_tank_pickup'].includes(key)) {
      customFieldsObj[key] = (finalVendor as any)[key];
    }
  });

  let cleanContacts = (finalVendor.contacts || []).filter(c => c.name !== "__DYNAMIC_CUSTOM_FIELDS__");
  if (Object.keys(customFieldsObj).length > 0) {
    cleanContacts.push({
      id: 'contact-custom-fields-data',
      name: '__DYNAMIC_CUSTOM_FIELDS__',
      phone: '0000',
      position: 'other',
      note: JSON.stringify(customFieldsObj),
      is_default: false
    });
  }
  finalVendor.contacts = cleanContacts;

  if (isSupabaseConfigured && supabase) {
    try {
      const dbPayload = cleanVendorDbPayload(finalVendor);
      const { error } = await supabase.from('vendors').upsert([dbPayload], { onConflict: 'id' });
      if (error) {
        console.error('Supabase upsert error details:', error);
        throw error;
      }
    } catch (e) {
      console.error('Supabase saveVendor failed', e);
      throw e;
    }
  }

  const list = getLocal<Vendor[]>(KEY_VENDORS, []);
  if (isNew) {
    setLocal(KEY_VENDORS, [...list, finalVendor]);
    await trackChange(loggerName, 'Vendor created', 'Trade Name', '', finalVendor.trade_name);
  } else {
    setLocal(KEY_VENDORS, list.map(item => item.id === finalVendor.id ? finalVendor : item));
    await trackChange(loggerName, 'Vendor updated', 'Trade Name', '', finalVendor.trade_name);
  }
  return decodeVendorCustomFields(finalVendor);
}

export async function deleteVendor(id: string, tradeName: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('vendors').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteVendor failed', e);
    }
  }

  const list = getLocal<Vendor[]>(KEY_VENDORS, []);
  setLocal(KEY_VENDORS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Vendor deleted', 'Trade Name', tradeName, '');
  return true;
}
