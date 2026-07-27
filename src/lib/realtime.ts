import { QueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from './supabase';
import { User } from '../types';

// Relational dependency map: maps updated DB table to all dependent Query Keys
export const DB_DEPENDENCY_MAP: Record<string, string[]> = {
  profiles: ['users', 'orders', 'vendors', 'communications', 'contacts', 'trucks'],
  vendors: ['vendors', 'contacts', 'communications', 'orders'],
  orders: ['orders'],
  vendor_contacts: ['contacts', 'vendors'],
  vendor_communications: ['communications', 'vendors'],
  warehouses: ['warehouses', 'vendors', 'orders'],
  cities: ['cities', 'vendors'],
  districts: ['districts', 'vendors'],
  directions: ['directions', 'vendors'],
  vehicles: ['trucks', 'orders'],
};

const CHANNEL_NAME = 'biodiesel_app_live_updates';

let realtimeChannel: any = null;

export function initRealtimeBroadcast(queryClient: QueryClient) {
  if (!isSupabaseConfigured || !supabase) return;

  try {
    realtimeChannel = supabase.channel(CHANNEL_NAME);

    realtimeChannel
      .on('broadcast', { event: 'db_change' }, (payload: { payload?: { table: string } }) => {
        const table = payload?.payload?.table;
        if (!table) return;

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
    return moduleName === 'orders' || moduleName === 'logistics';
  }
  if (currentUser.role === 'vendor') {
    return moduleName === 'orders' || moduleName === 'vendors';
  }
  const userPerms = currentUser.permissions || {};
  const modulePerms = (userPerms as Record<string, any>)[moduleName];
  if (!modulePerms) return false;
  if (Array.isArray(modulePerms)) {
    return modulePerms.includes('view');
  }
  if (typeof modulePerms === 'object' && modulePerms !== null) {
    return !!(modulePerms as any).view;
  }
  return !!modulePerms;
}
