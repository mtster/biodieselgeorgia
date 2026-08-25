/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'manager' | 'driver' | 'operator' | 'logistics_manager' | 'purchasing_manager' | 'purchasing_head' | 'vendor';

export interface PermissionsConfig {
  [page: string]: string[];
}

export interface User {
  id: string;
  name: string;
  personal_id: string; // პირადი ნომერი
  email: string;
  password?: string;
  phone: string;
  role: UserRole;
  permissions?: PermissionsConfig;
  is_deleted?: boolean;
  is_blocked?: boolean;
  created_at?: string;
  created_by?: string;
  warehouse_id?: string;      // საწყობი
  vendor_id?: string;         // მომწოდებელი (Vendor ID for supplier role)
}

export interface VendorContact {
  id: string;
  vendor_id?: string;
  name: string;
  phone: string;
  position: 'director' | 'manager' | 'object_number' | 'accountant' | 'cook' | 'other'; // დირექტორი/მფლობელი, მენეჯერი, ობიექტის ნომერი, ბუღალტერი, მზარეული, სხვა თანამდებობა
  note?: string;
  email?: string;
  is_default: boolean;
  sort_order?: number;
  is_deleted?: boolean;
  created_at?: string;
  created_by?: string;
}

export interface VendorComment {
  id: string;
  comment: string;
  date: string;
  user_name: string;
}

export interface Vendor {
  id: string;
  id_code: string;            // კომპანიის საიდენტიფიკაციო კოდი
  company_name: string;       // კომპანიის დასახელება
  trade_name: string;         // ობიექტის სავაჭრო დასახელება
  company_code: string;       // კოდი
  bank_account: string;       // საბანკო ანგარიში
  city: string;               // ქალაქი
  district: string;           // უბანი
  address: string;            // მისამართი
  price_per_liter: number;    // ლიტრის ღირებულება
  warehouse_id: string;       // საწყობი
  manager_id: string;         // მენეჯერი
  operator_id: string;        // ოპერატორი
  created_by?: string;
  contacts: VendorContact[];  // კონტაქტები
  comments: VendorComment[];  // კომენტარები
  working_hours: string;      // სამუშაო საათები
  status?: 'Active' | 'Under Negotiation' | 'Cancelled';
  is_active?: boolean;
  barrels_amount?: number;    // Barrels amount
  is_deleted?: boolean;
  created_at: string;
  direction_id?: string;      // მიმართულება
  overdue_threshold_days?: number | null; // ვადა (დღეები)
  is_planned?: boolean;       // გეგმიური
  planned_weekday?: string;   // კვირის დღე
  user_id?: string;           // მომხმარებლის ID
  username?: string;          // მომხმარებლის სახელი
  email?: string;             // ელ ფოსტა
}

export type OrderStatus = 'registered' | 'driver_assigned' | 'picked_up' | 'completed' | 'cancelled' | 'uncompleted'; // რეგისტრირებული, მძღოლი მიმაგრებული, აყვანილი, დასრულებული, გაუქმებული

export interface Order {
  id: string;
  order_date: string;         // შეკვეთის თარიღი
  doc_number: string;         // დოკუმენტის ნომერი
  vendor_id: string;          // მომწოდებელი (Vendor)
  vendor_name?: string;       // დამხმარე ველი
  warehouse_id: string;       // საწყობი
  warehouse_name?: string;    // დამხმარე ველი
  qty_requested: number;      // რაოდენობა
  pickup_date_time?: string;  // წამოღების თარიღი და დრო
  operator_id: string;        // შეკვეთის თანამშრომელი (ვინც შექმნა)
  created_by?: string;
  operator_name?: string;
  driver_id?: string;         // მძღოლი თანამშრომელი
  driver_name?: string;
  companion_id?: string;      // (ფუნქციური დამხმარე - driver role can have optional companions mapped in trucks, but roles are streamlined)
  companion_name?: string;
  truck_plate?: string;       // მანქანა
  vehicle_id?: string;        // Assigned vehicle ID
  direction_id?: string;      // მიმართულება
  status: OrderStatus;        // სტატუსი
  fact_qty?: number;          // ფაქტიური რაოდენობა
  fact_tank_dropoff?: number; // ფაქტიური ავზების დატოვება
  fact_tank_pickup?: number;  // ფაქტიური ავზების წამოღება
  waybill_qty?: number;       // ზედნადებით რაოდენობა
  note?: string;              // ძველი შენიშვნა
  notes?: VendorComment[];    // შენიშვნების სია (jsonb)
  tanks_to_leave: number;     // დასატოვებელი ავზები რაოდ
  tanks_to_bring: number;     // წამოსაღები ავზების რაოდ
  sms_sent?: boolean;         // გაიგზავნა თუ არა სმს ბუღალტერთან დასრულებისას
  is_deleted?: boolean;
  contact_id?: string;
  contact_name?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  district?: string;
}

export interface Communication {
  id: string;
  date_time: string;          // თარიღი და დრო
  type: 'action' | 'reminder' | 'task'; // სახეობა (მოქმედება, შეხსენება, დავალება)
  reminder_time?: string;     // შეხსენების დრო
  has_time?: boolean;         // დრო მითითებულია თუ მხოლოდ თარიღი
  user_id?: string;           // Optional legacy identifier
  user_name?: string;
  vendor_id: string;          // მომწოდებელი (Vendor)
  vendor_name?: string;
  vendor_contact_id: string;  // მომწოდებლის კონტაქტი
  vendor_contact_name?: string;
  comment: string;            // კომენტარი
  responsible_user_id?: string; // პასუხისმგებელი პირი
  responsible_user_name?: string;
  is_completed?: boolean;     // დავალების სტატუსი (false: აქტიური, true: შესრულებული)
  task_status?: string;       // Legacy string representation
  created_by?: string;
  is_deleted?: boolean;
}

export interface Truck {
  id?: string;                // Primary key ID
  plate_number: string;       // სახელმწიფო ნომერი
  model: string;              // მოდელი
  driver_id?: string;         // მძღოლი თანამშრომელი
  driver_name?: string;
  companion_id?: string;      // (optional profile companion reference)
  companion_name?: string;
  created_by?: string;
  is_deleted?: boolean;
  city?: string;              // ქალაქი
  warehouse_id?: string;      // საწყობი
  direction_id?: string;      // მიმართულება
  auth_user_id?: string;      // Vehicle Auth User ID
  password?: string;          // Password for vehicle account
}

export type Vehicle = Truck;

export interface Direction {
  id: string;
  name: string;
  created_by?: string;
  is_deleted?: boolean;
}

export interface ChangeHistory {
  id: string;
  date_time: string;          // თარიღი და დრო
  employee_name: string;      // თანამშრომელი name (keep structural field name as is or adapt logger)
  operation: string;          // ოპერაცია (მაგ: დამატება, განახლება, წაშლა)
  field_name?: string;        // ველი
  old_value?: string;         // ძველი მნიშვნელობა
  new_value?: string;         // ახალი მნიშვნელობა
  is_reverted?: boolean;      // ✅ Reverted status state
}

export interface Warehouse {
  id: string;
  name: string;               // დასახელება
  created_by?: string;
  is_deleted?: boolean;
}

export interface City {
  id: string;
  name: string;               // დასახელება
  created_by?: string;
  is_deleted?: boolean;
}

export interface District {
  id: string;
  city_id: string;            // ქალაქის რეფერენსი
  name: string;               // უბნის დასახელება
  created_by?: string;
  is_deleted?: boolean;
}
