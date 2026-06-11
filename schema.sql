-- ====================================================================
--  BIODIESEL GEORGIA - DATABASE SCHEMA SCRIPT
-- ====================================================================
--  This script is designed to be executable repeatedly without errors.
--  It establishes tables, primary keys, foreign constraints, indices, and defaults.
--
--  HOW TO INTEGRATE WITH SUPABASE:
--  1. Copy the contents of this whole file.
--  2. Go to your Supabase Dashboard (https://supabase.com).
--  3. Click on "SQL Editor" in the left-hand navigation bar.
--  4. Paste this script into the editing box and click "Run".
--
-- ====================================================================

-- Enable robust extension support if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean drop of pre-existing tables to prevent version mismatch errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

DROP TABLE IF EXISTS public.change_history CASCADE;
DROP TABLE IF EXISTS public.communications CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.trucks CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.districts CASCADE;
DROP TABLE IF EXISTS public.cities CASCADE;

-- 1. Cities
CREATE TABLE cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Districts
CREATE TABLE districts (
    id TEXT PRIMARY KEY,
    city_id TEXT REFERENCES cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Warehouses
CREATE TABLE warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Users / Employees
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    personal_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'driver', 'vendor')),
    privileges TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Vehicles / Trucks
CREATE TABLE trucks (
    plate_number TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    driver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    companion_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Vendors
CREATE TABLE vendors (
    id TEXT PRIMARY KEY,
    id_code TEXT NOT NULL,                  -- Company Identification Code
    company_name TEXT NOT NULL,             -- Legal Company Name
    trade_name TEXT NOT NULL,               -- Vendor Trade Name
    company_code TEXT UNIQUE NOT NULL,      -- Internal Code
    bank_account TEXT NOT NULL,             -- Bank Account (IBAN)
    city TEXT NOT NULL,                     -- City
    district TEXT NOT NULL,                 -- District
    address TEXT NOT NULL,                  -- Address
    price_per_liter NUMERIC(10, 2) DEFAULT 0.00,  -- Price per Liter
    warehouse_id TEXT REFERENCES warehouses(id) ON DELETE SET NULL, -- Warehouse Reference
    manager_id TEXT REFERENCES users(id) ON DELETE SET NULL,   -- Account Manager
    operator_id TEXT REFERENCES users(id) ON DELETE SET NULL,  -- Operator
    contacts JSONB DEFAULT '[]'::JSONB,     -- Contacts List
    comments JSONB DEFAULT '[]'::JSONB,     -- Comments History
    working_hours TEXT,                     -- Working Hours
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_pickup_date TIMESTAMPTZ,
    average_interval_days INT DEFAULT 0
);

-- 7. Orders
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    doc_number TEXT UNIQUE NOT NULL,         -- Document/Invoice Number
    vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,
    warehouse_id TEXT REFERENCES warehouses(id) ON DELETE SET NULL,
    note TEXT,                               -- General Notes
    qty_requested NUMERIC(12, 2) NOT NULL,   -- Requested Liters
    qty_actual NUMERIC(12, 2),               -- Actual Liters Picked Up
    tanks_to_leave INT NOT NULL DEFAULT 0,   -- Tanks to Leave
    tanks_to_bring INT NOT NULL DEFAULT 0,   -- Tanks to Retrieve
    tanks_left_actual INT,                   -- Actual Tanks Left
    tanks_bring_actual INT,                  -- Actual Tanks Retrieved
    pickup_date_time TIMESTAMPTZ,            -- Retrieve Date and Time
    operator_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- Creator Operator
    driver_id TEXT REFERENCES users(id) ON DELETE SET NULL,   -- Driver assigned
    companion_id TEXT REFERENCES users(id) ON DELETE SET NULL,-- Companion assigned
    truck_plate TEXT REFERENCES trucks(plate_number) ON DELETE SET NULL, -- Assigned Vehicle Plate
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'scheduled', 'completed', 'cancelled')),
    sms_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Communications
CREATE TABLE communications (
    id TEXT PRIMARY KEY,
    date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('action', 'reminder')), -- Communication Type
    reminder_time TIMESTAMPTZ,                -- Remind time
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- Logging user
    vendor_id TEXT REFERENCES vendors(id) ON DELETE CASCADE,  -- Connected Vendor
    vendor_contact_id TEXT,                   -- Specific contact person
    comment TEXT NOT NULL,                     -- Notes/Log details
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Change History Trackers
CREATE TABLE change_history (
    id TEXT PRIMARY KEY,
    date_time TIMESTAMPTZ DEFAULT NOW(),
    employee_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT
);

