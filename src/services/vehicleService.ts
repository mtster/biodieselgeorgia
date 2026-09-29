import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vehicle } from '../types';
import { trackChange } from './historyService';
import { KEY_TRUCKS as KEY_VEHICLES, getLocal, setLocal } from './localStorage';
import { notifyDbChange } from '../lib/realtime';

export { KEY_VEHICLES };

export const DEFAULT_VEHICLES: Vehicle[] = [];

export function decodeVehicle(vehicle: any): Vehicle {
  if (!vehicle) return vehicle;
  let city = vehicle.city || '';
  let warehouse_id = vehicle.warehouse_id || '';

  if (city.includes('::wh_')) {
    const parts = city.split('::wh_');
    city = parts[0];
    warehouse_id = parts[1];
  }

  return {
    ...vehicle,
    city: city || undefined,
    warehouse_id: warehouse_id || undefined
  };
}

export async function getVehicles(): Promise<Vehicle[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('vehicles').select('*').eq('is_deleted', false).order('plate_number');
      if (!error && data) return data.map(v => decodeVehicle(v));
      
      const { data: fallbackData, error: fallbackError } = await supabase.from('trucks').select('*').eq('is_deleted', false).order('plate_number');
      if (!fallbackError && fallbackData) return fallbackData.map(v => decodeVehicle(v));
    } catch (e) {
      console.warn('Supabase getVehicles failed, trying trucks table...', e);
      try {
        const { data, error } = await supabase.from('trucks').select('*').eq('is_deleted', false).order('plate_number');
        if (!error && data) return data.map(v => decodeVehicle(v));
      } catch (err) {
        console.error('Unified getVehicles fallback failed', err);
      }
    }
  }
  return getLocal<Vehicle[]>(KEY_VEHICLES, DEFAULT_VEHICLES).filter(item => !item.is_deleted).map(v => decodeVehicle(v));
}

export async function findDeletedVehicle(plate: string): Promise<Vehicle | null> {
  const cleanPlate = (plate || '').trim().toUpperCase();
  if (!cleanPlate) return null;

  // 1. Fast check in local cache (0ms)
  const list = getLocal<Vehicle[]>(KEY_VEHICLES, DEFAULT_VEHICLES);
  const localFound = list.find(t => (t.plate_number || '').trim().toUpperCase() === cleanPlate && t.is_deleted);
  if (localFound) {
    return decodeVehicle(localFound);
  }

  // 2. High-performance exact match query on vehicles table
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('plate_number', cleanPlate)
        .eq('is_deleted', true)
        .maybeSingle();

      if (!error && data) {
        return decodeVehicle(data);
      }
    } catch (e) {
      console.warn('Supabase findDeletedVehicle query:', e);
    }
  }

  return null;
}

