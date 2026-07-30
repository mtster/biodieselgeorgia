import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Warehouse, City, District, Direction } from '../types';
import { trackChange } from './historyService';
import { 
  KEY_WAREHOUSES, KEY_CITIES, KEY_DISTRICTS, KEY_DIRECTIONS,
  getLocal, setLocal 
} from './localStorage';
import { notifyDbChange } from '../lib/realtime';

export { KEY_WAREHOUSES, KEY_CITIES, KEY_DISTRICTS, KEY_DIRECTIONS };

export const DEFAULT_WAREHOUSES: Warehouse[] = [];
export const DEFAULT_CITIES: City[] = [];
export const DEFAULT_DISTRICTS: District[] = [];
export const DEFAULT_DIRECTIONS: Direction[] = [];

const cleanUserUuid = (val: string | null | undefined): string | null => {
  if (!val) return null;
  if (val === 'import') return 'import';
  if (val === 'user-admin') return '00000000-0000-4000-a000-000000000000';
  if (val.startsWith('user-')) {
    const suffix = val.substring(5).padEnd(11, '0').slice(0, 11);
    return `00000000-0000-4000-b000-${suffix}`.toLowerCase();
  }
  return val;
};

// 1. Warehouses
export async function getWarehouses(): Promise<Warehouse[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('warehouses').select('*').order('name');
      if (!error && data) return data.filter((w: any) => !w.is_deleted);
    } catch (e) {
      console.warn('Supabase getWarehouses failed', e);
    }
  }
  return getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES).filter(w => !w.is_deleted);
}

export async function saveWarehouse(wh: Warehouse, loggerName: string, currentUserId?: string): Promise<Warehouse> {
  const isNew = !wh.id;
  const createdBy = cleanUserUuid(isNew ? (currentUserId || wh.created_by) : (wh.created_by || currentUserId));
  const finalWh = {
    ...wh,
    id: isNew ? 'wh-' + Math.random().toString(36).substring(2, 9) : wh.id,
    created_by: createdBy || wh.created_by
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
    notifyDbChange('warehouses', 'CREATE', finalWh.id);
  } else {
    setLocal(KEY_WAREHOUSES, list.map(item => item.id === finalWh.id ? finalWh : item));
    await trackChange(loggerName, 'Warehouse updated', 'Name', '', finalWh.name);
    notifyDbChange('warehouses', 'UPDATE', finalWh.id);
  }
  return finalWh;
}

export async function deleteWarehouse(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('warehouses').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteWarehouse failed', e);
    }
  }

  const list = getLocal<Warehouse[]>(KEY_WAREHOUSES, DEFAULT_WAREHOUSES);
  setLocal(KEY_WAREHOUSES, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Warehouse deleted', 'Name', name, '');
  notifyDbChange('warehouses', 'DELETE', id);
  return true;
}

// 2. Cities
export async function getCities(): Promise<City[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('cities').select('*').order('name');
      if (!error && data) {
        return data.filter((c: any) => !c.is_deleted);
      }
    } catch (e) {
      console.warn('Supabase getCities failed', e);
    }
  }
  return getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES).filter(item => !item.is_deleted);
}

export async function saveCity(city: City, loggerName: string, currentUserId?: string): Promise<City> {
  const isNew = !city.id;
  const createdBy = cleanUserUuid(isNew ? (currentUserId || city.created_by) : (city.created_by || currentUserId));
  const finalCity = {
    ...city,
    id: isNew ? 'city-' + Math.random().toString(36).substring(2, 9) : city.id,
    created_by: createdBy || city.created_by
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
    notifyDbChange('cities', 'CREATE', finalCity.id);
  } else {
    setLocal(KEY_CITIES, list.map(item => item.id === finalCity.id ? finalCity : item));
    await trackChange(loggerName, 'City updated', 'Name', '', finalCity.name);
    notifyDbChange('cities', 'UPDATE', finalCity.id);
  }
  return finalCity;
}

