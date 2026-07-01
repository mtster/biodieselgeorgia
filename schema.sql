-- ====================================================================
--  BIODIESEL GEORGIA - DATABASE SCHEMA SCRIPT (PRODUCTIONS STANDARDS)
-- ====================================================================
--  This script establishes tables, primary keys, foreign constraints, indices, and defaults.
--  Configured to be non-destructive and re-runnable again and again safely.

-- Enable robust extension support if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Recreate trigger function securely (does not delete table data)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create role Enum type (checking first to be re-runnable)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'driver', 'vendor', 'assistant', 'warehouse_manager');
  END IF;
END$$;

-- Add values if not exists to handle cases where the type already pre-existed without these values
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'assistant';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'warehouse_manager';

-- 1. Cities
CREATE TABLE IF NOT EXISTS public.cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Districts
CREATE TABLE IF NOT EXISTS public.districts (
    id TEXT PRIMARY KEY,
    city_id TEXT REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2b. Directions
CREATE TABLE IF NOT EXISTS public.directions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Profiles (Map 1:1 to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    personal_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role public.user_role NOT NULL,
    privileges TEXT[] DEFAULT '{}'::TEXT[],
    edit_permissions JSONB DEFAULT '{}'::JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply non-destructive updates to public.profiles table if it pre-exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vendor_id TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- 5. Vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
    plate_number TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    companion_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    city TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply non-destructive updates to public.vehicles table if it pre-exists
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS direction_id TEXT DEFAULT NULL;

-- 6. Vendors
CREATE TABLE IF NOT EXISTS public.vendors (
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
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL, -- Warehouse Reference
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,   -- Account Manager
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- Operator
    contacts JSONB DEFAULT '[]'::JSONB,     -- Contacts List
    comments JSONB DEFAULT '[]'::JSONB,     -- Comments History
    working_hours TEXT,                     -- Working Hours
    barrels_amount INT DEFAULT 0,          -- Barrels amount
    status TEXT DEFAULT 'Active',          -- Status
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_pickup_date TIMESTAMPTZ,
    average_interval_days INT DEFAULT 0
);

-- Apply non-destructive updates to public.vendors table if it pre-exists (prevents schema cache issues)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS barrels_amount INT DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS last_pickup_date TIMESTAMPTZ;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS average_interval_days INT DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS direction_id TEXT DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS vada INT DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_planned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS planned_weekday TEXT DEFAULT NULL;

-- 7. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    doc_number TEXT UNIQUE NOT NULL,         -- Document/Invoice Number
    vendor_id TEXT REFERENCES public.vendors(id) ON DELETE CASCADE,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    note TEXT,                               -- General Notes
    qty_requested NUMERIC(12, 2) NOT NULL,   -- Requested Liters
    tanks_to_leave INT NOT NULL DEFAULT 0,   -- Tanks to Leave
    tanks_to_bring INT NOT NULL DEFAULT 0,   -- Tanks to Retrieve
    pickup_date_time TIMESTAMPTZ,            -- Retrieve Date and Time
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Creator Operator
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,   -- Driver assigned
    companion_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,-- Companion assigned
    truck_plate TEXT REFERENCES public.vehicles(plate_number) ON DELETE SET NULL, -- Assigned Vehicle Plate
    fact_qty NUMERIC(12, 2) DEFAULT 0.00,  -- Fact QTY
    fact_tank_dropoff INT DEFAULT 0,       -- Fact Tank Dropoff
    fact_tank_pickup INT DEFAULT 0,        -- Fact Tank Pickup
    status TEXT NOT NULL DEFAULT 'registered',
    sms_sent BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply non-destructive updates to public.orders table if it pre-exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fact_qty NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fact_tank_dropoff INT DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fact_tank_pickup INT DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS waybill_qty NUMERIC(12, 2) DEFAULT 0.00;

-- Safe update of the status CHECK constraint if it exists
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('registered', 'driver_assigned', 'picked_up', 'completed', 'cancelled'));

-- 8. Communications
CREATE TABLE IF NOT EXISTS public.communications (
    id TEXT PRIMARY KEY,
    date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('action', 'reminder', 'task')), -- Communication Type
    reminder_time TIMESTAMPTZ,                -- Remind time
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Logging user
    vendor_id TEXT REFERENCES public.vendors(id) ON DELETE CASCADE,  -- Connected Vendor
    vendor_contact_id TEXT,                   -- Specific contact person
    comment TEXT NOT NULL,                     -- Notes/Log details
    responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Responsible User
    task_status TEXT,                          -- Task Status (pending, etc.)
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe update of communication type check constraint
ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_type_check;
ALTER TABLE public.communications ADD CONSTRAINT communications_type_check CHECK (type IN ('action', 'reminder', 'task'));

-- Apply non-destructive updates to public.communications
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS task_status TEXT;

-- 9. Change History Trackers
CREATE TABLE IF NOT EXISTS public.change_history (
    id TEXT PRIMARY KEY,
    date_time TIMESTAMPTZ DEFAULT NOW(),
    employee_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT
);

-- Functional system utility to add custom columns dynamically on the vendors table
CREATE OR REPLACE FUNCTION public.add_custom_column_to_vendors(column_name TEXT, column_type TEXT DEFAULT 'TEXT')
RETURNS VOID SECURITY DEFINER AS $$
BEGIN
  -- Double check/sanitize input to avoid SQL injection
  IF column_name !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid column name: %', column_name;
  END IF;
  
  -- Create the column if it does not exist
  EXECUTE format('ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS %I %s DEFAULT NULL', column_name, column_type);
END;
$$ LANGUAGE plpgsql;

-- Functional system utility to add custom columns dynamically on the orders table
CREATE OR REPLACE FUNCTION public.add_custom_column_to_orders(column_name TEXT, column_type TEXT DEFAULT 'TEXT')
RETURNS VOID SECURITY DEFINER AS $$
BEGIN
  -- Double check/sanitize input to avoid SQL injection
  IF column_name !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' THEN
    RAISE EXCEPTION 'Invalid column name: %', column_name;
  END IF;
  
  -- Create the column if it does not exist
  EXECUTE format('ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS %I %s DEFAULT NULL', column_name, column_type);
END;
$$ LANGUAGE plpgsql;

-- Create and configure trigger function to auto insert profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, personal_id, email, phone, role, privileges)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'personal_id', '12345678901'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', '599112233'),
    COALESCE(new.raw_user_meta_data->>'role', 'admin')::public.user_role,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'privileges')), '{}'::TEXT[])
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    personal_id = EXCLUDED.personal_id,
    role = EXCLUDED.role,
    privileges = EXCLUDED.privileges;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Bind Trigger to auth.users inserts
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_history ENABLE ROW LEVEL SECURITY;

