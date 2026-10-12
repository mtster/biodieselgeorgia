-- ====================================================================
-- FOCUSED MIGRATION: RLS PERMISSIONS & UNHACKABLE DELETE SECURITY
-- Enforces database-level permission protection on orders & communications
-- Fully synchronizes JWT app_metadata and blocks soft/hard deletes
-- ====================================================================

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- 1. Automated Sync from profiles to auth.users.raw_app_meta_data
-- This places permissions and roles into the tamper-proof JWT app_metadata claim
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth_user()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'role', NEW.role,
      'permissions', COALESCE(NEW.permissions, '{}'::jsonb)
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profile_to_auth_user ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_auth_user
AFTER INSERT OR UPDATE OF role, permissions ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_auth_user();

-- Immediate backfill so existing users' JWT tokens have verified app_metadata
UPDATE auth.users u
SET raw_app_meta_data = 
  COALESCE(u.raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object(
    'role', p.role,
    'permissions', COALESCE(p.permissions, '{}'::jsonb)
  )
FROM public.profiles p
WHERE u.id = p.id;

-- 2. Update has_permission helper
-- Reads exclusively from tamper-proof JWT app_metadata or authoritative profiles table
-- NEVER reads from client-editable user_metadata (preventing frontend role/permission tampering)
CREATE OR REPLACE FUNCTION public.has_permission(module TEXT, perm TEXT)
RETURNS BOOLEAN SECURITY DEFINER AS $$
DECLARE
  u_role TEXT;
  u_permissions jsonb;
  jwt_perms jsonb;
  jwt_role TEXT;
BEGIN
  -- 1. Service role (backend) and direct postgres connection bypass
  IF auth.role() = 'service_role' OR session_user IN ('postgres', 'supabase_admin') THEN
    RETURN true;
  END IF;

  -- 2. Admin in JWT token app_metadata (tamper-proof, set only by database/backend)
  jwt_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');
  IF jwt_role = 'admin' THEN
    RETURN true;
  END IF;

  -- 3. Check verified JWT app_metadata claims for permissions
  jwt_perms := auth.jwt() -> 'app_metadata' -> 'permissions';
  IF jwt_perms IS NOT NULL AND jsonb_typeof(jwt_perms) = 'object' THEN
    IF (jwt_perms -> module) IS NOT NULL AND jsonb_typeof(jwt_perms -> module) = 'array' THEN
      RETURN (jwt_perms -> module) ? perm;
    END IF;
  END IF;

  -- 4. Vehicle / Driver accounts
  IF jwt_role IN ('vehicle', 'driver') THEN
    IF module IN ('vehicles', 'orders', 'suppliers', 'warehouses', 'cities', 'districts', 'directions', 'contacts') AND perm = 'view' THEN
      RETURN true;
    END IF;
    IF module = 'orders' AND perm = 'modify' THEN
      RETURN true;
    END IF;
    IF perm = 'delete' THEN
      RETURN false;
    END IF;
  END IF;

  -- 5. Fallback to authoritative database profiles table
  SELECT role, permissions INTO u_role, u_permissions 
  FROM public.profiles 
  WHERE id = auth.uid() AND is_deleted = false AND is_blocked = false;

  IF u_role::text = 'admin' THEN
    RETURN true;
  END IF;
  
  IF u_role::text IN ('vehicle', 'driver') THEN
    IF module IN ('vehicles', 'orders', 'suppliers', 'warehouses', 'cities', 'districts', 'directions', 'contacts') AND perm = 'view' THEN
      RETURN true;
    END IF;
    IF module = 'orders' AND perm = 'modify' THEN
      RETURN true;
    END IF;
    IF perm = 'delete' THEN
      RETURN false;
    END IF;
  END IF;

  IF u_permissions IS NOT NULL AND jsonb_typeof(u_permissions) = 'object' THEN
    IF (u_permissions -> module) IS NOT NULL AND jsonb_typeof(u_permissions -> module) = 'array' THEN
      RETURN (u_permissions -> module) ? perm;
    END IF;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Clean up all existing policies on orders & communications to eliminate rogue permissive policies
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'orders' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'communications' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.communications', pol.policyname);
  END LOOP;
END$$;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

-- 4. Strict RLS Policies for ORDERS
CREATE POLICY "Orders view access" ON public.orders FOR SELECT TO authenticated USING (
  (
    public.has_permission('orders', 'view')
    AND (
      public.get_current_user_role() != 'logistics_manager'
      OR (order_date AT TIME ZONE 'Asia/Tbilisi')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tbilisi')::date
      OR order_date::date = CURRENT_DATE
    )
  )
  OR vehicle_id IN (SELECT id FROM public.vehicles WHERE auth_user_id = auth.uid() OR id = auth.uid()) 
  OR driver_id = auth.uid() 
  OR companion_id = auth.uid()
);

CREATE POLICY "Orders add access" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  public.has_permission('orders', 'add')
);

