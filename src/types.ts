/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EmployeeRole = 'admin' | 'manager' | 'driver' | 'companion';

export interface Employee {
  id: string;
  name: string;
  personal_id: string; // პირადი ნომერი
  email: string;
  password?: string;
  phone: string;
  role: EmployeeRole;
  privileges: string[]; // ოპერაციების პრივილეგიები
  created_at?: string;
}

export interface SupplierContact {
  id: string;
  name: string;
  phone: string;
  position: 'accountant' | 'director' | 'operator' | 'other'; // ბუღალტერი, დირექტორი, ოპერატორი, სხვა
  note?: string;
  is_default: boolean;
}

export interface SupplierComment {
  id: string;
  comment: string;
  date: string;
  employee_name: string;
}

export interface Supplier {
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
  contacts: SupplierContact[]; // კონტაქტები
  comments: SupplierComment[]; // კომენტარები
  working_hours: string;      // სამუშაო საათები
  created_at: string;
  last_pickup_date?: string;
  average_interval_days?: number;
}

export type OrderStatus = 'registered' | 'scheduled' | 'completed' | 'cancelled'; // რეგისტრირებული, დაგეგმილი, დასრულებული, გაუქმებული

export interface Order {
  id: string;
  order_date: string;         // შეკვეთის თარიღი
  doc_number: string;         // დოკუმენტის ნომერი
  supplier_id: string;        // მომწოდებელი
  supplier_name?: string;     // დამხმარე ველი
  warehouse_id: string;       // საწყობი
  warehouse_name?: string;    // დამხმარე ველი
  note?: string;              // შენიშვნა
  qty_requested: number;      // რაოდენობა
  qty_actual?: number;        // ფაქტობრივი რაოდენობა
  tanks_to_leave: number;     // დასატოვებელი ავზები რაოდ
  tanks_to_bring: number;     // წამოსაღები ავზების რაოდ
  tanks_left_actual?: number; // ფაქტ. დასატოვებელი ავზები რაოდ
  tanks_bring_actual?: number;// ფაქტ. წამოსაღები ავზების რაოდ
  pickup_date_time?: string;  // წამოღების თარიღი და დრო
  operator_id: string;        // შეკვეთის თანამშრომელი (ვინც შექმნა)
  operator_name?: string;
  driver_id?: string;         // მძღოლი თანამშრომელი
  driver_name?: string;
  companion_id?: string;      // თანხლები თანამშრომელი
  companion_name?: string;
  truck_plate?: string;       // მანქანა
  status: OrderStatus;        // სტატუსი
  sms_sent?: boolean;         // გაიგზავნა თუ არა სმს ბუღალტერთან დასრულებისას
}

export interface Communication {
  id: string;
  date_time: string;          // თარიღი და დრო
  type: 'action' | 'reminder'; // სახეობა (მოქმედება, შეხსენება)
  reminder_time?: string;     // შეხსენების დრო
  employee_id: string;        // თანამშრომელი
  employee_name?: string;
  supplier_id: string;        // მომწოდებელი
  supplier_name?: string;
  supplier_contact_id: string;// მომწოდებლის კონტაქტი
  supplier_contact_name?: string;
  comment: string;            // კომენტარი
}

export interface Truck {
  plate_number: string;       // სახელმწიფო ნომერი
  model: string;              // მოდელი
  driver_id?: string;         // მძღოლი თანამშრომელი
  driver_name?: string;
  companion_id?: string;      // თანხლები თანამშრომელი
  companion_name?: string;
}

export interface ChangeHistory {
  id: string;
  date_time: string;          // თარიღი და დრო
  employee_name: string;      // თანამშრომელი
  operation: string;          // ოპერაცია (მაგ: დამატება, განახლება, წაშლა)
  field_name?: string;        // ველი
  old_value?: string;         // ძველი მნიშვნელობა
  new_value?: string;         // ახალი მნიშვნელობა
}

export interface Warehouse {
  id: string;
  name: string;               // დასახელება
}

export interface City {
  id: string;
  name: string;               // დასახელება
}

export interface District {
  id: string;
  city_id: string;            // ქალაქის რეფერენსი
  name: string;               // უბნის დასახელება
}
