import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Communication } from '../types';
import { trackChange } from './historyService';
import { KEY_COMMUNICATIONS, getLocal, setLocal } from './localStorage';
import { notifyDbChange } from '../lib/realtime';

export { KEY_COMMUNICATIONS };

export interface PaginatedCommunicationsResult {
  communications: Communication[];
  totalCount: number;
}

export async function getCommunicationsPaginated(
  limit: number = 12,
  offset: number = 0,
  filters?: {
    searchTerm?: string;
    type?: string;
    vendorId?: string;
    userId?: string;
  }
): Promise<PaginatedCommunicationsResult> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('communications')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false);

      if (filters?.searchTerm?.trim()) {
        const term = `%${filters.searchTerm.trim()}%`;
        query = query.or(`comment.ilike.${term}`);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.vendorId) {
        query = query.eq('vendor_id', filters.vendorId);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }

      query = query.order('date_time', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (!error && data) {
        return {
          communications: data as Communication[],
          totalCount: count || 0
        };
      }
    } catch (e) {
      console.warn('Supabase getCommunicationsPaginated failed', e);
    }
  }

  const all = getLocal<Communication[]>(KEY_COMMUNICATIONS, []).filter(c => !c.is_deleted);
  let filtered = all;
  if (filters?.searchTerm?.trim()) {
    const term = filters.searchTerm.trim().toLowerCase();
    filtered = filtered.filter(c => (c.comment || '').toLowerCase().includes(term));
  }
  return {
    communications: filtered.slice(offset, offset + limit),
    totalCount: filtered.length
  };
}

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

const cleanUserUuid = (val: string | null | undefined): string | null => {
  if (!val) return null;
  if (val === 'import') return 'import';
  if (val === 'user-admin') return '00000000-0000-4000-a000-000000000000';
  if (val.startsWith('user-')) {
    const suffix = val.substring(5).padEnd(11, '0').slice(0, 11);
    return `00000000-0000-4000-b000-${suffix}`.toLowerCase();
  }
  return val;
};

export async function saveCommunication(comm: Communication, loggerName: string, currentUserId?: string): Promise<Communication> {
  const isNew = !comm.id;
  const createdBy = cleanUserUuid(isNew ? (currentUserId || comm.created_by || comm.user_id) : (comm.created_by || currentUserId || comm.user_id));
  const cleanUserId = cleanUserUuid(comm.user_id) || createdBy;

  const finalComm = {
    ...comm,
    id: isNew ? 'comm-' + Math.random().toString(36).substring(2, 9) : comm.id,
    user_id: cleanUserId || comm.user_id,
    created_by: createdBy || comm.created_by
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

      dbComm.created_by = cleanUserUuid(finalComm.created_by || currentUserId) || null;
      dbComm.user_id = cleanUserUuid(finalComm.user_id || currentUserId) || null;
      dbComm.responsible_user_id = cleanUserUuid(finalComm.responsible_user_id) || null;

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
