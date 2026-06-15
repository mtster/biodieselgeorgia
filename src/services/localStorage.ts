export const KEY_USERS = 'biodiesel_users_v2';
export const KEY_VENDORS = 'biodiesel_vendors_v2';
export const KEY_ORDERS = 'biodiesel_orders_v2';
export const KEY_COMMUNICATIONS = 'biodiesel_communications_v2';
export const KEY_TRUCKS = 'biodiesel_trucks_v2';
export const KEY_CHANGE_HISTORY = 'biodiesel_change_history_v2';
export const KEY_WAREHOUSES = 'biodiesel_warehouses_v2';
export const KEY_CITIES = 'biodiesel_cities_v2';
export const KEY_DISTRICTS = 'biodiesel_districts_v2';

export function getLocal<T>(key: string, preset: T): T {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(preset));
    return preset;
  }
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    return preset;
  }
}

export function setLocal<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function resetSystemDatabase(): void {
  localStorage.removeItem(KEY_USERS);
  localStorage.removeItem(KEY_VENDORS);
  localStorage.removeItem(KEY_ORDERS);
  localStorage.removeItem(KEY_COMMUNICATIONS);
  localStorage.removeItem(KEY_TRUCKS);
  localStorage.removeItem(KEY_CHANGE_HISTORY);
  localStorage.removeItem(KEY_WAREHOUSES);
  localStorage.removeItem(KEY_CITIES);
  localStorage.removeItem(KEY_DISTRICTS);
  localStorage.removeItem('biodiesel_sms_logs');
  localStorage.removeItem('biodiesel_notifications');
}

