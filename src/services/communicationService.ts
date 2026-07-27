import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Communication } from '../types';
import { trackChange } from './historyService';
import { KEY_COMMUNICATIONS, getLocal, setLocal } from './localStorage';
import { notifyDbChange } from '../lib/realtime';

export { KEY_COMMUNICATIONS };

export async function getCommunications(): Promise<Communication[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('communications').select('*').eq('is_deleted', false).order('date_time', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getCommunications failed', e);
    }
  }
  return getLocal<Communication[]>(KEY_COMMUNICATIONS, []).filter(item => !item.is_deleted);
}

export async function saveCommunication(comm: Communication, loggerName: string): Promise<Communication> {
  const isNew = !comm.id;
  const finalComm = {
    ...comm,
    id: isNew ? 'comm-' + Math.random().toString(36).substring(2, 9) : comm.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      // Strip virtual UI helper fields before pushing to Supabase
      const { 
        vendor_name, 
        user_name, 
        vendor_contact_name, 
        responsible_user_name,
        ...dbComm 
      } = finalComm as any;

      if (isNew) {
        await supabase.from('communications').insert([dbComm]);
      } else {
        await supabase.from('communications').update(dbComm).eq('id', dbComm.id);
      }
    } catch (e) {
      console.error('Supabase saveCommunication failed', e);
    }
  }

  const list = getLocal<Communication[]>(KEY_COMMUNICATIONS, []);
  if (isNew) {
    setLocal(KEY_COMMUNICATIONS, [finalComm, ...list]);
    await trackChange(loggerName, 'Communication logged', 'Comment', '', finalComm.comment);
  } else {
    setLocal(KEY_COMMUNICATIONS, list.map(item => item.id === finalComm.id ? finalComm : item));
    await trackChange(loggerName, 'Communication updated', 'Comment', '', finalComm.comment);
  }

  notifyDbChange('vendor_communications', isNew ? 'CREATE' : 'UPDATE', finalComm.id);
  return finalComm;
}

export async function deleteCommunication(id: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('communications').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteCommunication failed', e);
    }
  }

  const list = getLocal<Communication[]>(KEY_COMMUNICATIONS, []);
  setLocal(KEY_COMMUNICATIONS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Communication deleted', 'ID', id, '');
  notifyDbChange('vendor_communications', 'DELETE', id);
  return true;
}
