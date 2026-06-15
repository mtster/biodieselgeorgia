import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vehicle } from '../types';
import { trackChange } from './historyService';
import { KEY_TRUCKS as KEY_VEHICLES, getLocal, setLocal } from './localStorage';

export { KEY_VEHICLES };

export const DEFAULT_VEHICLES: Vehicle[] = [];

export async function getVehicles(): Promise<Vehicle[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('vehicles').select('*').eq('is_deleted', false).order('plate_number');
      if (!error && data) return data;
      
      const { data: fallbackData, error: fallbackError } = await supabase.from('trucks').select('*').eq('is_deleted', false).order('plate_number');
      if (!fallbackError && fallbackData) return fallbackData;
    } catch (e) {
      console.warn('Supabase getVehicles failed, trying trucks table...', e);
      try {
        const { data, error } = await supabase.from('trucks').select('*').eq('is_deleted', false).order('plate_number');
        if (!error && data) return data;
      } catch (err) {
        console.error('Unified getVehicles fallback failed', err);
      }
    }
  }
  return getLocal<Vehicle[]>(KEY_VEHICLES, DEFAULT_VEHICLES).filter(item => !item.is_deleted);
}

export async function saveVehicle(vehicle: Vehicle, loggerName: string): Promise<Vehicle> {
  const list = getLocal<Vehicle[]>(KEY_VEHICLES, DEFAULT_VEHICLES);
  const exists = list.some(t => t.plate_number === vehicle.plate_number);

  if (isSupabaseConfigured && supabase) {
    try {
      const isValidUuid = (val: string | null | undefined): boolean => {
        if (!val) return false;
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      };

      const dbPayload = {
        plate_number: vehicle.plate_number,
        model: vehicle.model,
        driver_id: isValidUuid(vehicle.driver_id) ? vehicle.driver_id : null,
        companion_id: isValidUuid(vehicle.companion_id) ? vehicle.companion_id : null,
      };

      let success = false;
      try {
        const { error } = await supabase.from('vehicles').upsert([dbPayload], { onConflict: 'plate_number' });
        if (!error) success = true;
        else console.warn('Supabase saveVehicle upsert to vehicles table failed', error);
      } catch (e) {
        console.warn('vehicles table upsert exception, falling back to trucks', e);
      }

      if (!success) {
        const { error } = await supabase.from('trucks').upsert([dbPayload], { onConflict: 'plate_number' });
        if (error) console.error('Supabase saveVehicle upsert failed as fallback on trucks:', error);
      }
    } catch (e) {
      console.error('Supabase saveVehicle failed completely', e);
    }
  }

  if (!exists) {
    setLocal(KEY_VEHICLES, [...list, vehicle]);
    await trackChange(loggerName, 'Vehicle added', 'Plate Number', '', vehicle.plate_number);
  } else {
    setLocal(KEY_VEHICLES, list.map(item => item.plate_number === vehicle.plate_number ? vehicle : item));
    await trackChange(loggerName, 'Vehicle updated', 'Model', '', vehicle.model);
  }
  return vehicle;
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
  return true;
}