-- ====================================================================
--  INDICES FOR HIGH-SPEED INTERACTION AND PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_districts_city_id ON districts (city_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company_code ON vendors (company_code);
CREATE INDEX IF NOT EXISTS idx_orders_doc_number ON orders (doc_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_communications_vendor ON communications (vendor_id);
CREATE INDEX IF NOT EXISTS idx_change_history_date ON change_history (date_time DESC);

-- ====================================================================
--  INSERT INITIAL DEFAULT CORE VALUES (SAFE ON RE-RUN)
-- ====================================================================
INSERT INTO cities (id, name) VALUES 
('city-tbilisi', 'Tbilisi'),
('city-kutaisi', 'Kutaisi'),
('city-batumi', 'Batumi') ON CONFLICT (id) DO NOTHING;

INSERT INTO districts (id, city_id, name) VALUES
('dist-sab-tb', 'city-tbilisi', 'Saburtalo'),
('dist-vake-tb', 'city-tbilisi', 'Vake'),
('dist-gld-tb', 'city-tbilisi', 'Gldani'),
('dist-ctr-kut', 'city-kutaisi', 'Center'),
('dist-prt-bat', 'city-batumi', 'Port') ON CONFLICT (id) DO NOTHING;

INSERT INTO warehouses (id, name) VALUES
('wh-main', 'Central Warehouse'),
('wh-west', 'West Warehouse') ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, personal_id, email, password, phone, role, privileges)
VALUES (
    'e2e83fb8-cf5c-41c6-993d-d35276c1f7b0', 
    'Administrator', 
    '12345678901', 
    'admin@biodiesel.ge', 
    'admin123', 
    '599112233', 
    'admin', 
    '{"All", "Manage", "Order", "Reports"}'
) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- ====================================================================
--  SUPABASE AUTOMATIC AUTH SIGN-UP USER POPULATION (users)
-- ====================================================================

-- Automating user creation upon Supabase Authed User creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert directly into public.users to sync types
  INSERT INTO public.users (id, name, personal_id, email, phone, role, privileges, password)
  VALUES (
    new.id::text,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'personal_id', '12345678901'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', '599112233'),
    COALESCE(new.raw_user_meta_data->>'role', 'admin'),
    '{"All", "Manage", "Order", "Reports"}',
    'admin123'
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    password = 'admin123';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to auth.users inserts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
--  ROW LEVEL SECURITY (RLS) FOR SYSTEM SECURITY
-- ====================================================================

-- Enable RLS on all 9 application tables
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_history ENABLE ROW LEVEL SECURITY;

-- Apply simplified, safe, full-access policies for authenticated users on all tables
DROP POLICY IF EXISTS "Authenticated full access on cities" ON public.cities;
CREATE POLICY "Authenticated full access on cities" ON public.cities FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on districts" ON public.districts;
CREATE POLICY "Authenticated full access on districts" ON public.districts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on warehouses" ON public.warehouses;
CREATE POLICY "Authenticated full access on warehouses" ON public.warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on users" ON public.users;
CREATE POLICY "Authenticated full access on users" ON public.users FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on trucks" ON public.trucks;
CREATE POLICY "Authenticated full access on trucks" ON public.trucks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on vendors" ON public.vendors;
CREATE POLICY "Authenticated full access on vendors" ON public.vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on orders" ON public.orders;
CREATE POLICY "Authenticated full access on orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on communications" ON public.communications;
CREATE POLICY "Authenticated full access on communications" ON public.communications FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access on change_history" ON public.change_history;
CREATE POLICY "Authenticated full access on change_history" ON public.change_history FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ====================================================================
--  INJECT AUTH USER (SAFE FOR RE-RUN - CLEANS AND RE-CREATES FIRST)
-- ====================================================================
DELETE FROM auth.users WHERE email = 'admin@biodiesel.ge';

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_super_admin
)
VALUES (
  'e2e83fb8-cf5c-41c6-993d-d35276c1f7b0',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@biodiesel.ge',
  crypt('admin123', gen_salt('bf', 10)),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Administrator","role":"admin"}',
  now(),
  now(),
  false
)
ON CONFLICT (id) DO NOTHING;
