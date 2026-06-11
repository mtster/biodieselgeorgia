/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { Venue, LogisticsTask, UserProfile, ActivityLog, UserRole } from '../types';

// Detect Supabase credentials
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

// Initialize Supabase Client if possible
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ==========================================
// SEED DATA FOR MOCK LOCALSTORAGE DATABASE
// ==========================================
const SEED_USERS: UserProfile[] = [
  { id: 'usr-admin', email: 'admin@biodiesel.ge', name: 'სანდრო კალანდაძე (ადმინი)', role: 'admin' },
  { id: 'usr-mgr1', email: 'giorgi@biodiesel.ge', name: 'გიორგი მებურიშვილი', role: 'manager', base_region: 'თბილისი' },
  { id: 'usr-mgr2', email: 'nino@biodiesel.ge', name: 'ნინო დევდარიანი', role: 'manager', base_region: 'ქუთაისი' },
  { id: 'usr-mgr3', email: 'levan@biodiesel.ge', name: 'ლევან კაპანაძე', role: 'manager', base_region: 'ბათუმი' },
  { id: 'usr-drv1', email: 'dato@biodiesel.ge', name: 'დათო კვარაცხელია', role: 'driver', phone: '599-11-22-33' },
  { id: 'usr-drv2', email: 'temo@biodiesel.ge', name: 'თემო შენგელია', role: 'driver', phone: '595-44-55-66' },
  { id: 'usr-drv3', email: 'zura@biodiesel.ge', name: 'ზურა ჯაფარიძე', role: 'driver', phone: '577-77-88-99' },
  { id: 'usr-venue1', email: 'khinkali@biodiesel.ge', name: 'ხინკლის სახლი (საბურთალო)', role: 'venue', venue_id: 'v-01' },
  { id: 'usr-venue2', email: 'machakhela@biodiesel.ge', name: 'მაჭახელა (კოტე აფხაზი)', role: 'venue', venue_id: 'v-02' }
];

const SEED_VENUES: Venue[] = [
  {
    id: 'v-01',
    trade_name: 'ხინკლის სახლი (საბურთალო)',
    legal_name: 'შპს ქართული კერძები',
    id_code: '204857392',
    bank_account: 'GE82TB1100000360401122',
    price_per_liter: 1.50,
    city: 'თბილისი',
    address: 'ვაჟა-ფშაველას გამზ. 25',
    district: 'საბურთალო',
    company_code: 'TBS-SAB-042',
    contact_person: 'ლადო კახაძე',
    contact_phones: '599-123-456 (მენეჯერი), 599-456-789 (მთავარი მზარეული)',
    contract_manager: 'გიორგი მებურიშვილი',
    operator: 'ნათია ანდრონიკაშვილი',
    created_at: '2026-05-01T12:00:00Z',
    last_pickup_date: '2026-05-28T14:30:00Z',
    average_interval_days: 12
  },
  {
    id: 'v-02',
    trade_name: 'მაჭახელა (კოტე აფხაზი)',
    legal_name: 'შპს აჭარული ხაჭაპური',
    id_code: '405029381',
    bank_account: 'GE45BG0000000192837465',
    price_per_liter: 1.40,
    city: 'თბილისი',
    address: 'კოტე აფხაზის ქ. 34',
    district: 'ძველი თბილისი',
    company_code: 'TBS-OLD-108',
    contact_person: 'თინათინ ბერიძე',
    contact_phones: '595-33-44-55 (დირექტორი)',
    contract_manager: 'გიორგი მებურიშვილი',
    operator: 'ნათია ანდრონიკაშვილი',
    created_at: '2026-05-02T10:00:00Z',
    last_pickup_date: '2026-06-02T16:00:00Z',
    average_interval_days: 10
  },
  {
    id: 'v-03',
    trade_name: 'რესტორანი პასანაური',
    legal_name: 'შპს პასანაური ჯგუფი',
    id_code: '204123547',
    bank_account: 'GE12TB1592648375928172',
    price_per_liter: 1.60,
    city: 'თბილისი',
    address: 'რუსთაველის გამზ. 37',
    district: 'მთაწმინდა',
    company_code: 'TBS-MT-015',
    contact_person: 'მიხეილი',
    contact_phones: '591-22-33-44 (საკონტაქტო)',
    contract_manager: 'ნინო დევდარიანი',
    operator: 'ალექსანდრე ხუციშვილი',
    created_at: '2026-05-05T09:30:00Z',
    last_pickup_date: '2026-05-15T11:00:00Z', // Overdue! Last pickup was a month ago
    average_interval_days: 14
  },
  {
    id: 'v-04',
    trade_name: 'შავი ლომი',
    legal_name: 'სს კულინარიული ხელოვნება',
    id_code: '404111222',
    bank_account: 'GE93BG0000000302010192',
    price_per_liter: 1.55,
    city: 'თბილისი',
    address: 'ამაღლების ქ. 23',
    district: 'სოლოლაკი',
    company_code: 'TBS-SOL-009',
    contact_person: 'ნუცა ბაგრატიონი',
    contact_phones: '599-99-99-88 (ადმინისტრატორი)',
    contract_manager: 'გიორგი მებურიშვილი',
    operator: 'ნათია ანდრონიკაშვილი',
    created_at: '2026-05-10T15:00:00Z',
    last_pickup_date: '2026-06-09T18:00:00Z',
    average_interval_days: 8
  },
  {
    id: 'v-05',
    trade_name: 'იმერული გემო',
    legal_name: 'ინდ. მეწარმე დავით გაბუნია',
    id_code: '600010293',
    bank_account: 'GE55LB0112233445566778',
    price_per_liter: 1.30,
    city: 'ქუთაისი',
    address: 'ჭავჭავაძის გამზ. 18',
    district: 'ცენტრი',
    company_code: 'KUT-CTR-001',
    contact_person: 'დათო გაბუნია',
    contact_phones: '555-88-77-66',
    contract_manager: 'ნინო დევდარიანი',
    operator: 'ალექსანდრე ხუციშვილი',
    created_at: '2026-05-12T11:00:00Z',
    last_pickup_date: '2026-05-20T10:00:00Z', // Overdue
    average_interval_days: 15
  },
  {
    id: 'v-06',
    trade_name: 'ბათუმი ფიშ ჰაუსი',
    legal_name: 'შპს შავი ზღვის ნობათი',
    id_code: '445239102',
    bank_account: 'GE62TB0908070605040302',
    price_per_liter: 1.45,
    city: 'ბათუმი',
    address: 'გოგებაშვილის ქ. 3',
    district: 'პორტი',
    company_code: 'BAT-PRT-004',
    contact_person: 'მალხაზი',
    contact_phones: '597-44-88-22',
    contract_manager: 'ლევან კაპანაძე',
    operator: 'ხატია მამულაძე',
    created_at: '2026-05-15T14:00:00Z',
    last_pickup_date: '2026-06-05T12:00:00Z',
    average_interval_days: 12
  }
];

