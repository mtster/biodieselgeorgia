import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Truck } from '../types';
import { trackChange } from './historyService';
import { KEY_TRUCKS, getLocal, setLocal } from './localStorage';

export { KEY_TRUCKS };

export const DEFAULT_TRUCKS: Truck[] = [];

export async function getTrucks(): Promise<Truck[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('trucks').select('*').eq('is_deleted', false).order('plate_number');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getTrucks failed', e);
    }
  }
  return getLocal<Truck[]>(KEY_TRUCKS, DEFAULT_TRUCKS).filter(item => !item.is_deleted);
}

export async function saveTruck(truck: Truck, loggerName: string): Promise<Truck> {
  const list = getLocal<Truck[]>(KEY_TRUCKS, DEFAULT_TRUCKS);
  const exists = list.some(t => t.plate_number === truck.plate_number);

  if (isSupabaseConfigured && supabase) {
    try {
      if (!exists) {
        await supabase.from('trucks').insert([truck]);
      } else {
        await supabase.from('trucks').update(truck).eq('plate_number', truck.plate_number);
      }
    } catch (e) {
      console.error('Supabase saveTruck failed', e);
    }
  }

  if (!exists) {
    setLocal(KEY_TRUCKS, [...list, truck]);
    await trackChange(loggerName, 'Truck added', 'Plate Number', '', truck.plate_number);
  } else {
    setLocal(KEY_TRUCKS, list.map(item => item.plate_number === truck.plate_number ? truck : item));
    await trackChange(loggerName, 'Truck updated', 'Model', '', truck.model);
  }
  return truck;
}

export async function deleteTruck(plate: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('trucks').update({ is_deleted: true }).eq('plate_number', plate);
    } catch (e) {
      console.error('Supabase deleteTruck failed', e);
    }
  }

  const list = getLocal<Truck[]>(KEY_TRUCKS, DEFAULT_TRUCKS);
  setLocal(KEY_TRUCKS, list.map(item => item.plate_number === plate ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Truck deleted', 'Plate Number', plate, '');
  return true;
}
