import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Warehouse, City, District } from '../types';
import { trackChange } from './historyService';
import { 
  KEY_WAREHOUSES, KEY_CITIES, KEY_DISTRICTS, 
  getLocal, setLocal 
} from './localStorage';

export { KEY_WAREHOUSES, KEY_CITIES, KEY_DISTRICTS };

export const DEFAULT_WAREHOUSES: Warehouse[] = [];
export const DEFAULT_CITIES: City[] = [];
export const DEFAULT_DISTRICTS: District[] = [];

// 1. Warehouses
export async function getWarehouses(): Promise<Warehouse[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('warehouses').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getWarehouses failed', e);
    }
  }
  return getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
}

export async function saveWarehouse(wh: Warehouse, loggerName: string): Promise<Warehouse> {
  const isNew = !wh.id;
  const finalWh = {
    ...wh,
    id: isNew ? 'wh-' + Math.random().toString(36).substring(2, 9) : wh.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('warehouses').insert([finalWh]);
      } else {
        await supabase.from('warehouses').update(finalWh).eq('id', finalWh.id);
      }
    } catch (e) {
      console.error('Supabase saveWarehouse failed', e);
    }
  }

  const list = getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
  if (isNew) {
    setLocal(KEY_WAREHOUSES, [...list, finalWh]);
    await trackChange(loggerName, 'Warehouse added', 'Name', '', finalWh.name);
  } else {
    setLocal(KEY_WAREHOUSES, list.map(item => item.id === finalWh.id ? finalWh : item));
    await trackChange(loggerName, 'Warehouse updated', 'Name', '', finalWh.name);
  }
  return finalWh;
}

export async function deleteWarehouse(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('warehouses').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteWarehouse failed', e);
    }
  }

  const list = getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
  setLocal(KEY_WAREHOUSES, list.filter(item => item.id !== id));
  await trackChange(loggerName, 'Warehouse deleted', 'Name', name, '');
  return true;
}

// 2. Cities
export async function getCities(): Promise<City[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('cities').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getCities failed', e);
    }
  }
  return getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
}

export async function saveCity(city: City, loggerName: string): Promise<City> {
  const isNew = !city.id;
  const finalCity = {
    ...city,
    id: isNew ? 'city-' + Math.random().toString(36).substring(2, 9) : city.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('cities').insert([finalCity]);
      } else {
        await supabase.from('cities').update(finalCity).eq('id', finalCity.id);
      }
    } catch (e) {
      console.error('Supabase saveCity failed', e);
    }
  }

  const list = getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
  if (isNew) {
    setLocal(KEY_CITIES, [...list, finalCity]);
    await trackChange(loggerName, 'City added', 'Name', '', finalCity.name);
  } else {
    setLocal(KEY_CITIES, list.map(item => item.id === finalCity.id ? finalCity : item));
    await trackChange(loggerName, 'City updated', 'Name', '', finalCity.name);
  }
  return finalCity;
}

export async function deleteCity(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('cities').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteCity failed', e);
    }
  }

  const list = getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
  setLocal(KEY_CITIES, list.filter(item => item.id !== id));
  await trackChange(loggerName, 'City deleted', 'Name', name, '');
  return true;
}

// 3. Districts
export async function getDistricts(): Promise<District[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('districts').select('*').order('name');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getDistricts failed', e);
    }
  }
  return getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
}

export async function saveDistrict(dist: District, loggerName: string): Promise<District> {
  const isNew = !dist.id;
  const finalDist = {
    ...dist,
    id: isNew ? 'dist-' + Math.random().toString(36).substring(2, 9) : dist.id
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('districts').insert([finalDist]);
      } else {
        await supabase.from('districts').update(finalDist).eq('id', finalDist.id);
      }
    } catch (e) {
      console.error('Supabase saveDistrict failed', e);
    }
  }

  const list = getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
  if (isNew) {
    setLocal(KEY_DISTRICTS, [...list, finalDist]);
    await trackChange(loggerName, 'District added', 'Name', '', finalDist.name);
  } else {
    setLocal(KEY_DISTRICTS, list.map(item => item.id === finalDist.id ? finalDist : item));
    await trackChange(loggerName, 'District updated', 'Name', '', finalDist.name);
  }
  return finalDist;
}

export async function deleteDistrict(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('districts').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteDistrict failed', e);
    }
  }

  const list = getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
  setLocal(KEY_DISTRICTS, list.filter(item => item.id !== id));
  await trackChange(loggerName, 'District deleted', 'Name', name, '');
  return true;
}
