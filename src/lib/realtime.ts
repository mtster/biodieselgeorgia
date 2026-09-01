import { QueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from './supabase';
import { User } from '../types';
import { appCache } from '../utils/cache';

// Relational dependency map: maps updated DB table to all dependent Query Keys
export const DB_DEPENDENCY_MAP: Record<string, string[]> = {
  profiles: ['users', 'orders', 'vendors', 'communications', 'contacts', 'trucks'],
  vendors: ['vendors', 'contacts', 'communications', 'orders'],
  orders: ['orders'],
  vendor_contacts: ['contacts', 'vendors'],
  communications: ['communications', 'vendors'],
  vendor_communications: ['communications', 'vendors'],
  warehouses: ['warehouses', 'vendors', 'orders'],
  cities: ['cities', 'vendors'],
  districts: ['districts', 'vendors'],
  directions: ['directions', 'vendors'],
  vehicles: ['trucks', 'orders'],
};

const CHANNEL_NAME = 'biodiesel_app_live_updates';

let realtimeChannel: any = null;
let globalQueryClient: QueryClient | null = null;

export function initRealtimeBroadcast(queryClient: QueryClient) {
  globalQueryClient = queryClient;
  if (!isSupabaseConfigured || !supabase) return;

  try {
    realtimeChannel = supabase.channel(CHANNEL_NAME, {
      config: {
        broadcast: { self: true },
      },
    });

    realtimeChannel
      .on('broadcast', { event: 'db_change' }, (payload: { payload?: { table: string } }) => {
        const table = payload?.payload?.table;
        if (!table) return;

        // Clear in-memory query cache so refetches get fresh data
        appCache.clear();

        const dependentKeys = DB_DEPENDENCY_MAP[table] || [table];
        
        dependentKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload: any) => {
        const table = payload?.table;
        if (!table) return;

        appCache.clear();

        const dependentKeys = DB_DEPENDENCY_MAP[table] || [table];
        dependentKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      })
      .subscribe();
  } catch (err) {
    console.warn('Realtime channel initialization warning:', err);
  }
}

export function notifyDbChange(table: string, action: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE', recordId?: string) {
  // Clear in-memory query cache immediately
  appCache.clear();

  // Invalidate TanStack Query cache locally for the acting client user
  if (globalQueryClient) {
    const dependentKeys = DB_DEPENDENCY_MAP[table] || [table];
    dependentKeys.forEach((key) => {
      globalQueryClient?.invalidateQueries({ queryKey: [key] });
    });
  }

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
  if (currentUser.role === 'driver') {
    return moduleName === 'orders' || moduleName === 'logistics' || moduleName === 'directions';
  }
  if (currentUser.role === 'vendor') {
    return moduleName === 'orders' || moduleName === 'vendors' || moduleName === 'suppliers';
  }
  const userPerms = (currentUser.permissions || {}) as Record<string, any>;
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