const SEED_TASKS: LogisticsTask[] = [
  {
    id: 't-01',
    venue_id: 'v-01',
    venue_name: 'ხინკლის სახლი (საბურთალო)',
    venue_address: 'ვაჟა-ფშაველას გამზ. 25',
    venue_district: 'საბურთალო',
    driver_id: 'usr-drv1',
    driver_name: 'დათო კვარაცხელია',
    status: 'assigned',
    tanks_to_remove: 3,
    tanks_to_leave: 3,
    notes: 'კაპები შეამოწმეთ, წინა ჯერზე დაზიანებული იყო',
    working_hours: '11:00 - 23:00',
    created_at: '2026-06-10T09:00:00Z',
    created_by_name: 'გიორგი მებურიშვილი'
  },
  {
    id: 't-02',
    venue_id: 'v-02',
    venue_name: 'მაჭახელა (კოტე აფხაზი)',
    venue_address: 'კოტე აფხაზის ქ. 34',
    venue_district: 'ძველი თბილისი',
    driver_id: 'usr-drv1',
    driver_name: 'დათო კვარაცხელია',
    status: 'completed',
    tanks_to_remove: 2,
    tanks_to_leave: 2,
    notes: 'ავზების გამოცვლა სწრაფად',
    working_hours: '10:00 - 22:00',
    actual_liters: 120,
    created_at: '2026-06-02T10:00:00Z',
    completed_at: '2026-06-02T16:00:00Z',
    created_by_name: 'გიორგი მებურიშვილი'
  },
  {
    id: 't-03',
    venue_id: 'v-04',
    venue_name: 'შავი ლომი',
    venue_address: 'ამაღლების ქ. 23',
    venue_district: 'სოლოლაკი',
    driver_id: 'usr-drv2',
    driver_name: 'თემო შენგელია',
    status: 'completed',
    tanks_to_remove: 1,
    tanks_to_leave: 1,
    working_hours: '13:00 - 01:00',
    actual_liters: 55,
    created_at: '2026-06-09T11:00:00Z',
    completed_at: '2026-06-09T18:00:00Z',
    created_by_name: 'გიორგი მებურიშვილი'
  },
  {
    id: 't-04',
    venue_id: 'v-03',
    venue_name: 'რესტორანი პასანაური',
    venue_address: 'რუსთაველის გამზ. 37',
    venue_district: 'მთაწმინდა',
    status: 'pending',
    tanks_to_remove: 4,
    tanks_to_leave: 4,
    notes: 'საჭიროა დიდი მანქანა, ბევრი ზეთია დაგროვილი',
    working_hours: '24/7',
    created_at: '2026-06-11T08:30:00Z',
    created_by_name: 'ნინო დევდარიანი'
  }
];

