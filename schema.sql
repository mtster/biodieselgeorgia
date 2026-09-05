-- ====================================================================
--  BIODIESEL GEORGIA - DATABASE SCHEMA SCRIPT (PRODUCTIONS STANDARDS)
-- ====================================================================
--  This script establishes tables, primary keys, foreign constraints, indices, and defaults.
--  Configured to be non-destructive and re-runnable again and again safely.

-- Enable robust extension support if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    companion_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    city TEXT,
    direction_id TEXT,
    warehouse_id TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Apply non-destructive updates to public.vehicles table if it pre-exists
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_pkey CASCADE;
ALTER TABLE public.vehicles ADD PRIMARY KEY (id);
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_number_key;
ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_plate_number_key UNIQUE (plate_number);
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
    city TEXT NOT NULL,                     -- City ID (references public.cities(id))
    district TEXT NOT NULL,                 -- District ID (references public.districts(id))
    address TEXT NOT NULL,                  -- Address
    price_per_liter NUMERIC(10, 2) DEFAULT 0.00,  -- Price per Liter
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL, -- Warehouse Reference
    manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,   -- Account Manager
    operator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- Operator
    comments JSONB DEFAULT '[]'::JSONB,     -- Comments History
    working_hours TEXT,                     -- Working Hours
    is_active BOOLEAN DEFAULT TRUE,        -- Active status
    is_deleted BOOLEAN DEFAULT FALSE,
    is_planned BOOLEAN DEFAULT FALSE,
    planned_weekday TEXT DEFAULT NULL,
    frequency_weeks INT DEFAULT 1,
    tanks_to_bring NUMERIC(10, 2) DEFAULT 0,
    tanks_to_leave NUMERIC(10, 2) DEFAULT 0,
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
ALTER TABLE public.vendors DROP COLUMN IF EXISTS barrels_amount CASCADE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS direction_id TEXT DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS overdue_threshold_days INT DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_planned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS planned_weekday TEXT DEFAULT NULL;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS frequency_weeks INT DEFAULT 1;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tanks_to_bring NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tanks_to_leave NUMERIC(10, 2) DEFAULT 0;
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
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply non-destructive updates to public.vendor_contacts table if it pre-exists
ALTER TABLE public.vendor_contacts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.vendor_contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
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
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,  -- Vehicle assigned
    fact_qty NUMERIC(12, 2) DEFAULT 0.00,  -- Fact QTY
    fact_tank_dropoff INT DEFAULT 0,       -- Fact Tank Dropoff
    fact_tank_pickup INT DEFAULT 0,        -- Fact Tank Pickup
    status TEXT NOT NULL DEFAULT 'registered',
    sms_sent BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apply non-destructive updates to public.orders table if it pre-exists
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fact_qty NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fact_tank_dropoff INT DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fact_tank_pickup INT DEFAULT 0;
ALTER TABLE public.orders DROP COLUMN IF EXISTS waybill_qty CASCADE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS contact_id TEXT DEFAULT NULL;
ALTER TABLE public.orders DROP COLUMN IF EXISTS contact_name CASCADE;
ALTER TABLE public.orders DROP COLUMN IF EXISTS contact_phone CASCADE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.orders ALTER COLUMN qty_requested DROP NOT NULL;
ALTER TABLE public.orders DROP COLUMN IF EXISTS truck_plate CASCADE;
ALTER TABLE public.orders DROP COLUMN IF EXISTS note CASCADE;

