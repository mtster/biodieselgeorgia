import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Vehicle } from '../types';
import { trackChange } from './historyService';
import { KEY_TRUCKS as KEY_VEHICLES, getLocal, setLocal } from './localStorage';

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
        city: vehicle.city || null,
      };

      let success = false;
      try {
        // Try upserting with warehouse_id column
        const payloadWithWh = { ...dbPayload, warehouse_id: vehicle.warehouse_id || null };
        const { error } = await supabase.from('vehicles').upsert([payloadWithWh], { onConflict: 'plate_number' });
        if (!error) {
          success = true;
        } else if (error.code === 'PGRST204' || error.message?.includes('warehouse_id')) {
          // Fallback: encode warehouse_id in city field to bypass missing column error
          const fallbackCity = vehicle.city ? `${vehicle.city}::wh_${vehicle.warehouse_id || ''}` : `::wh_${vehicle.warehouse_id || ''}`;
          const fallbackPayload = { ...dbPayload, city: fallbackCity };
          const { error: fbErr } = await supabase.from('vehicles').upsert([fallbackPayload], { onConflict: 'plate_number' });
          if (!fbErr) success = true;
          else console.warn('Vehicles upsert without warehouse_id col failed', fbErr);
        } else {
          console.warn('General error in vehicles upsert', error);
        }
      } catch (e) {
        console.warn('vehicles table upsert exception, trying fallback', e);
      }

      if (!success) {
        const fallbackCity = vehicle.city ? `${vehicle.city}::wh_${vehicle.warehouse_id || ''}` : `::wh_${vehicle.warehouse_id || ''}`;
        const fallbackPayload = { ...dbPayload, city: fallbackCity };
        const { error } = await supabase.from('trucks').upsert([fallbackPayload], { onConflict: 'plate_number' });
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
  return true;
}