const SEED_LOGS: ActivityLog[] = [
  {
    id: 'log-01',
    user_name: 'სანდრო კალანდაძე (ადმინი)',
    user_role: 'ადმინისტრატორი',
    action_type: 'სისტემის გაშვება',
    details: 'ბიოდიზელ ჯორჯიას პორტალის ინიციალიზაცია წარმატებით დასრულდა',
    created_at: '2026-06-11T08:00:00Z'
  },
  {
    id: 'log-02',
    user_name: 'გიორგი მებურიშვილი',
    user_role: 'მენეჯერი',
    action_type: 'დავალების შექმნა',
    details: 'შეიქმნა ახალი დავალება ობიექტისთვის: ხინკლის სახლი (საბურთალო), მძღოლი: დათო კვარაცხელია',
    created_at: '2026-06-10T09:05:00Z'
  }
];

// Helper to load/save from LocalStorage
const getLocalStorage = <T>(key: string, preset: T): T => {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(preset));
    return preset;
  }
  return JSON.parse(data) as T;
};

const setLocalStorage = <T>(key: string, data: T): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Local storage keys
const KEY_USERS = 'biodiesel_users';
const KEY_VENUES = 'biodiesel_venues';
const KEY_TASKS = 'biodiesel_tasks';
const KEY_LOGS = 'biodiesel_logs';

// Initialize Simulated Database
export const localDB = {
  getUsers: () => getLocalStorage<UserProfile[]>(KEY_USERS, SEED_USERS),
  setUsers: (users: UserProfile[]) => setLocalStorage(KEY_USERS, users),

  getVenues: () => getLocalStorage<Venue[]>(KEY_VENUES, SEED_VENUES),
  setVenues: (venues: Venue[]) => setLocalStorage(KEY_VENUES, venues),

  getTasks: () => getLocalStorage<LogisticsTask[]>(KEY_TASKS, SEED_TASKS),
  setTasks: (tasks: LogisticsTask[]) => setLocalStorage(KEY_TASKS, tasks),

  getLogs: () => getLocalStorage<ActivityLog[]>(KEY_LOGS, SEED_LOGS),
  setLogs: (logs: ActivityLog[]) => setLocalStorage(KEY_LOGS, logs),

  reset: () => {
    localStorage.removeItem(KEY_USERS);
    localStorage.removeItem(KEY_VENUES);
    localStorage.removeItem(KEY_TASKS);
    localStorage.removeItem(KEY_LOGS);
    return {
      users: getLocalStorage<UserProfile[]>(KEY_USERS, SEED_USERS),
      venues: getLocalStorage<Venue[]>(KEY_VENUES, SEED_VENUES),
      tasks: getLocalStorage<LogisticsTask[]>(KEY_TASKS, SEED_TASKS),
      logs: getLocalStorage<ActivityLog[]>(KEY_LOGS, SEED_LOGS),
    };
  }
};

// ==========================================
// HIGH LEVEL API (Auto-fallback to Sim-DB)
// ==========================================

export async function addLog(userName: string, userRole: string, actionType: string, details: string) {
  const newLog: ActivityLog = {
    id: 'log-' + Math.random().toString(36).substr(2, 9),
    user_name: userName,
    user_role: userRole,
    action_type: actionType,
    details,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('activity_logs').insert([newLog]);
    } catch (e) {
      console.error('Supabase error, logging locally:', e);
    }
  }

  // Always keep simulated in sync as fallback
  const logs = localDB.getLogs();
  localDB.setLogs([newLog, ...logs]);
}

// 1. Venues (ობიექტები)
export async function getVenues(): Promise<Venue[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('venues').select('*').order('trade_name', { ascending: true });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getVenues failed - returning simulated data', e);
    }
  }
  return localDB.getVenues();
}

