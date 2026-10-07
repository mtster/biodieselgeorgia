import { User, Order } from '../../types';
import { KEY_ORDERS } from '../localStorage';

export { KEY_ORDERS };

export function isDateTodayTbilisi(dateVal?: string | Date | null): boolean {
  if (!dateVal) return false;
  try {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());
    const dStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date(dateVal));
    return dStr === today;
  } catch {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());
    return String(dateVal).slice(0, 10) === today;
  }
}

export function checkIsLogisticsManager(user?: User | null): boolean {
  if (user?.role === 'logistics_manager') return true;
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('currentUser') || localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.role === 'logistics_manager') return true;
      }
    } catch {}
  }
  return false;
}

export const isValidUuid = (val: any): boolean =>
  typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

export interface PaginatedOrdersResult {
  orders: Order[];
  totalCount: number;
}
