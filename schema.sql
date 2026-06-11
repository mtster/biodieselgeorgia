-- ====================================================================
--  BIODIESEL GEORGIA / ბიოდიზელი ჯორჯია - DATABASE SCHEMA SCRIPT
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
--  HOW TO SYNC YOUR GITHUB REPOSITORY WITH SUPABASE:
--  - Supabase supports automatic migrations using the Supabase CLI.
--  - To fully automate deployments upon push:
--    1. Initialize the Supabase directory: `npx supabase init`
--    2. Save this schema under `supabase/migrations/<timestamp>_init.sql`.
--    3. Setup GitHub Actions with the official Supabase workflow.
--    4. Add your secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` to your GitHub repo settings.
--    5. Whenever you commit and push to `main`, GitHub Actions will verify your database changes and deploy them.
--
-- ====================================================================

-- Enable robust extension support if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Cities (ქალაქები)
CREATE TABLE IF NOT EXISTS cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Districts (უბნები)
CREATE TABLE IF NOT EXISTS districts (
    id TEXT PRIMARY KEY,
    city_id TEXT REFERENCES cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Warehouses (საწყობები)
CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Employees (თანამშრომლები)
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    personal_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'driver', 'companion')),
    privileges TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Vehicles / Trucks (მანქანები)
CREATE TABLE IF NOT EXISTS trucks (
    plate_number TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    driver_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    companion_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Suppliers (მომწოდებლები)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    id_code TEXT NOT NULL,                  -- კომპანიის საიდენტიფიკაციო კოდი
    company_name TEXT NOT NULL,             -- კომპანიის დასახელება
    trade_name TEXT NOT NULL,               -- ობიექტის სავაჭრო დასახელება
    company_code TEXT UNIQUE NOT NULL,      -- კოდი
    bank_account TEXT NOT NULL,             -- საბანკო ანგარიში
    city TEXT NOT NULL,                     -- ქალაქი
    district TEXT NOT NULL,                 -- უბანი
    address TEXT NOT NULL,                  -- მისამართი
    price_per_liter NUMERIC(10, 2) DEFAULT 0.00,  -- ლიტრის ღირებულება
    warehouse_id TEXT REFERENCES warehouses(id) ON DELETE SET NULL, -- საწყობი
    manager_id TEXT REFERENCES employees(id) ON DELETE SET NULL,   -- მენეჯერი
    operator_id TEXT REFERENCES employees(id) ON DELETE SET NULL,  -- ოპერატორი
    contacts JSONB DEFAULT '[]'::JSONB,     -- ტელ, სახელი, პოზიცია, შენიშვნა, დეფაულტი
    comments JSONB DEFAULT '[]'::JSONB,     -- კომენტარი, თარიღი, თანამშრომელი
    working_hours TEXT,                     -- სამუშაო საათები
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_pickup_date TIMESTAMPTZ,
    average_interval_days INT DEFAULT 0
);

-- 7. Orders (შეკვეთები)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    doc_number TEXT UNIQUE NOT NULL,         -- დოკუმენტის ნომერი
    supplier_id TEXT REFERENCES suppliers(id) ON DELETE CASCADE,
    warehouse_id TEXT REFERENCES warehouses(id) ON DELETE SET NULL,
    note TEXT,                               -- შენიშვნა
    qty_requested NUMERIC(12, 2) NOT NULL,   -- რაოდენობა
    qty_actual NUMERIC(12, 2),               -- ფაქტობრივი რაოდენობა
    tanks_to_leave INT NOT NULL DEFAULT 0,   -- დასატოვებელი ავზები რაოდ
    tanks_to_bring INT NOT NULL DEFAULT 0,   -- წამოსაღები ავზების რაოდ
    tanks_left_actual INT,                   -- ფაქტ. დასატოვებელი ავზები რაოდ
    tanks_bring_actual INT,                  -- ფაქტ. წამოსაღები ავზების რაოდ
    pickup_date_time TIMESTAMPTZ,            -- წამოღების თარიღი და დრო
    operator_id TEXT REFERENCES employees(id) ON DELETE SET NULL, -- შეკვეთის თანამშრომელი
    driver_id TEXT REFERENCES employees(id) ON DELETE SET NULL,   -- მძღოლი თანამშრომელი
    companion_id TEXT REFERENCES employees(id) ON DELETE SET NULL,-- თანხლები თანამშრომელი
    truck_plate TEXT REFERENCES trucks(plate_number) ON DELETE SET NULL, -- მანქანა
    status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'scheduled', 'completed', 'cancelled')),
    sms_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Communications (კომუნიკაცია მომწოდებლებთან)
CREATE TABLE IF NOT EXISTS communications (
    id TEXT PRIMARY KEY,
    date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('action', 'reminder')), -- სახეობა (მოქმედება, შეხსენება)
    reminder_time TIMESTAMPTZ,                -- შეხსენების დრო
    employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL, -- თანამშრომელი
    supplier_id TEXT REFERENCES suppliers(id) ON DELETE CASCADE,  -- მომწოდებელი
    supplier_contact_id TEXT,                 -- მომწოდებლის კონტაქტი (JSON lookup/id reference)
    comment TEXT NOT NULL,                     -- კომენტარი
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Change History Trackers (ცვლილებების ისტორია)
CREATE TABLE IF NOT EXISTS change_history (
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
CREATE INDEX IF NOT EXISTS idx_suppliers_company_code ON suppliers (company_code);
CREATE INDEX IF NOT EXISTS idx_orders_doc_number ON orders (doc_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_communications_supplier ON communications (supplier_id);
CREATE INDEX IF NOT EXISTS idx_change_history_date ON change_history (date_time DESC);

-- ====================================================================
--  INSERT INITIAL DEFAULT CORE CREDENTIALS / CONFIG (SAFE ON RE-RUN)
-- ====================================================================
INSERT INTO employees (id, name, personal_id, email, password, phone, role, privileges)
VALUES (
    'emp-admin', 
    'ადმინისტრატორი', 
    '12345678901', 
    'admin@biodiesel.ge', 
    'admin', 
    '599112233', 
    'admin', 
    '{"සියველფერი", "მართვა", "შეკვეთა", "რეპორტები"}'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO cities (id, name) VALUES 
('city-tbilisi', 'თბილისი'),
('city-kutaisi', 'ქუთაისი'),
('city-batumi', 'ბათუმი') ON CONFLICT (id) DO NOTHING;

INSERT INTO districts (id, city_id, name) VALUES
('dist-sab-tb', 'city-tbilisi', 'საბურთალო'),
('dist-vake-tb', 'city-tbilisi', 'ვაკე'),
('dist-gld-tb', 'city-tbilisi', 'გლდანი'),
('dist-ctr-kut', 'city-kutaisi', 'ცენტრი'),
('dist-prt-bat', 'city-batumi', 'პორტი') ON CONFLICT (id) DO NOTHING;

INSERT INTO warehouses (id, name) VALUES
('wh-main', 'ცენტრალური საწყობი'),
('wh-west', 'დასავლეთის საწყობი') ON CONFLICT (id) DO NOTHING;

-- ====================================================================
--  SUPABASE AUTOMATIC AUTH SIGN-UP PROFILE POPULATION (profiles / users)
-- ====================================================================

-- 10. Public Profiles / Users Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'admin',
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies
DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
CREATE POLICY "Allow public read access" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow individual write" ON public.profiles;
CREATE POLICY "Allow individual write" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow individual update" ON public.profiles;
CREATE POLICY "Allow individual update" ON public.profiles FOR UPDATE USING (true);

-- Automating profile creation upon Supabase Authed User creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into public.profiles
  INSERT INTO public.profiles (id, email, name, role, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'admin'),
    COALESCE(new.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert into public.employees to sync types
  INSERT INTO public.employees (id, name, personal_id, email, phone, role, privileges)
  VALUES (
    new.id::text,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'personal_id', '12345678901'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', '599112233'),
    COALESCE(new.raw_user_meta_data->>'role', 'admin'),
    '{"සියველფერი", "მართვა", "შეკვეთა", "რეპორტები"}'
  )
  ON CONFLICT (email) DO UPDATE 
  SET id = EXCLUDED.id; -- Sync the primary id
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to auth.users inserts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

