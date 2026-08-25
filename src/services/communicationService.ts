import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Communication } from '../types';
import { trackChange } from './historyService';
import { KEY_COMMUNICATIONS, getLocal, setLocal } from './localStorage';
import { notifyDbChange } from '../lib/realtime';
import { appCache } from '../utils/cache';
import { generateUuid, cleanUserUuid } from './vendorService';

export { KEY_COMMUNICATIONS };

export interface PaginatedCommunicationsResult {
  communications: Communication[];
  totalCount: number;
}

const isValidUuid = (val: any) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export async function getCommunicationsPaginated(
  limit: number = 12,
  offset: number = 0,
  filters?: {
    searchTerm?: string;
    type?: string;
    vendorId?: string;
    userId?: string;
    taskStatus?: string;
    taskResponsible?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<PaginatedCommunicationsResult> {
  const filterKey = JSON.stringify(filters || {});
  const countCacheKey = `count_communications_${filterKey}`;
  const pageCacheKey = `communications_limit_${limit}_offset_${offset}_${filterKey}`;

  const cachedPage = appCache.get<PaginatedCommunicationsResult>(pageCacheKey);
  if (cachedPage) {
    return cachedPage;
  }

  const cachedCount = appCache.get<number>(countCacheKey);

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('communications')
        .select('*', cachedCount !== null ? {} : { count: 'exact' })
        .eq('is_deleted', false);

      if (filters?.searchTerm?.trim()) {
        const rawTerm = filters.searchTerm.trim();
        const term = `%${rawTerm}%`;

        const { data: matchedVendors } = await supabase
          .from('vendors')
          .select('id')
          .or(`trade_name.ilike.${term},company_name.ilike.${term}`)
          .eq('is_deleted', false);

        const matchedVendorIds = (matchedVendors || []).map(v => v.id);

        if (matchedVendorIds.length > 0) {
          query = query.or(`comment.ilike.${term},vendor_id.in.(${matchedVendorIds.join(',')})`);
        } else {
          query = query.ilike('comment', term);
        }
      }
      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.vendorId) {
        query = query.eq('vendor_id', filters.vendorId);
      }
      if (filters?.userId) {
        const cleanedId = cleanUserUuid(filters.userId) || filters.userId;
        query = query.or(`responsible_user_id.eq.${cleanedId},created_by.eq.${cleanedId}`);
      }
      if (filters?.taskResponsible) {
        const cleanedRespId = cleanUserUuid(filters.taskResponsible) || filters.taskResponsible;
        query = query.eq('responsible_user_id', cleanedRespId);
      }
      if (filters?.taskStatus) {
        if (filters.taskStatus === 'completed') {
          query = query.eq('is_completed', true);
        } else if (filters.taskStatus === 'active') {
          query = query.eq('is_completed', false);
        }
      }
      if (filters?.startDate) {
        query = query.gte('date_time', `${filters.startDate}T00:00:00`);
      }
      if (filters?.endDate) {
        query = query.lte('date_time', `${filters.endDate}T23:59:59`);
      }

      query = query.order('date_time', { ascending: false }).range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (!error && data) {
        const finalCount = cachedCount !== null ? cachedCount : (count || 0);
        if (cachedCount === null && count !== null) {
          appCache.set(countCacheKey, count);
        }

        const normalizedData = (data || []).map((comm: any) => {
          const isDone = typeof comm.is_completed === 'boolean' 
            ? comm.is_completed 
            : (comm.task_status === 'completed' || comm.task_status === 'done');
          return {
            ...comm,
            is_completed: isDone,
            task_status: isDone ? 'completed' : 'pending',
            responsible_user_id: comm.responsible_user_id || comm.user_id,
            user_id: comm.responsible_user_id || comm.user_id
          };
        });

        const result = {
          communications: normalizedData as Communication[],
          totalCount: finalCount
        };
        appCache.set(pageCacheKey, result);
        return result;
      }
    } catch (e) {
      console.warn('Supabase getCommunicationsPaginated failed', e);
    }
  }

  const all = getLocal<Communication[]>(KEY_COMMUNICATIONS, []).filter(c => !c.is_deleted);
  const localVendors = getLocal<any[]>('biodiesel_vendors', []);
  const vendorMap = new Map(localVendors.map(v => [v.id, v]));

  let filtered = all.map(c => {
    const isDone = typeof c.is_completed === 'boolean' ? c.is_completed : (c.task_status === 'completed' || c.task_status === 'done');
    return {
      ...c,
      is_completed: isDone,
      task_status: isDone ? 'completed' : 'pending',
      responsible_user_id: c.responsible_user_id || c.user_id,
      user_id: c.responsible_user_id || c.user_id
    };
  });

  if (filters?.searchTerm?.trim()) {
    const term = filters.searchTerm.trim().toLowerCase();
    filtered = filtered.filter(c => {
      const commentMatch = (c.comment || '').toLowerCase().includes(term);
      const vObj = vendorMap.get(c.vendor_id);
      const tradeMatch = (vObj?.trade_name || c.vendor_name || '').toLowerCase().includes(term);
      const companyMatch = (vObj?.company_name || '').toLowerCase().includes(term);
      return commentMatch || tradeMatch || companyMatch;
    });
  }
  if (filters?.type) {
    filtered = filtered.filter(c => c.type === filters.type);
  }
  if (filters?.vendorId) {
    filtered = filtered.filter(c => c.vendor_id === filters.vendorId);
  }
  if (filters?.userId) {
    filtered = filtered.filter(c => c.user_id === filters.userId || c.responsible_user_id === filters.userId || c.created_by === filters.userId);
  }
  if (filters?.taskResponsible) {
    filtered = filtered.filter(c => c.responsible_user_id === filters.taskResponsible || c.user_id === filters.taskResponsible);
  }
  if (filters?.taskStatus) {
    if (filters.taskStatus === 'completed') {
      filtered = filtered.filter(c => c.is_completed || c.task_status === 'completed');
    } else if (filters.taskStatus === 'active') {
      filtered = filtered.filter(c => !c.is_completed && c.task_status !== 'completed');
    }
  }
  if (filters?.startDate) {
    filtered = filtered.filter(c => c.date_time >= `${filters.startDate}T00:00:00`);
  }
  if (filters?.endDate) {
    filtered = filtered.filter(c => c.date_time <= `${filters.endDate}T23:59:59`);
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
      if (!error && data) {
        return (data as any[]).map(c => {
          const isDone = typeof c.is_completed === 'boolean' ? c.is_completed : (c.task_status === 'completed' || c.task_status === 'done');
          return {
            ...c,
            is_completed: isDone,
            task_status: isDone ? 'completed' : 'pending',
            responsible_user_id: c.responsible_user_id || c.user_id,
            user_id: c.responsible_user_id || c.user_id
          };
        });
      }
    } catch (e) {
      console.warn('Supabase getCommunications failed', e);
    }
  }
  return getLocal<Communication[]>(KEY_COMMUNICATIONS, [])
    .filter(item => !item.is_deleted)
    .map(c => {
      const isDone = typeof c.is_completed === 'boolean' ? c.is_completed : (c.task_status === 'completed' || c.task_status === 'done');
      return {
        ...c,
        is_completed: isDone,
        task_status: isDone ? 'completed' : 'pending',
        responsible_user_id: c.responsible_user_id || c.user_id,
        user_id: c.responsible_user_id || c.user_id
      };
    });
}

