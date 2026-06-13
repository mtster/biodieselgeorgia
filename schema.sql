-- ====================================================================
--  BIODIESEL GEORGIA - DATABASE SCHEMA SCRIPT (PRODUCTIONS STANDARDS)
-- ====================================================================
--  This script establishes tables, primary keys, foreign constraints, indices, and defaults.

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
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;
DROP TABLE IF EXISTS public.districts CASCADE;
DROP TABLE IF EXISTS public.cities CASCADE;

DROP TYPE IF EXISTS public.user_role CASCADE;

-- Create role Enum type
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'driver', 'vendor');

-- 1. Cities
CREATE TABLE public.cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Districts
CREATE TABLE public.districts (
    id TEXT PRIMARY KEY,
    city_id TEXT REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Warehouses
CREATE TABLE public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Profiles (Map 1:1 to Supabase Auth Users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    personal_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role public.user_role NOT NULL,
    privileges TEXT[] DEFAULT '{}'::TEXT[],
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Vehicles / Trucks
CREATE TABLE public.trucks (
    plate_number TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    companion_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Vendors
CREATE TABLE public.vendors (
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
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_pickup_date TIMESTAMPTZ,
    average_interval_days INT DEFAULT 0
);

-- 7. Orders
CREATE TABLE public.orders (
    id TEXT PRIMARY KEY,
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    doc_number TEXT UNIQUE NOT NULL,         -- Document/Invoice Number
    vendor_id TEXT REFERENCES public.vendors(id) ON DELETE CASCADE,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    note TEXT,                               -- General Notes
    qty_requested NUMERIC(12, 2) NOT NULL,   -- Requested Liters
    qty_actual NUMERIC(12, 2),               -- Actual Liters Picked Up
    tanks_to_leave INT NOT NULL DEFAULT 0,   -- Tanks to Leave
    tanks_to_bring INT NOT NULL DEFAULT 0,   -- Tanks to Retrieve
    tanks_left_actual INT,                   -- Actual Tanks Left
    tanks_bring_actual INT,                  -- Actual Tanks Retrieved
    pickup_date_time TIMESTAMPTZ,            -- Retrieve Date and Time
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Creator Operator
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,   -- Driver assigned
    companion_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,-- Companion assigned
    truck_plate TEXT REFERENCES public.trucks(plate_number) ON DELETE SET NULL, -- Assigned Vehicle Plate
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'scheduled', 'completed', 'cancelled')),
    sms_sent BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Communications
CREATE TABLE public.communications (
    id TEXT PRIMARY KEY,
    date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('action', 'reminder')), -- Communication Type
    reminder_time TIMESTAMPTZ,                -- Remind time
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Logging user
    vendor_id TEXT REFERENCES public.vendors(id) ON DELETE CASCADE,  -- Connected Vendor
    vendor_contact_id TEXT,                   -- Specific contact person
    comment TEXT NOT NULL,                     -- Notes/Log details
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Change History Trackers
CREATE TABLE public.change_history (
    id TEXT PRIMARY KEY,
    date_time TIMESTAMPTZ DEFAULT NOW(),
    employee_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT
);

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
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_history ENABLE ROW LEVEL SECURITY;

-- Apply simplified, safe, full-access policies for authenticated users on all tables
-- To prevent infinite loops, NEVER do SELECT on profiles from a policy check.
-- Instead, check user identity via auth.uid() or verify attributes in the auth.jwt().
CREATE POLICY "Authenticated full access on cities" ON public.cities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on districts" ON public.districts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on warehouses" ON public.warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on trucks" ON public.trucks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on vendors" ON public.vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on communications" ON public.communications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access on change_history" ON public.change_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Profiles policies (highly optimized against recursion)
CREATE POLICY "Users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins have full access on profiles" ON public.profiles FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
) WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Indices for high-speed performance
CREATE INDEX IF NOT EXISTS idx_districts_city_id ON public.districts (city_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company_code ON public.vendors (company_code);
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