export async function saveVenue(venue: Venue, editorName: string, editorRole: string): Promise<Venue> {
  const isNew = !venue.id || venue.id === '';
  const finalVenue = {
    ...venue,
    id: isNew ? 'v-' + Math.random().toString(36).substr(2, 9) : venue.id,
    created_at: venue.created_at || new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('venues').insert([finalVenue]);
      } else {
        await supabase.from('venues').update(finalVenue).eq('id', finalVenue.id);
      }
    } catch (e) {
      console.error('Supabase write failed', e);
    }
  }

  // Local sync
  const venues = localDB.getVenues();
  if (isNew) {
    localDB.setVenues([...venues, finalVenue]);
    await addLog(
      editorName,
      editorRole,
      'ობიექტის დამატება',
      `დაემატა ახალი ობიექტი: ${finalVenue.trade_name} (კოდი: ${finalVenue.company_code})`
    );
  } else {
    localDB.setVenues(venues.map(v => v.id === finalVenue.id ? finalVenue : v));
    await addLog(
      editorName,
      editorRole,
      'ობიექტის რედაქტირება',
      `რედაქტირდა ობიექტი: ${finalVenue.trade_name}. ცვლილება განახორციელა ${editorName}-მა.`
    );
  }

  return finalVenue;
}

export async function deleteVenue(venueId: string, tradeName: string, editorName: string, editorRole: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('venues').delete().eq('id', venueId);
    } catch (e) {
      console.error('Supabase delete failed', e);
    }
  }

  const venues = localDB.getVenues();
  localDB.setVenues(venues.filter(v => v.id !== venueId));

  // Remove corresponding tasks
  const tasks = localDB.getTasks();
  localDB.setTasks(tasks.filter(t => t.venue_id !== venueId));

  await addLog(
    editorName,
    editorRole,
    'ობიექტის წაშლა',
    `სისტემიდან წაიშალა ობიექტი: ${tradeName}`
  );

  return true;
}

// 2. Logistics & Tasks (ლოგისტიკა და დავალებები)
export async function getTasks(): Promise<LogisticsTask[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getTasks failed', e);
    }
  }
  return localDB.getTasks();
}

export async function saveTask(task: LogisticsTask, editorName: string, editorRole: string): Promise<LogisticsTask> {
  const isNew = !task.id || task.id === '';
  const finalTask = {
    ...task,
    id: isNew ? 't-' + Math.random().toString(36).substr(2, 9) : task.id,
    created_at: task.created_at || new Date().toISOString()
  };

  if (isSupabaseConfigured && supabase) {
    try {
      if (isNew) {
        await supabase.from('tasks').insert([finalTask]);
      } else {
        await supabase.from('tasks').update(finalTask).eq('id', finalTask.id);
      }
    } catch (e) {
      console.error('Supabase write task failed', e);
    }
  }

  const tasks = localDB.getTasks();
  if (isNew) {
    localDB.setTasks([finalTask, ...tasks]);
    await addLog(
      editorName,
      editorRole,
      'დავალების შექმნა',
      `შეიქმნა დავალება: ${finalTask.venue_name}-დან ${finalTask.tanks_to_remove} ავზის წასაღებად და ${finalTask.tanks_to_leave} ავზის დასატოვებლად`
    );
  } else {
    localDB.setTasks(tasks.map(t => t.id === finalTask.id ? finalTask : t));
    await addLog(
      editorName,
      editorRole,
      'დავალების განახლება',
      `განახლდა დავალება #${finalTask.id} (${finalTask.venue_name}) - სტატუსი: ${translateStatus(finalTask.status)}`
    );
  }

  return finalTask;
}

// 3. Complete Task by Driver (დავალების შესრულება მძღოლის მიერ)
export async function completeTask(taskId: string, liters: number, driverName: string): Promise<LogisticsTask | null> {
  const tasks = localDB.getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;

  const completedTask: LogisticsTask = {
    ...task,
    status: 'completed',
    actual_liters: liters,
    completed_at: new Date().toISOString()
  };

  // Update venue's last pickup date
  const venues = localDB.getVenues();
  const updatedVenues = venues.map(v => {
    if (v.id === task.venue_id) {
      // Recalculate average interval days if there was a previous pickup
      let newInterval = v.average_interval_days;
      if (v.last_pickup_date) {
        const last = new Date(v.last_pickup_date).getTime();
        const current = new Date().getTime();
        const diffDays = Math.max(1, Math.round((current - last) / (1000 * 60 * 60 * 24)));
        newInterval = v.average_interval_days
          ? Math.round((v.average_interval_days + diffDays) / 2)
          : diffDays;
      }
      return {
        ...v,
        last_pickup_date: completedTask.completed_at,
        average_interval_days: newInterval
      };
    }
    return v;
  });

  localDB.setVenues(updatedVenues);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('tasks').update(completedTask).eq('id', taskId);
      await supabase.from('venues').update({
        last_pickup_date: completedTask.completed_at
      }).eq('id', task.venue_id);
    } catch (e) {
      console.error('Supabase complete task failed', e);
    }
  }

  // Save updated task locally
  localDB.setTasks(tasks.map(t => t.id === taskId ? completedTask : t));

  await addLog(
    driverName,
    'მძღოლი',
    'დავალების დასრულება',
    `მძღოლმა ${driverName} წარმატებით წაიღო ${liters} ლიტრი ზეთი ობიექტიდან: ${task.venue_name}`
  );

  // Return completed task
  return completedTask;
}