export async function saveCommunication(comm: Communication, loggerName: string, currentUserId?: string): Promise<Communication> {
  const isNew = !comm.id;
  const createdBy = isNew 
    ? (comm.created_by || currentUserId || comm.responsible_user_id || comm.user_id) 
    : (comm.created_by || currentUserId || comm.responsible_user_id || comm.user_id);
  const cleanCreatedBy = cleanUserUuid(createdBy) || createdBy;
  const cleanResponsibleId = cleanUserUuid(comm.responsible_user_id || comm.user_id) || cleanCreatedBy;

  const isCompleted = typeof comm.is_completed === 'boolean' 
    ? comm.is_completed 
    : (comm.task_status === 'completed' || comm.task_status === 'done');

  const finalComm: Communication = {
    ...comm,
    id: isNew ? generateUuid() : comm.id,
    responsible_user_id: cleanResponsibleId || undefined,
    user_id: cleanResponsibleId || undefined,
    is_completed: isCompleted,
    task_status: isCompleted ? 'completed' : 'pending',
    created_by: cleanCreatedBy || comm.created_by || currentUserId || createdBy
  };

  if (isSupabaseConfigured && supabase) {
    try {
      // Strip virtual UI helper fields before pushing to Supabase
      const { 
        vendor_name, 
        user_name, 
        vendor_contact_name, 
        responsible_user_name,
        task_status,
        user_id,
        ...dbComm 
      } = finalComm as any;

      // Sanitize UUID fields so empty or non-valid UUID strings are null
      dbComm.vendor_id = isValidUuid(dbComm.vendor_id) ? dbComm.vendor_id : null;
      dbComm.vendor_contact_id = isValidUuid(dbComm.vendor_contact_id) ? dbComm.vendor_contact_id : null;
      dbComm.created_by = isValidUuid(cleanCreatedBy) ? cleanCreatedBy : null;
      dbComm.responsible_user_id = isValidUuid(cleanResponsibleId) ? cleanResponsibleId : (dbComm.created_by || null);
      dbComm.is_completed = Boolean(isCompleted);

      // Clean out any non-existent columns from Supabase schema
      delete dbComm.task_status;
      delete dbComm.user_id;

      if (isNew) {
        const { error } = await supabase.from('communications').insert([dbComm]);
        if (error) {
          console.error('Supabase insert communication error:', error);
        }
      } else {
        const { error } = await supabase.from('communications').update(dbComm).eq('id', dbComm.id);
        if (error) {
          console.error('Supabase update communication error:', error);
        }
      }
    } catch (e) {
      console.error('Supabase saveCommunication failed', e);
    }
  }

  // Always update local cache and storage
  const list = getLocal<Communication[]>(KEY_COMMUNICATIONS, []);
  if (isNew) {
    setLocal(KEY_COMMUNICATIONS, [finalComm, ...list]);
    await trackChange(loggerName, 'Communication logged', 'Comment', '', finalComm.comment);
  } else {
    setLocal(KEY_COMMUNICATIONS, list.map(item => item.id === finalComm.id ? finalComm : item));
    await trackChange(loggerName, 'Communication updated', 'Comment', '', finalComm.comment);
  }

  // Clear query cache and broadcast change
  appCache.clear();
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
  appCache.clear();
  notifyDbChange('vendor_communications', 'DELETE', id);
  return true;
}