export async function deleteCity(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('cities').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteCity failed', e);
    }
  }

  const list = getLocal<City[]>(KEY_CITIES, DEFAULT_CITIES);
  setLocal(KEY_CITIES, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'City deleted', 'Name', name, '');
  notifyDbChange('cities', 'DELETE', id);
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

export async function saveDistrict(dist: District, loggerName: string, currentUserId?: string): Promise<District> {
  const isNew = !dist.id;
  const createdBy = cleanUserUuid(isNew ? (currentUserId || dist.created_by) : (dist.created_by || currentUserId));
  const finalDist = {
    ...dist,
    id: isNew ? 'dist-' + Math.random().toString(36).substring(2, 9) : dist.id,
    created_by: createdBy || dist.created_by
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
    notifyDbChange('districts', 'CREATE', finalDist.id);
  } else {
    setLocal(KEY_DISTRICTS, list.map(item => item.id === finalDist.id ? finalDist : item));
    await trackChange(loggerName, 'District updated', 'Name', '', finalDist.name);
    notifyDbChange('districts', 'UPDATE', finalDist.id);
  }
  return finalDist;
}

export async function deleteDistrict(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('districts').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteDistrict failed', e);
    }
  }

  const list = getLocal<District[]>(KEY_DISTRICTS, DEFAULT_DISTRICTS);
  setLocal(KEY_DISTRICTS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'District deleted', 'Name', name, '');
  notifyDbChange('districts', 'DELETE', id);
  return true;
}

// 4. Directions
export async function getDirections(): Promise<Direction[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('directions').select('*').order('name');
      if (!error && data) {
        return data.filter((d: any) => !d.is_deleted);
      }
    } catch (e) {
      console.warn('Supabase getDirections failed', e);
    }
  }
  return getLocal<Direction[]>(KEY_DIRECTIONS, DEFAULT_DIRECTIONS).filter(item => !item.is_deleted);
}

export async function saveDirection(dir: Direction, loggerName: string, currentUserId?: string): Promise<Direction> {
  const isNew = !dir.id;
  const createdBy = cleanUserUuid(isNew ? (currentUserId || dir.created_by) : (dir.created_by || currentUserId));
  const finalDir = {
    ...dir,
    id: isNew ? 'dir-' + Math.random().toString(36).substring(2, 9) : dir.id,
    created_by: createdBy || dir.created_by
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('directions').insert([finalDir]);
      } else {
        await supabase.from('directions').update(finalDir).eq('id', finalDir.id);
      }
    } catch (e) {
      console.error('Supabase saveDirection failed', e);
    }
  }

  const list = getLocal<Direction[]>(KEY_DIRECTIONS, DEFAULT_DIRECTIONS);
  if (isNew) {
    setLocal(KEY_DIRECTIONS, [...list, finalDir]);
    await trackChange(loggerName, 'Direction added', 'Name', '', finalDir.name);
    notifyDbChange('directions', 'CREATE', finalDir.id);
  } else {
    setLocal(KEY_DIRECTIONS, list.map(item => item.id === finalDir.id ? finalDir : item));
    await trackChange(loggerName, 'Direction updated', 'Name', '', finalDir.name);
    notifyDbChange('directions', 'UPDATE', finalDir.id);
  }
  return finalDir;
}

export async function deleteDirection(id: string, name: string, loggerName: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('directions').update({ is_deleted: true }).eq('id', id);
    } catch (e) {
      console.error('Supabase deleteDirection failed', e);
    }
  }

  const list = getLocal<Direction[]>(KEY_DIRECTIONS, DEFAULT_DIRECTIONS);
  setLocal(KEY_DIRECTIONS, list.map(item => item.id === id ? { ...item, is_deleted: true } : item));
  await trackChange(loggerName, 'Direction deleted', 'Name', name, '');
  notifyDbChange('directions', 'DELETE', id);
  return true;
}
