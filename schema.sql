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

-- Drop all existing policies before table definition/alteration so they don't block column type changes
DROP POLICY IF EXISTS "Cities view" ON public.cities;
DROP POLICY IF EXISTS "Cities add" ON public.cities;
DROP POLICY IF EXISTS "Cities modify" ON public.cities;
DROP POLICY IF EXISTS "Cities delete" ON public.cities;

DROP POLICY IF EXISTS "Districts view" ON public.districts;
DROP POLICY IF EXISTS "Districts add" ON public.districts;
DROP POLICY IF EXISTS "Districts modify" ON public.districts;
DROP POLICY IF EXISTS "Districts delete" ON public.districts;

DROP POLICY IF EXISTS "Directions view" ON public.directions;
DROP POLICY IF EXISTS "Directions add" ON public.directions;
DROP POLICY IF EXISTS "Directions modify" ON public.directions;
DROP POLICY IF EXISTS "Directions delete" ON public.directions;

DROP POLICY IF EXISTS "Warehouses view" ON public.warehouses;
DROP POLICY IF EXISTS "Warehouses add" ON public.warehouses;
DROP POLICY IF EXISTS "Warehouses modify" ON public.warehouses;
DROP POLICY IF EXISTS "Warehouses delete" ON public.warehouses;

DROP POLICY IF EXISTS "Vehicles view" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles add" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles modify" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles delete" ON public.vehicles;

DROP POLICY IF EXISTS "Vendors view" ON public.vendors;
DROP POLICY IF EXISTS "Vendors add" ON public.vendors;
DROP POLICY IF EXISTS "Vendors modify" ON public.vendors;
DROP POLICY IF EXISTS "Vendors delete" ON public.vendors;

DROP POLICY IF EXISTS "Vendor Contacts view" ON public.vendor_contacts;
DROP POLICY IF EXISTS "Vendor Contacts add" ON public.vendor_contacts;
DROP POLICY IF EXISTS "Vendor Contacts modify" ON public.vendor_contacts;
DROP POLICY IF EXISTS "Vendor Contacts delete" ON public.vendor_contacts;

DROP POLICY IF EXISTS "Communications view" ON public.communications;
DROP POLICY IF EXISTS "Communications add" ON public.communications;
DROP POLICY IF EXISTS "Communications modify" ON public.communications;
DROP POLICY IF EXISTS "Communications delete" ON public.communications;

DROP POLICY IF EXISTS "Orders view access" ON public.orders;
DROP POLICY IF EXISTS "Orders add access" ON public.orders;
DROP POLICY IF EXISTS "Orders modify access" ON public.orders;
DROP POLICY IF EXISTS "Orders delete access" ON public.orders;

DROP POLICY IF EXISTS "History view" ON public.change_history;
DROP POLICY IF EXISTS "History modify (System only usually)" ON public.change_history;

DROP POLICY IF EXISTS "Authenticated full access on cities" ON public.cities;
DROP POLICY IF EXISTS "Authenticated full access on districts" ON public.districts;
DROP POLICY IF EXISTS "Authenticated full access on directions" ON public.directions;
DROP POLICY IF EXISTS "Authenticated full access on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Authenticated full access on vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated full access on vendors" ON public.vendors;
DROP POLICY IF EXISTS "Authenticated full access on vendor_contacts" ON public.vendor_contacts;
DROP POLICY IF EXISTS "Authenticated full access on communications" ON public.communications;
DROP POLICY IF EXISTS "Authenticated full access on change_history" ON public.change_history;

-- Create role Enum type (checking first to be re-runnable)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'driver', 'vendor', 'assistant', 'warehouse_manager', 'purchasing_manager', 'operator', 'logistics_manager');
  END IF;
END$$;

-- Add values if not exists to handle cases where the type already pre-existed without these values
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'assistant';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'purchasing_manager';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'operator';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'logistics_manager';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'warehouse_manager';