CREATE POLICY "Orders modify access" ON public.orders FOR UPDATE TO authenticated USING (
  public.has_permission('orders', 'modify') 
  OR vehicle_id IN (SELECT id FROM public.vehicles WHERE auth_user_id = auth.uid() OR id = auth.uid()) 
  OR driver_id = auth.uid() 
  OR companion_id = auth.uid()
)
WITH CHECK (
  (is_deleted = false OR public.has_permission('orders', 'delete'))
  AND (
    public.has_permission('orders', 'modify') 
    OR vehicle_id IN (SELECT id FROM public.vehicles WHERE auth_user_id = auth.uid() OR id = auth.uid()) 
    OR driver_id = auth.uid() 
    OR companion_id = auth.uid()
  )
);

CREATE POLICY "Orders delete access" ON public.orders FOR DELETE TO authenticated USING (
  public.has_permission('orders', 'delete')
);

-- 5. Strict RLS Policies for COMMUNICATIONS
CREATE POLICY "Communications view" ON public.communications FOR SELECT TO authenticated USING (
  public.has_permission('communications', 'view')
);

CREATE POLICY "Communications add" ON public.communications FOR INSERT TO authenticated WITH CHECK (
  public.has_permission('communications', 'add')
);

CREATE POLICY "Communications modify" ON public.communications FOR UPDATE TO authenticated USING (
  public.has_permission('communications', 'modify')
)
WITH CHECK (
  (is_deleted = false OR public.has_permission('communications', 'delete')) 
  AND public.has_permission('communications', 'modify')
);

CREATE POLICY "Communications delete" ON public.communications FOR DELETE TO authenticated USING (
  public.has_permission('communications', 'delete')
);

-- 6. Bulletproof Triggers: Block soft-delete (is_deleted = true) at the Postgres Engine level
-- Even if an RLS policy has any edge case, these triggers raise an error (42501) on the database level

-- Orders soft-delete blocker
CREATE OR REPLACE FUNCTION public.check_order_delete_permission()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  IF (OLD.is_deleted IS DISTINCT FROM TRUE) AND NEW.is_deleted = TRUE THEN
    IF NOT public.has_permission('orders', 'delete') THEN
      RAISE EXCEPTION 'წვდომა შეზღუდულია: შეკვეთის წაშლის უფლება არ გაქვთ (Permission denied: orders.delete)'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_order_delete_permission ON public.orders;
CREATE TRIGGER trg_check_order_delete_permission
BEFORE UPDATE OF is_deleted ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.check_order_delete_permission();

-- Orders hard-delete blocker
CREATE OR REPLACE FUNCTION public.check_order_hard_delete_permission()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_permission('orders', 'delete') THEN
    RAISE EXCEPTION 'წვდომა შეზღუდულია: შეკვეთის წაშლის უფლება არ გაქვთ (Permission denied: orders.delete)'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_order_hard_delete_permission ON public.orders;
CREATE TRIGGER trg_check_order_hard_delete_permission
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.check_order_hard_delete_permission();

-- Communications soft-delete blocker
CREATE OR REPLACE FUNCTION public.check_communication_delete_permission()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  IF (OLD.is_deleted IS DISTINCT FROM TRUE) AND NEW.is_deleted = TRUE THEN
    IF NOT public.has_permission('communications', 'delete') THEN
      RAISE EXCEPTION 'წვდომა შეზღუდულია: კომუნიკაციის წაშლის უფლება არ გაქვთ (Permission denied: communications.delete)'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_communication_delete_permission ON public.communications;
CREATE TRIGGER trg_check_communication_delete_permission
BEFORE UPDATE OF is_deleted ON public.communications
FOR EACH ROW
EXECUTE FUNCTION public.check_communication_delete_permission();

-- Communications hard-delete blocker
CREATE OR REPLACE FUNCTION public.check_communication_hard_delete_permission()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  IF NOT public.has_permission('communications', 'delete') THEN
    RAISE EXCEPTION 'წვდომა შეზღუდულია: კომუნიკაციის წაშლის უფლება არ გაქვთ (Permission denied: communications.delete)'
      USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_communication_hard_delete_permission ON public.communications;
CREATE TRIGGER trg_check_communication_hard_delete_permission
BEFORE DELETE ON public.communications
FOR EACH ROW
EXECUTE FUNCTION public.check_communication_hard_delete_permission();
