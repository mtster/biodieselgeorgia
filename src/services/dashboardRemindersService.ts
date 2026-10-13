import { Communication } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { KEY_COMMUNICATIONS, KEY_VENDORS, getLocal } from './localStorage';
import { resolveVendorsMap } from './communicationService';

export interface DashboardRemindersResult {
  reminders: Communication[];
  totalCount: number;
}

/**
 * High-performance paginated query for dashboard reminders.
 * Prioritizes rows with has_time = true first, and orders from earlier to later reminder time.
 */
export async function getDashboardTodayRemindersPaginated(
  limit: number = 7,
  offset: number = 0,
  userId?: string,
  userName?: string
): Promise<DashboardRemindersResult> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Determine today's date in local time and Asia/Tbilisi (UTC+4)
  let tbilisiDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  try {
    tbilisiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(now);
  } catch {}
  const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Start & end boundaries covering the current date across local time, Tbilisi time (UTC+4), and UTC
  const [tYear, tMonth, tDay] = tbilisiDate.split('-').map(Number);
  const tbilisiStartUtc = new Date(Date.UTC(tYear, tMonth - 1, tDay, 0, 0, 0) - 4 * 3600 * 1000).toISOString();
  const tbilisiEndUtc = new Date(Date.UTC(tYear, tMonth - 1, tDay, 23, 59, 59, 999) - 4 * 3600 * 1000).toISOString();
  const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
  const localEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  const minStartBoundary = new Date(Math.min(new Date(localStart).getTime(), new Date(tbilisiStartUtc).getTime())).toISOString();
  const maxEndBoundary = new Date(Math.max(new Date(localEnd).getTime(), new Date(tbilisiEndUtc).getTime())).toISOString();

  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('communications')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false)
        .eq('type', 'reminder')
        .gte('reminder_time', minStartBoundary)
        .lte('reminder_time', maxEndBoundary);

      if (userId && userId !== 'all') {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
        const uName = (userName || '').trim();
        if (isUuid) {
          if (uName) {
            query = query.or(`responsible_user_id.eq.${userId},created_by.eq.${userId},created_by.eq.${uName}`);
          } else {
            query = query.or(`responsible_user_id.eq.${userId},created_by.eq.${userId}`);
          }
        } else {
          if (uName) {
            query = query.or(`created_by.eq.${userId},created_by.eq.${uName}`);
          } else {
            query = query.eq('created_by', userId);
          }
        }
      }

      // Prioritize rows with has_time = true first, and order from earlier to later reminder_time
      query = query
        .order('has_time', { ascending: false, nullsFirst: false })
        .order('reminder_time', { ascending: true, nullsFirst: false })
        .order('date_time', { ascending: true })
        .range(offset, offset + limit - 1);

      const { data, count, error } = await query;
      if (error) {
        console.error('Supabase getDashboardTodayRemindersPaginated error:', error);
      }

      if (!error && data) {
        const totalCount = count !== null ? count : data.length;
        const vendorIds = data.map((item: any) => item.vendor_id).filter(Boolean);
        const vendorMap = await resolveVendorsMap(vendorIds);

        const decoded = data.map((c: any) => {
          const isDone = typeof c.is_completed === 'boolean' ? c.is_completed : (c.task_status === 'completed' || c.task_status === 'done');
          const cleanVId = c.vendor_id ? String(c.vendor_id).trim().toLowerCase() : '';
          const v = c.vendor_id ? (vendorMap.get(c.vendor_id) || vendorMap.get(cleanVId)) : null;
          const resolvedVendorName = (v?.trade_name || v?.company_name) || c.vendor_name || '';

          return {
            ...c,
            vendor_name: resolvedVendorName,
            vendor: v || null,
            is_completed: isDone,
            task_status: isDone ? 'completed' : 'pending',
            responsible_user_id: c.responsible_user_id || c.user_id,
            user_id: c.responsible_user_id || c.user_id
          } as Communication;
        });

        return {
          reminders: decoded,
          totalCount
        };
      }
    } catch (e) {
      console.warn('Supabase getDashboardTodayRemindersPaginated failed, falling back to local storage:', e);
    }
  }

  // Local fallback
  const localVendors = getLocal<any[]>(KEY_VENDORS, []);
  const vendorMap = new Map<string, any>();
  localVendors.forEach(v => {
    if (v && v.id) {
      vendorMap.set(v.id, v);
      vendorMap.set(String(v.id).trim().toLowerCase(), v);
    }
  });

  const localComms = getLocal<Communication[]>(KEY_COMMUNICATIONS, []);
  const minStartTime = new Date(minStartBoundary).getTime();
  const maxEndTime = new Date(maxEndBoundary).getTime();

  const allReminders = localComms.filter(c => {
    if (c.is_deleted || c.type !== 'reminder' || !c.reminder_time) return false;
    const raw = String(c.reminder_time);
    if (!raw) return false;
    if (raw.includes(tbilisiDate) || raw.includes(localDate)) return true;
    const time = new Date(raw).getTime();
    return !isNaN(time) && time >= minStartTime && time <= maxEndTime;
  });

  let filtered = allReminders;
  if (userId && userId !== 'all') {
    const selLower = userId.toLowerCase().trim();
    const nameLower = (userName || '').toLowerCase().trim();
    filtered = filtered.filter(c => {
      const respId = String(c.responsible_user_id || '').toLowerCase().trim();
      const usrId = String(c.user_id || '').toLowerCase().trim();
      const crtBy = String(c.created_by || '').toLowerCase().trim();
      if (respId === selLower || usrId === selLower || crtBy === selLower) return true;
      if (nameLower && (crtBy === nameLower || c.responsible_user_name?.toLowerCase().trim() === nameLower)) return true;
      return false;
    });
  }

  // Sort has_time = true first, then earlier reminder_time to later reminder_time
  filtered.sort((a, b) => {
    const aHasTime = !!a.has_time;
    const bHasTime = !!b.has_time;
    if (aHasTime && !bHasTime) return -1;
    if (!aHasTime && bHasTime) return 1;
    const aTime = a.reminder_time ? new Date(a.reminder_time).getTime() : (a.date_time ? new Date(a.date_time).getTime() : 0);
    const bTime = b.reminder_time ? new Date(b.reminder_time).getTime() : (b.date_time ? new Date(b.date_time).getTime() : 0);
    return aTime - bTime;
  });

  const sliced = filtered.slice(offset, offset + limit).map(c => {
    const isDone = typeof c.is_completed === 'boolean' ? c.is_completed : (c.task_status === 'completed' || c.task_status === 'done');
    const cleanVId = c.vendor_id ? String(c.vendor_id).trim().toLowerCase() : '';
    const v = c.vendor_id ? (vendorMap.get(c.vendor_id) || vendorMap.get(cleanVId)) : null;
    const resolvedVendorName = (v?.trade_name || v?.company_name) || c.vendor_name || '';

    return {
      ...c,
      vendor_name: resolvedVendorName,
      vendor: v || null,
      is_completed: isDone,
      task_status: isDone ? 'completed' : 'pending',
      responsible_user_id: c.responsible_user_id || c.user_id,
      user_id: c.responsible_user_id || c.user_id
    };
  });

  return {
    reminders: sliced,
    totalCount: filtered.length
  };
}
