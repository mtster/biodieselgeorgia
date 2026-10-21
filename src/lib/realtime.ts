import { QueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from './supabase';
import { User } from '../types';
import { appCache } from '../utils/cache';
import { defaultPermissions } from '../components/users/UserForm';

// Relational dependency map: maps updated DB table to all dependent Query Keys
export const DB_DEPENDENCY_MAP: Record<string, string[]> = {
  profiles: ['users', 'orders', 'vendors', 'communications', 'contacts', 'trucks'],
  vendors: ['vendors', 'contacts', 'communications', 'orders'],
  orders: ['orders'],
  vendor_contacts: ['contacts', 'vendors'],
  communications: ['communications'],
  vendor_communications: ['communications'],
  warehouses: ['warehouses'],
  cities: ['cities'],
  districts: ['districts'],
  directions: ['directions'],
  vehicles: ['trucks', 'orders'],
};

const CHANNEL_NAME = 'biodiesel_app_live_updates';

let realtimeChannel: any = null;
let globalQueryClient: QueryClient | null = null;
const changeListeners = new Set<(table: string, action?: string, recordId?: string) => void>();

export function onRealtimeDbChange(listener: (table: string, action?: string, recordId?: string) => void) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

const lastTableUpdate: Record<string, number> = {};

const pendingInvalidationKeys = new Set<string>();
let invalidationTimer: any = null;

export function debouncedInvalidateQueries(keys: string[]) {
  keys.forEach(k => pendingInvalidationKeys.add(k));
  if (invalidationTimer) {
    clearTimeout(invalidationTimer);
  }
  invalidationTimer = setTimeout(() => {
    if (globalQueryClient && pendingInvalidationKeys.size > 0) {
      const keysToRun = Array.from(pendingInvalidationKeys);
      pendingInvalidationKeys.clear();
      keysToRun.forEach(key => {
        globalQueryClient?.invalidateQueries({ queryKey: [key], refetchType: 'active' });
      });
    }
  }, 100);
}

export function initRealtimeBroadcast(queryClient: QueryClient) {
  globalQueryClient = queryClient;
  if (!isSupabaseConfigured || !supabase) return;

  const handleTableUpdate = (table: string, action?: string, recordId?: string) => {
    if (!table) return;
    const now = Date.now();
    const last = lastTableUpdate[table] || 0;
    if (now - last < 2000) {
      return; // Deduplicate rapid multiple events / self-echoes for the same table
    }
    lastTableUpdate[table] = now;

    // Targeted cache eviction: only invalidate in-memory cache entries for this specific table
    appCache.clear(table);

    const dependentKeys = DB_DEPENDENCY_MAP[table] || [table];
    debouncedInvalidateQueries(dependentKeys);

    changeListeners.forEach((listener) => {
      try {
        listener(table, action, recordId);
      } catch (e) {
        console.warn('Realtime listener callback error:', e);
      }
    });
  };

  try {
    realtimeChannel = supabase.channel(CHANNEL_NAME, {
      config: {
        broadcast: { self: false },
      },
    });

    realtimeChannel
      .on('broadcast', { event: 'db_change' }, (payload: { payload?: { table: string; action?: string; recordId?: string } }) => {
        handleTableUpdate(payload?.payload?.table, payload?.payload?.action, payload?.payload?.recordId);
      })
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
        handleTableUpdate(payload?.table, payload?.eventType, payload?.new?.id || payload?.old?.id);
      })
      .subscribe();
  } catch (err) {
    console.warn('Realtime channel initialization warning:', err);
  }
}

export function notifyDbChange(table: string, action: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE', recordId?: string) {
  const now = Date.now();
  // Mark local update timestamp to ignore subsequent echo from realtime websocket
  lastTableUpdate[table] = now;
  if (table === 'vendors') {
    lastTableUpdate['vendor_contacts'] = now;
  } else if (table === 'vendor_contacts') {
    lastTableUpdate['vendors'] = now;
  }

  // Clear in-memory query cache only for the target table
  appCache.clear(table);

  // Invalidate TanStack Query cache locally for active components of the acting user
  if (globalQueryClient) {
    const dependentKeys = DB_DEPENDENCY_MAP[table] || [table];
    debouncedInvalidateQueries(dependentKeys);
  }

  changeListeners.forEach((listener) => {
    try {
      listener(table, action, recordId);
    } catch (e) {
      console.warn('Local notify listener error:', e);
    }
  });

  if (realtimeChannel && isSupabaseConfigured) {
    try {
      realtimeChannel.send({
        type: 'broadcast',
        event: 'db_change',
        payload: { table, action, recordId, timestamp: Date.now() },
      });
    } catch (err) {
      console.warn('Failed to broadcast DB change:', err);
    }
  }
}

/**
 * Check if current user has permission to view a specific module/page.
 * Returns false if permission was revoked in JWT/session metadata, preventing database queries.
 */
export function hasModuleViewPermission(currentUser: User | null, moduleName: string): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'driver' || currentUser.role === 'driver_assistant') {
    return moduleName === 'orders' || moduleName === 'logistics' || moduleName === 'directions';
  }
  if (currentUser.role === 'vendor') {
    return moduleName === 'orders' || moduleName === 'vendors' || moduleName === 'suppliers';
  }
  const userPerms = (currentUser.permissions && Object.keys(currentUser.permissions).length > 0)
    ? (currentUser.permissions as Record<string, any>)
    : ((defaultPermissions[currentUser.role] || {}) as Record<string, any>);
  let modulePerms = userPerms[moduleName];
  if (modulePerms === undefined) {
    if (moduleName === 'users') modulePerms = userPerms['employees'];
    else if (moduleName === 'employees') modulePerms = userPerms['users'];
    else if (moduleName === 'suppliers') modulePerms = userPerms['vendors'];
    else if (moduleName === 'vendors') modulePerms = userPerms['suppliers'];
    else if (moduleName === 'vehicles') modulePerms = userPerms['transports'] ?? userPerms['trucks'];
    else if (moduleName === 'transports' || moduleName === 'trucks') modulePerms = userPerms['vehicles'];
  }
  if (!modulePerms) return false;
  if (Array.isArray(modulePerms)) {
    return modulePerms.includes('view');
  }
  if (typeof modulePerms === 'object' && modulePerms !== null) {
    return !!(modulePerms as any).view;
  }
  return !!modulePerms;
}
