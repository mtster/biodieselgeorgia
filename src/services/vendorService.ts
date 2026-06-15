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
  const finalVendor = {
    ...vendor,
    id: isNew ? 'vendor-' + Math.random().toString(36).substring(2, 9) : vendor.id,
    created_at: vendor.created_at || new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const dbPayload = {
        ...finalVendor,
        warehouse_id: finalVendor.warehouse_id || null,
        manager_id: finalVendor.manager_id || null,
        operator_id: finalVendor.operator_id || null
      };
      if (isNew) {
        const { error } = await supabase.from('vendors').insert([dbPayload]);
        if (error) console.error('Supabase insert error details:', error);
      } else {
        const { error } = await supabase.from('vendors').update(dbPayload).eq('id', dbPayload.id);
        if (error) console.error('Supabase update error details:', error);
      }
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