-- Apply simplified, safe, full-access policies for authenticated users on all tables
-- To prevent infinite loops, NEVER do SELECT on profiles from a policy check.
-- Instead, check user identity via auth.uid() or verify attributes in the auth.jwt().
DROP POLICY IF EXISTS "Authenticated full access on cities" ON public.cities;
DROP POLICY IF EXISTS "Authenticated full access on districts" ON public.districts;
DROP POLICY IF EXISTS "Authenticated full access on directions" ON public.directions;
DROP POLICY IF EXISTS "Authenticated full access on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Authenticated full access on vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated full access on vendors" ON public.vendors;
DROP POLICY IF EXISTS "Authenticated full access on orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated full access on communications" ON public.communications;
DROP POLICY IF EXISTS "Authenticated full access on change_history" ON public.change_history;

CREATE POLICY "Authenticated full access on cities" ON public.cities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on districts" ON public.districts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on directions" ON public.directions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on warehouses" ON public.warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on vehicles" ON public.vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on vendors" ON public.vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on communications" ON public.communications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on change_history" ON public.change_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SECURITY DEFINER function to bypass RLS recursion on the profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::public.user_role
  );
END;
$$ LANGUAGE plpgsql;

-- Profiles policies (highly optimized against recursion)
DROP POLICY IF EXISTS "Users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins have full access on profiles" ON public.profiles;

CREATE POLICY "Users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins have full access on profiles" ON public.profiles FOR ALL TO authenticated USING (
  public.is_admin()
) WITH CHECK (
  public.is_admin()
);

-- Indices for high-speed performance
CREATE INDEX IF NOT EXISTS idx_districts_city_id ON public.districts (city_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company_code ON public.vendors (company_code);
CREATE INDEX IF NOT EXISTS idx_vendors_planning ON public.vendors (is_planned, planned_weekday) WHERE is_planned = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_orders_doc_number ON public.orders (doc_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_communications_vendor ON public.communications (vendor_id);
CREATE INDEX IF NOT EXISTS idx_change_history_date ON public.change_history (date_time DESC);

-- Seeding lookups and base data
INSERT INTO public.cities (id, name) VALUES 
('city-tbilisi', 'Tbilisi'),
('city-kutaisi', 'Kutaisi'),
('city-batumi', 'Batumi') ON CONFLICT (id) DO NOTHING;

INSERT INTO public.districts (id, city_id, name) VALUES
('dist-sab-tb', 'city-tbilisi', 'Saburtalo'),
('dist-vake-tb', 'city-tbilisi', 'Vake'),
('dist-gld-tb', 'city-tbilisi', 'Gldani'),
('dist-ctr-kut', 'city-kutaisi', 'Center'),
('dist-prt-bat', 'city-batumi', 'Port') ON CONFLICT (id) DO NOTHING;

INSERT INTO public.warehouses (id, name) VALUES
('wh-main', 'Central Warehouse'),
('wh-west', 'West Warehouse') ON CONFLICT (id) DO NOTHING;
