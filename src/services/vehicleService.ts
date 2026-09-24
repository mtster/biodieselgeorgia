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

  if (isSupabaseConfigured && supabase) {
    if (vehicle.password) {
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        const res = await fetch('/api/create-vehicle-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            plate_number: vehicle.plate_number,
            password: vehicle.password
          })
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData.auth_user_id) {
            authUserId = resData.auth_user_id;
          }
        } else {
          console.warn('Vehicle auth creation warning:', await res.json().catch(() => ({})));
        }
      } catch (err) {
        console.error('Failed to create vehicle auth account:', err);
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
        plate_number: vehicle.plate_number,
        model: vehicle.model,
        driver_id: isValidUuid(vehicle.driver_id) ? vehicle.driver_id : null,
        companion_id: isValidUuid(vehicle.companion_id) ? vehicle.companion_id : null,
        city: vehicle.city || null,
        direction_id: vehicle.direction_id || null,
        warehouse_id: vehicle.warehouse_id || null,
        created_by: createdBy,
        auth_user_id: isValidUuid(authUserId) ? authUserId : null
      };

      let success = false;

      // 1. If we have an existing record ID, perform an UPDATE by ID
      if (isValidUuid(vehicle.id)) {
        const { error: updateErr } = await supabase.from('vehicles').update(dbPayload).eq('id', vehicle.id);
        if (!updateErr) {
          success = true;
        }
      }

      // 2. If ID update was not possible but we have original_plate_number, update by original plate
      if (!success && vehicle.original_plate_number) {
        const { error: plateUpdateErr } = await supabase.from('vehicles').update(dbPayload).eq('plate_number', vehicle.original_plate_number);
        if (!plateUpdateErr) {
          success = true;
        }
      }

      // 3. Fallback upsert / insert
      if (!success) {
        const { error } = await supabase.from('vehicles').upsert([dbPayload], { onConflict: isValidUuid(dbPayload.id) ? 'id' : 'plate_number' });
        if (!error) {
          success = true;
        } else {
          // Schema fallback if optional columns missing
          const fallbackCity = vehicle.city ? `${vehicle.city}::wh_${vehicle.warehouse_id || ''}` : `::wh_${vehicle.warehouse_id || ''}`;
          const fallbackPayload: any = {
            plate_number: vehicle.plate_number,
            model: vehicle.model,
            driver_id: isValidUuid(vehicle.driver_id) ? vehicle.driver_id : null,
            companion_id: isValidUuid(vehicle.companion_id) ? vehicle.companion_id : null,
            city: fallbackCity,
            direction_id: vehicle.direction_id || null
          };

          const { error: fbErr } = await supabase.from('vehicles').upsert([fallbackPayload], { onConflict: 'plate_number' });
          if (!fbErr) {
            success = true;
          } else {
            const minPayload = {
              plate_number: vehicle.plate_number,
              model: vehicle.model,
              driver_id: isValidUuid(vehicle.driver_id) ? vehicle.driver_id : null,
              companion_id: isValidUuid(vehicle.companion_id) ? vehicle.companion_id : null,
              city: vehicle.city || null
            };
            const { error: minErr } = await supabase.from('vehicles').upsert([minPayload], { onConflict: 'plate_number' });
            if (!minErr) success = true;
          }
        }
      }

      // 4. Legacy trucks fallback only if trucks table actually exists
      if (!success) {
        try {
          const fallbackCity = vehicle.city ? `${vehicle.city}::wh_${vehicle.warehouse_id || ''}` : `::wh_${vehicle.warehouse_id || ''}`;
          const trucksPayload = {
            plate_number: vehicle.plate_number,
            model: vehicle.model,
            driver_id: isValidUuid(vehicle.driver_id) ? vehicle.driver_id : null,
            companion_id: isValidUuid(vehicle.companion_id) ? vehicle.companion_id : null,
            city: fallbackCity
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
    updatedList[existsIndex] = { ...prev, ...vehicle, id: prev.id || vehicle.id };
    setLocal(KEY_VEHICLES, updatedList);
    await trackChange(loggerName, 'Vehicle updated', 'Model', prev.model || '', vehicle.model);
    notifyDbChange('vehicles', 'UPDATE', vehicle.plate_number);
  } else {
    setLocal(KEY_VEHICLES, [...list, vehicle]);
    await trackChange(loggerName, 'Vehicle added', 'Plate Number', '', vehicle.plate_number);
    notifyDbChange('vehicles', 'CREATE', vehicle.plate_number);
  }
  return decodeVehicle(vehicle);
}

export async function deleteVehicle(plate: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('vehicles').update({ is_deleted: true }).eq('plate_number', plate);
      if (error) {
        await supabase.from('trucks').update({ is_deleted: true }).eq('plate_number', plate);
      }
    } catch (e) {
      try {
        await supabase.from('trucks').update({ is_deleted: true }).eq('plate_number', plate);
      } catch (err) {
        console.error('Supabase deleteVehicle fallback failed', err);
      }
    }
  }

  const list = getLocal<Vehicle[]>(KEY_VEHICLES, DEFAULT_VEHICLES);
  setLocal(KEY_VEHICLES, list.map(item => item.plate_number === plate ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Vehicle deleted', 'Plate Number', plate, '');
  notifyDbChange('vehicles', 'DELETE', plate);
  return true;
}