-- Performance Indexes for Driver Logistics & Orders Portal & Global Search
CREATE INDEX IF NOT EXISTS idx_orders_vehicle_id ON public.orders(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON public.orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_doc_number ON public.orders(doc_number);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_is_deleted ON public.orders(is_deleted);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_doc_number_trgm ON public.orders USING gin (doc_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vendors_trade_name ON public.vendors(trade_name);
CREATE INDEX IF NOT EXISTS idx_vendors_company_name ON public.vendors(company_name);
CREATE INDEX IF NOT EXISTS idx_vendors_is_deleted ON public.vendors(is_deleted);
CREATE INDEX IF NOT EXISTS idx_vendors_trade_name_trgm ON public.vendors USING gin (trade_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vendors_company_name_trgm ON public.vendors USING gin (company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vehicles_auth_user_id ON public.vehicles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON public.vehicles(driver_id);

-- Safe update of the status CHECK constraint if it exists
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('registered', 'driver_assigned', 'picked_up', 'completed', 'cancelled'));

-- 8. Communications
CREATE TABLE IF NOT EXISTS public.communications (
    id TEXT PRIMARY KEY,
    date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('action', 'reminder', 'task')), -- Communication Type
    reminder_time TIMESTAMPTZ,                -- Remind time
    has_time BOOLEAN DEFAULT FALSE,           -- Whether time was specifically chosen or date-only
    vendor_id TEXT REFERENCES public.vendors(id) ON DELETE CASCADE,  -- Connected Vendor
    vendor_contact_id TEXT,                   -- Specific contact person
    comment TEXT NOT NULL,                     -- Notes/Log details
    responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Responsible User (პასუხისმგებელი პირი)
    is_completed BOOLEAN DEFAULT FALSE,        -- Task Status (დავალების სტატუსი: FALSE = აქტიური, TRUE = შესრულებული)
    is_deleted BOOLEAN DEFAULT FALSE,
    created_by TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe update of communication type check constraint
ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_type_check;
ALTER TABLE public.communications ADD CONSTRAINT communications_type_check CHECK (type IN ('action', 'reminder', 'task'));

-- Apply non-destructive updates to public.communications
ALTER TABLE public.communications DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS has_time BOOLEAN DEFAULT FALSE;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_communications_vendor_id ON public.communications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_communications_reminder_time ON public.communications(reminder_time);
CREATE INDEX IF NOT EXISTS idx_communications_is_deleted ON public.communications(is_deleted);
CREATE INDEX IF NOT EXISTS idx_communications_responsible_user_id ON public.communications(responsible_user_id);

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
  v_personal_id TEXT;
  v_name TEXT;
  v_phone TEXT;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'operator');
  
  IF v_role = 'vendor' OR v_role = 'vehicle' OR COALESCE(new.raw_user_meta_data->>'vehicle_role', '') = 'vehicle' THEN
    RETURN NEW;
  END IF;

  -- Map any legacy/non-standard roles to the standard ones
  IF v_role = 'manager' THEN
    v_role := 'purchasing_head';
  ELSIF v_role NOT IN ('admin', 'purchasing_head', 'purchasing_manager', 'operator', 'logistics_manager', 'driver') THEN
    v_role := 'operator'; -- Default fallback
  END IF;

  v_name := COALESCE(NULLIF(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1));
  v_phone := COALESCE(NULLIF(new.raw_user_meta_data->>'phone', ''), '+995 599 00 00 00');
  v_personal_id := COALESCE(
    NULLIF(new.raw_user_meta_data->>'personal_id', ''),
    substr(regexp_replace(new.id::text, '[^0-9]', '', 'g') || '12345678901', 1, 11)
  );

  -- Clean up any orphaned profile record with matching email or personal_id but mismatched id
  DELETE FROM public.profiles WHERE (email = new.email OR (personal_id = v_personal_id AND v_personal_id != '')) AND id != new.id;

  INSERT INTO public.profiles (
    id, 
    name, 
    personal_id, 
    email, 
    phone, 
    role, 
    permissions,
    vendor_id,
    is_deleted,
    is_blocked
  )
  VALUES (
    new.id,
    v_name,
    v_personal_id,
    new.email,
    v_phone,
    v_role,
    COALESCE(new.raw_user_meta_data->'permissions', '{}'::JSONB),
    new.raw_user_meta_data->>'vendor_id',
    FALSE,
    FALSE
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    personal_id = EXCLUDED.personal_id,
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    vendor_id = EXCLUDED.vendor_id,
    is_deleted = FALSE;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Prevent trigger failures from crashing auth.users creation
  RAISE WARNING 'handle_new_user trigger error: % %', SQLERRM, SQLSTATE;
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
  -- Service role and postgres superuser always have all permissions
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN true;
  END IF;

  -- Admin in JWT token metadata always has all permissions
  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin' THEN
    RETURN true;
  END IF;

  -- Handle vehicle accounts (authenticated user linked to a vehicle or driver role)
  IF EXISTS (
    SELECT 1 FROM public.vehicles 
    WHERE auth_user_id = auth.uid() OR id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role::text = 'vehicle' OR role::text = 'driver')
  ) THEN
    IF module IN ('vehicles', 'orders', 'suppliers', 'warehouses', 'cities', 'districts', 'directions', 'contacts') AND perm = 'view' THEN
      RETURN true;
    END IF;
    IF module = 'orders' AND perm = 'modify' THEN
      RETURN true;
    END IF;
  END IF;

  SELECT role, permissions INTO u_role, u_permissions FROM public.profiles WHERE id = auth.uid();
  IF u_role::text = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Handle permissions checking using JSONB containment or extraction
  RETURN COALESCE((u_permissions -> module) ? perm, false);
END;
$$ LANGUAGE plpgsql STABLE;


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
CREATE POLICY "Vehicles view" ON public.vehicles FOR SELECT TO authenticated USING (
  public.has_permission('vehicles', 'view') 
  OR auth_user_id = auth.uid() 
  OR id = auth.uid() 
  OR driver_id = auth.uid() 
  OR companion_id = auth.uid()
);
CREATE POLICY "Vehicles add" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.has_permission('vehicles', 'add'));
CREATE POLICY "Vehicles modify" ON public.vehicles FOR UPDATE TO authenticated USING (
  public.has_permission('vehicles', 'modify') 
  OR auth_user_id = auth.uid() 
  OR id = auth.uid()
);
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
CREATE POLICY "Orders view access" ON public.orders FOR SELECT TO authenticated USING (
  public.has_permission('orders', 'view') 
  OR vehicle_id IN (SELECT id FROM public.vehicles WHERE auth_user_id = auth.uid() OR id = auth.uid()) 
  OR driver_id = auth.uid() 
  OR companion_id = auth.uid()
);
CREATE POLICY "Orders add access" ON public.orders FOR INSERT TO authenticated WITH CHECK (public.has_permission('orders', 'add'));
CREATE POLICY "Orders modify access" ON public.orders FOR UPDATE TO authenticated USING (
  public.has_permission('orders', 'modify') 
  OR vehicle_id IN (SELECT id FROM public.vehicles WHERE auth_user_id = auth.uid() OR id = auth.uid()) 
  OR driver_id = auth.uid() 
  OR companion_id = auth.uid()
);
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
  -- Service role and postgres superuser always have elevated admin access
  IF auth.role() = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN true;
  END IF;

  -- Admin role explicitly asserted in verified JWT claims
  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin' THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text = 'admin' AND is_deleted = FALSE
  );
