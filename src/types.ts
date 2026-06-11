/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'manager' | 'driver' | 'venue';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  venue_id?: string; // If role is 'venue'
  base_region?: string; // If role is 'manager'
  phone?: string;
}

export interface Venue {
  id: string;
  trade_name: string;      // სავაჭრო სახელი
  legal_name: string;      // იურიდიული სახელი
  id_code: string;         // საიდენტიფიკაციო კოდი
  bank_account: string;    // საბანკო ანგარიში
  price_per_liter: number; // ფასი ლიტრზე
  city: string;            // ქალაქი
  address: string;         // ფიზიკური მისამართი
  district: string;        // რაიონი
  company_code: string;    // კომპანიის მიერ მინიჭებული კოდი (თბილისი)
  contact_person: string;  // მთავარი საკონტაქტო პირი
  contact_phones: string;  // დამატებითი საკონტაქტო ნომრები და ინფორმაცია
  contract_manager: string;// ობიექტის ხელშემკვრელი მენეჯერი
  operator: string;        // ოპერატორი
  created_at: string;
  last_pickup_date?: string;
  average_interval_days?: number;
}

export type TaskStatus = 'pending' | 'assigned' | 'completed';

export interface LogisticsTask {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_address: string;
  venue_district?: string;
  driver_id?: string;
  driver_name?: string;
  status: TaskStatus;
  tanks_to_remove: number; // წასაღები ავზები
  tanks_to_leave: number;  // დასატოვებელი ავზები
  notes?: string;          // კომენტარი
  working_hours?: string;   // სამუშაო საათები
  actual_liters?: number;  // მძღოლის მიერ ფაქტობრივად აღებული ლიტრაჟი
  created_at: string;
  completed_at?: string;
  created_by_name: string;
}

export interface ActivityLog {
  id: string;
  user_name: string;
  user_role: string;
  action_type: string;     // მოქმედების ტიპი
  details: string;         // დეტალები
  created_at: string;
}

export interface SupplierSummary {
  venue_id: string;
  trade_name: string;
  month: string;           // YYYY-MM格式
  total_liters: number;
  total_pickups: number;
}