// 4. Users & Authentication Mock (მომხმარებლების მართვა)
export async function getUsers(): Promise<UserProfile[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('user_profiles').select('*');
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getUsers failed', e);
    }
  }
  return localDB.getUsers();
}

export async function updateUserRole(userId: string, newRole: UserRole, venueId?: string, baseRegion?: string, editorName = 'ადმინი'): Promise<boolean> {
  const users = localDB.getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return false;

  const targetUser = users[index];
  const updatedUser: UserProfile = {
    ...targetUser,
    role: newRole,
    venue_id: venueId,
    base_region: baseRegion
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('user_profiles').update({
        role: newRole,
        venue_id: venueId,
        base_region: baseRegion
      }).eq('id', userId);
    } catch (e) {
      console.error('Supabase database role update failed', e);
    }
  }

  users[index] = updatedUser;
  localDB.setUsers(users);

  await addLog(
    editorName,
    'ადმინისტრატორი',
    'უფლებების შეცვლა',
    `მომხმარებელს ${targetUser.name} შეეცვალა როლი. ახალი როლი: ${translateRole(newRole)}`
  );

  return true;
}

// 5. Audit Log (ლოგები)
export async function getActivityLogs(): Promise<ActivityLog[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getActivityLogs failed', e);
    }
  }
  return localDB.getLogs();
}

// ==========================================
// BUSINESS LOGIC & ANALYTICS HELPER METHODS
// ==========================================

export function translateStatus(status: string): string {
  switch (status) {
    case 'pending': return 'მოსამზადებელი (რიგში)';
    case 'assigned': return 'დანიშნული მძღოლი';
    case 'completed': return 'შესრულებული';
    default: return status;
  }
}

export function translateRole(role: string): string {
  switch (role) {
    case 'admin': return 'ადმინისტრატორი';
    case 'manager': return 'მენეჯერი';
    case 'driver': return 'მძღოლი';
    case 'venue': return 'ობიექტი (რესტორანი)';
    default: return role;
  }
}

// Calculate if a venue is overdue for pickup (გადაცილებული ობიექტები)
export function getOverdueVenues(venues: Venue[]): Venue[] {
  const now = new Date().getTime();
  const fifteenDaysInMs = 15 * 24 * 60 * 60 * 1000;

  return venues.filter(v => {
    if (!v.last_pickup_date) {
      // If it has never been picked up, check if the creation date is older than 15 days
      const created = new Date(v.created_at).getTime();
      return (now - created) > fifteenDaysInMs;
    }
    const lastPickup = new Date(v.last_pickup_date).getTime();
    const intervalLimit = v.average_interval_days
      ? v.average_interval_days * 24 * 60 * 60 * 1000
      : fifteenDaysInMs;

    // It's overdue if time since last pickup exceeds the limit (or default 15 days)
    return (now - lastPickup) > intervalLimit;
  });
}

// Simulated automated notifications (SMS, Push FCM simulation)
export interface NotificationMessage {
  id: string;
  sender: string;
  recipient: string;
  text: string;
  sent_at: string;
}

export function sendNotificationSim(sender: string, recipient: string, text: string): void {
  const notifs = getLocalStorage<NotificationMessage[]>('biodiesel_notifications', []);
  const newNotif: NotificationMessage = {
    id: 'n-' + Math.random().toString(36).substr(2, 9),
    sender,
    recipient,
    text,
    sent_at: new Date().toISOString()
  };
  setLocalStorage('biodiesel_notifications', [newNotif, ...notifs]);
}

export function getNotificationsSim(): NotificationMessage[] {
  return getLocalStorage<NotificationMessage[]>('biodiesel_notifications', []);
}
