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
        globalQueryClient?.invalidateQueries({ queryKey: [key] });
      });
    }
  }, 100);
}

const localClientId = typeof window !== 'undefined' 
  ? (window as any).__biodiesel_client_id || ((window as any).__biodiesel_client_id = Math.random().toString(36).substring(2) + Date.now().toString(36))
  : 'server';

export function ensureRealtimeConnected() {
  if (!isSupabaseConfigured || !supabase) return;
  if (!realtimeChannel || realtimeChannel.state === 'closed' || realtimeChannel.state === 'errored') {
    if (globalQueryClient) {
      initRealtimeBroadcast(globalQueryClient);
    }
  }
}

// Auto-reconnect realtime when mobile device wakes up, unlocks, or restores internet
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ensureRealtimeConnected();
    }
  });
  window.addEventListener('online', () => {
    ensureRealtimeConnected();
  });
}

const realtimeSuppressionUntil: Record<string, number> = {};

export function suppressRealtimeForTable(table: string, durationMs = 6000) {
  realtimeSuppressionUntil[table.toLowerCase()] = Date.now() + durationMs;
}

export function isRealtimeSuppressed(table: string): boolean {
  const until = realtimeSuppressionUntil[table.toLowerCase()];
  return Boolean(until && Date.now() < until);
}

export function initRealtimeBroadcast(queryClient: QueryClient) {
  globalQueryClient = queryClient;
  if (!isSupabaseConfigured || !supabase) return;

  const handleTableUpdate = (table: string, action?: string, recordId?: string, sourceClientId?: string) => {
    if (!table) return;

    // Check if table updates are temporarily suppressed for local batch/reordering operations
    if (isRealtimeSuppressed(table)) {
      return;
    }

    // Ignore self-echoes from our own local notifications
    if (sourceClientId && sourceClientId === localClientId) {
      return;
    }

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
    if (realtimeChannel) {
      try {
        supabase.removeChannel(realtimeChannel);
      } catch {}
    }

    realtimeChannel = supabase.channel(CHANNEL_NAME, {
      config: {
        broadcast: { self: false },
      },
    });

    realtimeChannel
      .on('broadcast', { event: 'db_change' }, (payload: { payload?: { table: string; action?: string; recordId?: string; clientId?: string } }) => {
        handleTableUpdate(payload?.payload?.table, payload?.payload?.action, payload?.payload?.recordId, payload?.payload?.clientId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
        handleTableUpdate('orders', payload?.eventType, payload?.new?.id || payload?.old?.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, (payload: any) => {
        handleTableUpdate('vehicles', payload?.eventType, payload?.new?.id || payload?.old?.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
        handleTableUpdate('profiles', payload?.eventType, payload?.new?.id || payload?.old?.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, (payload: any) => {
        handleTableUpdate('vendors', payload?.eventType, payload?.new?.id || payload?.old?.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
        handleTableUpdate(payload?.table, payload?.eventType, payload?.new?.id || payload?.old?.id);
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.debug('Realtime sync connected successfully');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('Realtime sync channel disconnected. Status:', status);
        }
      });
  } catch (err) {
    console.warn('Realtime channel initialization warning:', err);
  }
}

export function notifyDbChange(table: string, action: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE', recordId?: string) {
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
        payload: { table, action, recordId, clientId: localClientId, timestamp: Date.now() },
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
