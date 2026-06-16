import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vendor } from '../types';
import { trackChange } from './historyService';
import { KEY_VENDORS, getLocal, setLocal } from './localStorage';

export { KEY_VENDORS };

export async function getVendors(): Promise<Vendor[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('vendors').select('*').eq('is_deleted', false).order('trade_name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getVendors failed', e);
    }
  }
  return getLocal<Vendor[]>(KEY_VENDORS, []).filter(item => !item.is_deleted);
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

  if (isSupabaseConfigured && supabase) {
    try {
      const isValidUuid = (val: string | null | undefined): boolean => {
        if (!val) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      };

      const dbPayload = {
        id: finalVendor.id,
        id_code: finalVendor.id_code || '',
        company_name: finalVendor.company_name || finalVendor.trade_name || '',
        trade_name: finalVendor.trade_name || '',
        company_code: finalVendor.company_code || finalVendor.id_code || '',
        bank_account: finalVendor.bank_account || '',
        city: finalVendor.city || '',
        district: finalVendor.district || '',
        address: finalVendor.address || '',
        price_per_liter: Number(finalVendor.price_per_liter) || 0,
        warehouse_id: finalVendor.warehouse_id || null,
        manager_id: isValidUuid(finalVendor.manager_id) ? finalVendor.manager_id : null,
        operator_id: isValidUuid(finalVendor.operator_id) ? finalVendor.operator_id : null,
        working_hours: finalVendor.working_hours || '',
        contacts: Array.isArray(finalVendor.contacts) ? finalVendor.contacts : [],
        comments: Array.isArray(finalVendor.comments) ? finalVendor.comments : [],
        is_deleted: !!finalVendor.is_deleted,
        created_at: finalVendor.created_at
      };

      const { error } = await supabase.from('vendors').upsert([dbPayload], { onConflict: 'id' });
      if (error) console.error('Supabase upsert error details:', error);
    } catch (e) {
      console.error('Supabase saveVendor failed', e);
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
  return finalVendor;
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