export async function saveVehicle(vehicle: Vehicle & { password?: string; original_plate_number?: string }, loggerName: string, currentUserId?: string): Promise<Vehicle> {
  const list = getLocal<Vehicle[]>(KEY_VEHICLES, DEFAULT_VEHICLES);
  const isValidUuid = (val: string | null | undefined): boolean => {
    if (!val) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  };

  const existsIndex = list.findIndex(t => 
    (isValidUuid(vehicle.id) && t.id === vehicle.id) ||
    (vehicle.original_plate_number && t.plate_number === vehicle.original_plate_number) ||
    t.plate_number === vehicle.plate_number
  );

  let authUserId = vehicle.auth_user_id;

  const cleanCurrentPlate = (vehicle.plate_number || '').trim().toUpperCase();
  const cleanOriginalPlate = (vehicle.original_plate_number || '').trim().toUpperCase();
  const plateChanged = Boolean(cleanOriginalPlate && cleanOriginalPlate !== cleanCurrentPlate);
  const hasPassword = Boolean(vehicle.password && vehicle.password.trim());

  // Require explicit password input by user when creating a new vehicle (NO default fallback)
  const isNewVehicle = !isValidUuid(vehicle.id) && !cleanOriginalPlate && existsIndex < 0;
  if (isNewVehicle && (!hasPassword || vehicle.password!.trim().length < 6)) {
    throw new Error('პაროლის შეყვანა (მინ. 6 სიმბოლო) სავალდებულოა ახალი ავტომობილის შესაქმნელად.');
  }

  if (isSupabaseConfigured && supabase) {
    // If authUserId not present, check database vehicles table
    if (!isValidUuid(authUserId)) {
      try {
        const queryPlates = [cleanCurrentPlate];
        if (cleanOriginalPlate) queryPlates.push(cleanOriginalPlate);
        const { data: vRows } = await supabase.from('vehicles').select('auth_user_id').in('plate_number', queryPlates);
        const found = vRows?.find(r => r.auth_user_id && isValidUuid(r.auth_user_id))?.auth_user_id;
        if (found) {
          authUserId = found;
          vehicle.auth_user_id = found;
        }
      } catch (_) {}
    }

    const needsAuthSync = hasPassword || plateChanged || !authUserId;

    if (needsAuthSync) {
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        const payload = {
          plate_number: cleanCurrentPlate,
          password: vehicle.password?.trim() || undefined,
          auth_user_id: isValidUuid(authUserId) ? authUserId : undefined,
          original_plate_number: cleanOriginalPlate || undefined,
          vehicle_id: isValidUuid(vehicle.id) ? vehicle.id : undefined,
          action: 'vehicle_create_or_update'
        };

        const tryEndpoints = [
          '/api/create-vehicle-account',
          '/create-vehicle-account',
          '/api/create-user'
        ];

        let synced = false;
        for (const ep of tryEndpoints) {
          try {
            const res = await fetch(ep, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              },
              body: JSON.stringify(payload)
            });

            if (res.ok) {
              const resData = await res.json();
              if (resData.auth_user_id) {
                authUserId = resData.auth_user_id;
                vehicle.auth_user_id = resData.auth_user_id;
                synced = true;
                break;
              }
            } else if (res.status !== 404) {
              const errData = await res.json().catch(() => ({}));
              console.warn(`Vehicle auth endpoint ${ep} warning:`, res.status, errData);
              break;
            }
          } catch (_) {}
        }

        // If not synced via Express proxy endpoints, try Supabase Edge Function fallback
        if (!synced && token) {
          try {
            const functionUrl = `${(import.meta as any).env?.VITE_SUPABASE_URL || ''}/functions/v1/create-user`;
            const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
            const edgeRes = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(payload)
            });
            if (edgeRes.ok) {
              const resData = await edgeRes.json();
              if (resData.auth_user_id) {
                authUserId = resData.auth_user_id;
                vehicle.auth_user_id = resData.auth_user_id;
              }
            }
          } catch (edgeErr) {
            console.warn('Edge function vehicle sync error:', edgeErr);
          }
        }
      } catch (err) {
        console.error('Failed to create/update vehicle auth account:', err);
      }
    }

    try {
      const cleanUserUuid = (val: string | null | undefined): string | null => {
        if (!val) return null;
        if (val === 'user-admin') return '00000000-0000-4000-a000-000000000000';
        if (val.startsWith('user-')) {
          const suffix = val.substring(5).padEnd(11, '0').slice(0, 11);
          return `00000000-0000-4000-b000-${suffix}`.toLowerCase();
        }
        if (isValidUuid(val)) return val;
        return null;
      };

      const rawCreatedBy = vehicle.created_by || currentUserId || null;
      const createdBy = cleanUserUuid(rawCreatedBy);

      const dbPayload: any = {
        ...(isValidUuid(vehicle.id) ? { id: vehicle.id } : {}),
        plate_number: cleanCurrentPlate,
        model: vehicle.model,
        driver_id: isValidUuid(vehicle.driver_id) ? vehicle.driver_id : null,
        companion_id: isValidUuid(vehicle.companion_id) ? vehicle.companion_id : null,
        city: vehicle.city || null,
        direction_id: vehicle.direction_id || null,
        warehouse_id: vehicle.warehouse_id || null,
        created_by: createdBy,
        auth_user_id: isValidUuid(authUserId) ? authUserId : null,
        is_deleted: vehicle.is_deleted ?? false
      };

      const { id: _ignoreId, ...updateFields } = dbPayload;
      updateFields.is_deleted = vehicle.is_deleted ?? false;
      let success = false;

      // 1. If we have an existing record ID, perform an UPDATE by ID (checking if row was actually updated)
      if (isValidUuid(vehicle.id)) {
        const { data: upRows, error: updateErr } = await supabase
          .from('vehicles')
          .update(updateFields)
          .eq('id', vehicle.id)
          .select('id');

        if (!updateErr && upRows && upRows.length > 0) {
          success = true;
        } else if (updateErr) {
          console.warn('Update vehicle by ID failed, trying fallback:', updateErr);
        }
      }

      // 2. If ID update was not applicable or 0 rows updated, try by original plate
      if (!success && cleanOriginalPlate) {
        const { data: upRows, error: plateUpdateErr } = await supabase
          .from('vehicles')
          .update(updateFields)
          .eq('plate_number', cleanOriginalPlate)
          .select('id');

        if (!plateUpdateErr && upRows && upRows.length > 0) {
          success = true;
        }
      }

      // 3. Fallback / New vehicle -> UPSERT into database
      if (!success) {
        const { error: upsertErr } = await supabase
          .from('vehicles')
          .upsert([dbPayload], { onConflict: 'plate_number' });

        if (!upsertErr) {
          success = true;
        } else {
          console.warn('Vehicle upsert failed, attempting schema fallback:', upsertErr);
          const fallbackCity = vehicle.city ? `${vehicle.city}::wh_${vehicle.warehouse_id || ''}` : `::wh_${vehicle.warehouse_id || ''}`;
          const fallbackPayload: any = {
            plate_number: cleanCurrentPlate,
            model: vehicle.model,
            driver_id: isValidUuid(vehicle.driver_id) ? vehicle.driver_id : null,
            companion_id: isValidUuid(vehicle.companion_id) ? vehicle.companion_id : null,
            city: fallbackCity,
            direction_id: vehicle.direction_id || null,
            is_deleted: vehicle.is_deleted ?? false,
            created_by: createdBy,
            auth_user_id: isValidUuid(authUserId) ? authUserId : null
          };

          const { error: fbErr } = await supabase.from('vehicles').upsert([fallbackPayload], { onConflict: 'plate_number' });
          if (!fbErr) success = true;
        }
      }

      // 6. Legacy trucks fallback only if trucks table actually exists
      if (!success) {
        try {
          const fallbackCity = vehicle.city ? `${vehicle.city}::wh_${vehicle.warehouse_id || ''}` : `::wh_${vehicle.warehouse_id || ''}`;
          const trucksPayload = {
            plate_number: vehicle.plate_number,
            model: vehicle.model,
            driver_id: isValidUuid(vehicle.driver_id) ? vehicle.driver_id : null,
            companion_id: isValidUuid(vehicle.companion_id) ? vehicle.companion_id : null,
            city: fallbackCity,
            is_deleted: vehicle.is_deleted ?? false
          };
          const { error: trErr } = await supabase.from('trucks').upsert([trucksPayload], { onConflict: 'plate_number' });
          if (trErr && trErr.code !== 'PGRST205' && trErr.code !== '42P01') {
            console.warn('Fallback trucks upsert result:', trErr);
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn('Supabase saveVehicle operation:', e);
    }
  }

  if (existsIndex >= 0) {
    const updatedList = [...list];
    const prev = updatedList[existsIndex];
    const isRecovering = prev.is_deleted && !(vehicle.is_deleted ?? false);
    updatedList[existsIndex] = { ...prev, ...vehicle, is_deleted: vehicle.is_deleted ?? false, plate_number: cleanCurrentPlate, id: prev.id || vehicle.id };
    setLocal(KEY_VEHICLES, updatedList);
    if (isRecovering) {
      await trackChange(loggerName, 'Vehicle recovered', 'Plate Number', '', cleanCurrentPlate);
    } else {
      if (plateChanged) {
        await trackChange(loggerName, 'Vehicle updated', 'Plate Number', cleanOriginalPlate, cleanCurrentPlate);
      }
      if (prev.model !== vehicle.model) {
        await trackChange(loggerName, 'Vehicle updated', 'Model', prev.model || '', vehicle.model);
      }
    }
    notifyDbChange('vehicles', 'UPDATE', cleanCurrentPlate);
  } else {
    setLocal(KEY_VEHICLES, [...list, { ...vehicle, is_deleted: vehicle.is_deleted ?? false, plate_number: cleanCurrentPlate }]);
    await trackChange(loggerName, 'Vehicle added', 'Plate Number', '', cleanCurrentPlate);
    notifyDbChange('vehicles', 'CREATE', cleanCurrentPlate);
  }
  return decodeVehicle({ ...vehicle, is_deleted: vehicle.is_deleted ?? false, plate_number: cleanCurrentPlate });
}

export async function deleteVehicle(plate: string, loggerName: string): Promise<boolean> {
  const cleanPlate = (plate || '').trim().toUpperCase();

  if (isSupabaseConfigured && supabase) {
    try {
      // Find auth_user_id before marking deleted
      let authUserIdToDelete: string | null = null;
      try {
        const { data: vData } = await supabase.from('vehicles').select('auth_user_id').eq('plate_number', cleanPlate).maybeSingle();
        if (vData?.auth_user_id) {
          authUserIdToDelete = vData.auth_user_id;
        }
      } catch (_) {}

      const { error } = await supabase.from('vehicles').update({ is_deleted: true }).eq('plate_number', cleanPlate);
      if (error) {
        await supabase.from('trucks').update({ is_deleted: true }).eq('plate_number', cleanPlate);
      }

      // Delete vehicle auth account so it doesn't leave orphaned redundant accounts
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (token) {
          const deletePayload = JSON.stringify({
            plate_number: cleanPlate,
            auth_user_id: authUserIdToDelete
          });
          const delRes = await fetch('/api/delete-vehicle-account', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: deletePayload
          });
          if (delRes.status === 404) {
            await fetch('/delete-vehicle-account', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: deletePayload
            });
          }
        }
      } catch (authErr) {
        console.warn('Failed to delete vehicle auth user:', authErr);
      }
    } catch (e) {
      try {
        await supabase.from('trucks').update({ is_deleted: true }).eq('plate_number', cleanPlate);
      } catch (err) {
        console.error('Supabase deleteVehicle fallback failed', err);
      }
    }
  }

  const list = getLocal<Vehicle[]>(KEY_VEHICLES, DEFAULT_VEHICLES);
  setLocal(KEY_VEHICLES, list.map(item => item.plate_number === cleanPlate ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Vehicle deleted', 'Plate Number', cleanPlate, '');
  notifyDbChange('vehicles', 'DELETE', cleanPlate);
  return true;
}