-- 1. Cities
CREATE TABLE IF NOT EXISTS public.cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT DEFAULT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. Districts
CREATE TABLE IF NOT EXISTS public.districts (
    id TEXT PRIMARY KEY,
    city_id TEXT REFERENCES public.cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_by TEXT DEFAULT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.districts ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;
ALTER TABLE public.districts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2b. Directions
CREATE TABLE IF NOT EXISTS public.directions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.directions ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;
ALTER TABLE public.directions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 3. Warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT DEFAULT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 4. Profiles (Map 1:1 to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    personal_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions JSONB DEFAULT '{}'::JSONB,
    
    is_deleted BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply non-destructive updates to public.profiles table if it pre-exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vendor_id TEXT DEFAULT NULL;
ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Standardize and map legacy roles to clean, standard roles
UPDATE public.profiles SET role = 'purchasing_head' WHERE role = 'manager';
UPDATE public.profiles SET role = 'operator' WHERE role NOT IN ('admin', 'purchasing_head', 'purchasing_manager', 'operator', 'logistics_manager', 'driver');

-- Enforce check constraint to only allow standardized role names
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_role;
ALTER TABLE public.profiles ADD CONSTRAINT check_valid_role CHECK (role IN ('admin', 'purchasing_head', 'purchasing_manager', 'operator', 'logistics_manager', 'driver'));

-- 5. Vehicles
CREATE TABLE IF NOT EXISTS public.vehicles (
    plate_number TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    companion_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    city TEXT,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply non-destructive updates to public.vehicles table if it pre-exists
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS warehouse_id TEXT DEFAULT NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS direction_id TEXT DEFAULT NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

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
    comments JSONB DEFAULT '[]'::JSONB,     -- Comments History
    working_hours TEXT,                     -- Working Hours
    barrels_amount INT DEFAULT 0,          -- Barrels amount
    is_active BOOLEAN DEFAULT TRUE,        -- Active status
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username TEXT,
    email TEXT
);

-- Apply non-destructive updates to public.vendors table if it pre-exists (prevents schema cache issues)
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS barrels_amount INT DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS direction_id TEXT DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS overdue_threshold_days INT DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_planned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS planned_weekday TEXT DEFAULT NULL;
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_user_id_fkey;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;

-- 6b. Vendor Contacts
CREATE TABLE IF NOT EXISTS public.vendor_contacts (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    position TEXT NOT NULL,
    note TEXT,
    email TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply non-destructive updates to public.vendor_contacts table if it pre-exists
ALTER TABLE public.vendor_contacts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.vendor_contacts ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;
ALTER TABLE public.vendor_contacts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;

-- 7. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    doc_number TEXT UNIQUE NOT NULL,         -- Document/Invoice Number
    vendor_id TEXT REFERENCES public.vendors(id) ON DELETE CASCADE,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    qty_requested NUMERIC(12, 2),            -- Requested Liters
    tanks_to_leave INT NOT NULL DEFAULT 0,   -- Tanks to Leave
    tanks_to_bring INT NOT NULL DEFAULT 0,   -- Tanks to Retrieve
    pickup_date_time TIMESTAMPTZ,            -- Retrieve Date and Time
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Creator Operator
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fact_tank_pickup INT DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS waybill_qty NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS contact_id TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.orders ALTER COLUMN qty_requested DROP NOT NULL;

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
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;

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
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'admin');
  
  IF v_role = 'vendor' OR v_role = 'vehicle' OR new.raw_user_meta_data->>'vehicle_role' = 'vehicle' THEN
    RETURN NEW;
  END IF;

  -- Map any legacy/non-standard roles to the standard ones
  IF v_role = 'manager' THEN
    v_role := 'purchasing_head';
  ELSIF v_role NOT IN ('admin', 'purchasing_head', 'purchasing_manager', 'operator', 'logistics_manager', 'driver') THEN
    v_role := 'operator'; -- Default fallback
  END IF;

  INSERT INTO public.profiles (
    id, 
    name, 
    personal_id, 
    email, 
    phone, 
    role, 
    permissions,
    vendor_id
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'personal_id', '12345678901'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', '599112233'),
    v_role,
    COALESCE(new.raw_user_meta_data->'permissions', '{}'::JSONB),
    new.raw_user_meta_data->>'vendor_id'
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    personal_id = EXCLUDED.personal_id,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    vendor_id = EXCLUDED.vendor_id;
  
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

-- Helper function to check granular JSONB permissions
CREATE OR REPLACE FUNCTION public.has_permission(module TEXT, perm TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
DECLARE
  u_role TEXT;
  u_permissions jsonb;
BEGIN
  SELECT role, permissions INTO u_role, u_permissions FROM public.profiles WHERE id = auth.uid();
  IF u_role::text = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Handle permissions checking using JSONB containment or extraction
  -- We'll just check if the array contains the perm string
  RETURN (u_permissions -> module) ? perm;
END;
$$ LANGUAGE plpgsql;


DROP POLICY IF EXISTS "Cities view" ON public.cities;
DROP POLICY IF EXISTS "Cities add" ON public.cities;
DROP POLICY IF EXISTS "Cities modify" ON public.cities;
DROP POLICY IF EXISTS "Cities delete" ON public.cities;

DROP POLICY IF EXISTS "Districts view" ON public.districts;
DROP POLICY IF EXISTS "Districts add" ON public.districts;
DROP POLICY IF EXISTS "Districts modify" ON public.districts;
DROP POLICY IF EXISTS "Districts delete" ON public.districts;

DROP POLICY IF EXISTS "Directions view" ON public.directions;
DROP POLICY IF EXISTS "Directions add" ON public.directions;
DROP POLICY IF EXISTS "Directions modify" ON public.directions;
DROP POLICY IF EXISTS "Directions delete" ON public.directions;

DROP POLICY IF EXISTS "Warehouses view" ON public.warehouses;
DROP POLICY IF EXISTS "Warehouses add" ON public.warehouses;
DROP POLICY IF EXISTS "Warehouses modify" ON public.warehouses;
DROP POLICY IF EXISTS "Warehouses delete" ON public.warehouses;

DROP POLICY IF EXISTS "Vehicles view" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles add" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles modify" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles delete" ON public.vehicles;

DROP POLICY IF EXISTS "Vendors view" ON public.vendors;
DROP POLICY IF EXISTS "Vendors add" ON public.vendors;
DROP POLICY IF EXISTS "Vendors modify" ON public.vendors;
DROP POLICY IF EXISTS "Vendors delete" ON public.vendors;

DROP POLICY IF EXISTS "Vendor Contacts view" ON public.vendor_contacts;
DROP POLICY IF EXISTS "Vendor Contacts add" ON public.vendor_contacts;
DROP POLICY IF EXISTS "Vendor Contacts modify" ON public.vendor_contacts;
DROP POLICY IF EXISTS "Vendor Contacts delete" ON public.vendor_contacts;

DROP POLICY IF EXISTS "Communications view" ON public.communications;
DROP POLICY IF EXISTS "Communications add" ON public.communications;
DROP POLICY IF EXISTS "Communications modify" ON public.communications;
DROP POLICY IF EXISTS "Communications delete" ON public.communications;

DROP POLICY IF EXISTS "Orders view access" ON public.orders;
DROP POLICY IF EXISTS "Orders add access" ON public.orders;
DROP POLICY IF EXISTS "Orders modify access" ON public.orders;
DROP POLICY IF EXISTS "Orders delete access" ON public.orders;

DROP POLICY IF EXISTS "History view" ON public.change_history;
DROP POLICY IF EXISTS "History modify (System only usually)" ON public.change_history;

DROP POLICY IF EXISTS "Authenticated full access on cities" ON public.cities;
DROP POLICY IF EXISTS "Authenticated full access on districts" ON public.districts;
DROP POLICY IF EXISTS "Authenticated full access on directions" ON public.directions;
DROP POLICY IF EXISTS "Authenticated full access on warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Authenticated full access on vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Authenticated full access on vendors" ON public.vendors;
DROP POLICY IF EXISTS "Authenticated full access on orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated full access on communications" ON public.communications;
DROP POLICY IF EXISTS "Authenticated full access on change_history" ON public.change_history;
DROP POLICY IF EXISTS "Authenticated full access on vendor_contacts" ON public.vendor_contacts;













-- CITIES
CREATE POLICY "Cities view" ON public.cities FOR SELECT TO authenticated USING (public.has_permission('cities', 'view'));
CREATE POLICY "Cities add" ON public.cities FOR INSERT TO authenticated WITH CHECK (public.has_permission('cities', 'add'));
CREATE POLICY "Cities modify" ON public.cities FOR UPDATE TO authenticated USING (public.has_permission('cities', 'modify'));
CREATE POLICY "Cities delete" ON public.cities FOR DELETE TO authenticated USING (public.has_permission('cities', 'delete'));

-- DISTRICTS (Assuming district is tied to cities permissions)
CREATE POLICY "Districts view" ON public.districts FOR SELECT TO authenticated USING (public.has_permission('cities', 'view'));
CREATE POLICY "Districts add" ON public.districts FOR INSERT TO authenticated WITH CHECK (public.has_permission('cities', 'add'));
CREATE POLICY "Districts modify" ON public.districts FOR UPDATE TO authenticated USING (public.has_permission('cities', 'modify'));
CREATE POLICY "Districts delete" ON public.districts FOR DELETE TO authenticated USING (public.has_permission('cities', 'delete'));

-- DIRECTIONS
CREATE POLICY "Directions view" ON public.directions FOR SELECT TO authenticated USING (public.has_permission('directions', 'view'));
CREATE POLICY "Directions add" ON public.directions FOR INSERT TO authenticated WITH CHECK (public.has_permission('directions', 'add'));
CREATE POLICY "Directions modify" ON public.directions FOR UPDATE TO authenticated USING (public.has_permission('directions', 'modify'));
CREATE POLICY "Directions delete" ON public.directions FOR DELETE TO authenticated USING (public.has_permission('directions', 'delete'));

-- WAREHOUSES
CREATE POLICY "Warehouses view" ON public.warehouses FOR SELECT TO authenticated USING (public.has_permission('warehouses', 'view'));
CREATE POLICY "Warehouses add" ON public.warehouses FOR INSERT TO authenticated WITH CHECK (public.has_permission('warehouses', 'add'));
CREATE POLICY "Warehouses modify" ON public.warehouses FOR UPDATE TO authenticated USING (public.has_permission('warehouses', 'modify'));
CREATE POLICY "Warehouses delete" ON public.warehouses FOR DELETE TO authenticated USING (public.has_permission('warehouses', 'delete'));

-- VEHICLES
CREATE POLICY "Vehicles view" ON public.vehicles FOR SELECT TO authenticated USING (public.has_permission('vehicles', 'view'));
CREATE POLICY "Vehicles add" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.has_permission('vehicles', 'add'));
CREATE POLICY "Vehicles modify" ON public.vehicles FOR UPDATE TO authenticated USING (public.has_permission('vehicles', 'modify'));
CREATE POLICY "Vehicles delete" ON public.vehicles FOR DELETE TO authenticated USING (public.has_permission('vehicles', 'delete'));

-- VENDORS
CREATE POLICY "Vendors view" ON public.vendors FOR SELECT TO authenticated USING (public.has_permission('suppliers', 'view'));
CREATE POLICY "Vendors add" ON public.vendors FOR INSERT TO authenticated WITH CHECK (public.has_permission('suppliers', 'add'));
CREATE POLICY "Vendors modify" ON public.vendors FOR UPDATE TO authenticated USING (public.has_permission('suppliers', 'modify'));
CREATE POLICY "Vendors delete" ON public.vendors FOR DELETE TO authenticated USING (public.has_permission('suppliers', 'delete'));

-- VENDOR CONTACTS
CREATE POLICY "Vendor Contacts view" ON public.vendor_contacts FOR SELECT TO authenticated USING (public.has_permission('contacts', 'view'));
CREATE POLICY "Vendor Contacts add" ON public.vendor_contacts FOR INSERT TO authenticated WITH CHECK (public.has_permission('contacts', 'add'));
CREATE POLICY "Vendor Contacts modify" ON public.vendor_contacts FOR UPDATE TO authenticated USING (public.has_permission('contacts', 'modify'));
CREATE POLICY "Vendor Contacts delete" ON public.vendor_contacts FOR DELETE TO authenticated USING (public.has_permission('contacts', 'delete'));

-- COMMUNICATIONS
CREATE POLICY "Communications view" ON public.communications FOR SELECT TO authenticated USING (public.has_permission('communications', 'view'));
CREATE POLICY "Communications add" ON public.communications FOR INSERT TO authenticated WITH CHECK (public.has_permission('communications', 'add'));
CREATE POLICY "Communications modify" ON public.communications FOR UPDATE TO authenticated USING (public.has_permission('communications', 'modify'));
CREATE POLICY "Communications delete" ON public.communications FOR DELETE TO authenticated USING (public.has_permission('communications', 'delete'));

-- ORDERS
CREATE POLICY "Orders view access" ON public.orders FOR SELECT TO authenticated USING (public.has_permission('orders', 'view'));
CREATE POLICY "Orders add access" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.has_permission('orders', 'add'));
CREATE POLICY "Orders modify access" ON public.orders FOR UPDATE TO authenticated USING (public.has_permission('orders', 'modify'));
-- Operator logic for order deletion
CREATE POLICY "Orders delete access" ON public.orders FOR DELETE TO authenticated 
USING (
  public.has_permission('orders', 'delete') 
  OR ( (SELECT role::text FROM public.profiles WHERE id = auth.uid()) = 'operator' AND created_by = auth.uid() )
);

-- CHANGE HISTORY
CREATE POLICY "History view" ON public.change_history FOR SELECT TO authenticated USING (public.has_permission('history', 'view'));
CREATE POLICY "History modify (System only usually)" ON public.change_history FOR INSERT TO authenticated WITH CHECK (true);

-- SECURITY DEFINER function to bypass RLS recursion on the profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text = 'admin'
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
CREATE INDEX IF NOT EXISTS idx_orders_vendor_date_desc ON public.orders (vendor_id, order_date DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_communications_vendor ON public.communications (vendor_id);
CREATE INDEX IF NOT EXISTS idx_change_history_date ON public.change_history (date_time DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_vendor_id ON public.vendor_contacts (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_is_deleted ON public.vendor_contacts (is_deleted);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_sort_order ON public.vendor_contacts (sort_order);