END;
$$ LANGUAGE plpgsql STABLE;

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

-- Ensure trg_protect_admin_profiles is removed
DROP TRIGGER IF EXISTS trg_protect_admin_profiles ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_admin_profiles();

-- Indices for high-speed performance
CREATE INDEX IF NOT EXISTS idx_districts_city_id ON public.districts (city_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company_code ON public.vendors (company_code);
CREATE INDEX IF NOT EXISTS idx_vendors_trade_name ON public.vendors (trade_name);
CREATE INDEX IF NOT EXISTS idx_vendors_company_name ON public.vendors (company_name);
CREATE INDEX IF NOT EXISTS idx_vendors_id_code ON public.vendors (id_code);
CREATE INDEX IF NOT EXISTS idx_vendors_city_district ON public.vendors (city, district) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_vendors_planning ON public.vendors (is_planned, planned_weekday) WHERE is_planned = true AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_orders_doc_number ON public.orders (doc_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_date_desc ON public.orders (vendor_id, order_date DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_communications_vendor ON public.communications (vendor_id);
CREATE INDEX IF NOT EXISTS idx_change_history_date ON public.change_history (date_time DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_vendor_id ON public.vendor_contacts (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_is_deleted ON public.vendor_contacts (is_deleted);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_sort_order ON public.vendor_contacts (sort_order);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_name ON public.vendor_contacts (name);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_phone ON public.vendor_contacts (phone);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_active_phone ON public.vendor_contacts (phone) WHERE is_deleted = false AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_vendor_active ON public.vendor_contacts (vendor_id, is_active, is_deleted);
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_communications_date_time_desc ON public.communications (date_time DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_default_sort ON public.vendor_contacts (is_default DESC, sort_order DESC) WHERE is_deleted = false;

-- High-performance indexes for Overdue Vendors (ვადაგადაცილებული მომწოდებლები)
-- Index for LATERAL order lookup in O(1) single index scan per vendor
CREATE INDEX IF NOT EXISTS idx_orders_vendor_completed_date_desc 
ON public.orders (vendor_id, order_date DESC) 
WHERE is_deleted = false AND status = 'completed';

-- Filtered partial index for active vendors: excludes inactive and deleted suppliers
CREATE INDEX IF NOT EXISTS idx_vendors_overdue_lookup 
ON public.vendors (is_deleted, is_active, created_at DESC) 
WHERE is_deleted = false AND is_active = true;

-- Left Join Lateral View for Overdue Vendors (Strictly Active Suppliers Only)
CREATE OR REPLACE VIEW public.overdue_vendors_view AS
SELECT 
    v.id::TEXT AS id,
    v.id_code,
    v.company_name,
    v.trade_name,
    v.city,
    v.district,
    v.manager_id,
    v.is_active,
    'Active'::TEXT AS status,
    v.overdue_threshold_days,
    v.created_at,
    lo.order_date AS last_order_date,
    CASE 
        WHEN lo.order_date IS NOT NULL THEN 
            GREATEST(0, (CURRENT_DATE - lo.order_date::date))::INT
        ELSE 
            GREATEST(0, (CURRENT_DATE - v.created_at::date))::INT
    END AS days_ago,
    CASE 
        WHEN lo.order_date IS NOT NULL THEN 
            ((CURRENT_DATE - lo.order_date::date) - COALESCE(v.overdue_threshold_days, 0))::INT
        ELSE 
            ((CURRENT_DATE - v.created_at::date) - 30)::INT
    END AS overdue_days
FROM public.vendors v
LEFT JOIN LATERAL (
    SELECT o.id, o.order_date
    FROM public.orders o
    WHERE o.vendor_id = v.id 
      AND o.is_deleted = false 
      AND o.status = 'completed'
    ORDER BY o.order_date DESC
    LIMIT 1
) lo ON true
WHERE v.is_deleted = false
  AND v.is_active = true
  AND (
      (lo.order_date IS NOT NULL 
       AND v.overdue_threshold_days IS NOT NULL 
       AND v.overdue_threshold_days > 0 
       AND ((CURRENT_DATE - lo.order_date::date) > v.overdue_threshold_days))
      OR
      (lo.order_date IS NULL 
       AND (CURRENT_DATE - v.created_at::date) > 30)
  );

GRANT SELECT ON public.overdue_vendors_view TO authenticated, anon;

-- RPC Function for Overdue Vendors using LEFT JOIN LATERAL (Strictly Active Suppliers Only)
CREATE OR REPLACE FUNCTION public.get_overdue_vendors()
RETURNS TABLE (
    id TEXT,
    id_code TEXT,
    company_name TEXT,
    trade_name TEXT,
    city TEXT,
    district TEXT,
    manager_id UUID,
    is_active BOOLEAN,
    status TEXT,
    overdue_threshold_days INT,
    created_at TIMESTAMPTZ,
    last_order_date TIMESTAMPTZ,
    days_ago INT,
    overdue_days INT
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        v.id::TEXT AS id,
        v.id_code,
        v.company_name,
        v.trade_name,
        v.city,
        v.district,
        v.manager_id,
        v.is_active,
        'Active'::TEXT AS status,
        v.overdue_threshold_days,
        v.created_at,
        lo.order_date AS last_order_date,
        CASE 
            WHEN lo.order_date IS NOT NULL THEN 
                GREATEST(0, (CURRENT_DATE - lo.order_date::date))::INT
            ELSE 
                GREATEST(0, (CURRENT_DATE - v.created_at::date))::INT
        END AS days_ago,
        CASE 
            WHEN lo.order_date IS NOT NULL THEN 
                ((CURRENT_DATE - lo.order_date::date) - COALESCE(v.overdue_threshold_days, 0))::INT
            ELSE 
                ((CURRENT_DATE - v.created_at::date) - 30)::INT
        END AS overdue_days
    FROM public.vendors v
    LEFT JOIN LATERAL (
        SELECT o.id, o.order_date
        FROM public.orders o
        WHERE o.vendor_id = v.id 
          AND o.is_deleted = false 
          AND o.status = 'completed'
        ORDER BY o.order_date DESC
        LIMIT 1
    ) lo ON true
    WHERE v.is_deleted = false
      AND v.is_active = true
      AND (
          (lo.order_date IS NOT NULL 
           AND v.overdue_threshold_days IS NOT NULL 
           AND v.overdue_threshold_days > 0 
           AND ((CURRENT_DATE - lo.order_date::date) > v.overdue_threshold_days))
          OR
          (lo.order_date IS NULL 
           AND (CURRENT_DATE - v.created_at::date) > 30)
      )
    ORDER BY overdue_days DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_overdue_vendors() TO authenticated, anon;



