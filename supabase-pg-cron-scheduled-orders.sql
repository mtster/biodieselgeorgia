-- ====================================================================
--  SUPABASE PG_CRON: BULLETPROOF SCHEDULED ORDERS MIGRATION SCRIPT
-- ====================================================================
--  Schedule: Runs every day at 6:00 AM Tbilisi time (02:00 AM UTC).
--  Key Features:
--    1. Safely creates/migrates vendor columns:
--       - planned_weekday: integer[] (1=Mon ... 7=Sun)
--       - frequency_weeks: integer default 1
--       - is_planned: boolean default false
--    2. Multi-week frequency support (every 1, 2, 3, 4 weeks) with full week-level
--       consistency (runs on all selected days during active week, skips during off-weeks)
--       and DOES NOT get thrown off by ad-hoc / manual orders created by operators.
--    3. Per-vendor exception isolation: an issue with one vendor will NEVER fail or
--       abort order generation for the other vendors.
--    4. Collision-proof doc_number generation (date prefix + unique code check).
--    5. route_rank is explicitly set to NULL (empty).
--    6. Cancels old jobs and reschedules cleanly.
-- ====================================================================

-- 1. Enable pg_cron and btree_gin extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Ensure public.vendors columns exist and have correct types
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_planned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS frequency_weeks INT DEFAULT 1;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tanks_to_bring NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tanks_to_leave NUMERIC(10, 2) DEFAULT 0;

-- Backfill NULLs to clean defaults
UPDATE public.vendors SET is_planned = FALSE WHERE is_planned IS NULL;
UPDATE public.vendors SET frequency_weeks = 1 WHERE frequency_weeks IS NULL OR frequency_weeks < 1;
UPDATE public.vendors SET tanks_to_bring = 0 WHERE tanks_to_bring IS NULL;
UPDATE public.vendors SET tanks_to_leave = 0 WHERE tanks_to_leave IS NULL;

-- 3. Migrate planned_weekday column to integer[] safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'vendors' 
      AND column_name = 'planned_weekday'
      AND data_type <> 'ARRAY'
  ) THEN
    ALTER TABLE public.vendors 
      ALTER COLUMN planned_weekday TYPE integer[] 
      USING (
        CASE 
          WHEN planned_weekday IS NULL OR trim(planned_weekday::text) = '' THEN NULL
          WHEN lower(trim(planned_weekday::text)) = 'monday' THEN ARRAY[1]
          WHEN lower(trim(planned_weekday::text)) = 'tuesday' THEN ARRAY[2]
          WHEN lower(trim(planned_weekday::text)) = 'wednesday' THEN ARRAY[3]
          WHEN lower(trim(planned_weekday::text)) = 'thursday' THEN ARRAY[4]
          WHEN lower(trim(planned_weekday::text)) = 'friday' THEN ARRAY[5]
          WHEN lower(trim(planned_weekday::text)) = 'saturday' THEN ARRAY[6]
          WHEN lower(trim(planned_weekday::text)) = 'sunday' THEN ARRAY[7]
          WHEN planned_weekday::text ~ '^[0-9]+$' THEN ARRAY[planned_weekday::text::integer]
          ELSE NULL
        END
      );
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'vendors' 
      AND column_name = 'planned_weekday'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN planned_weekday integer[] DEFAULT NULL;
  END IF;
END $$;

-- 4. High-performance indexes for weekday lookup
DROP INDEX IF EXISTS public.idx_vendors_planning;
DROP INDEX IF EXISTS public.idx_vendors_planned_weekday_gin;
CREATE INDEX IF NOT EXISTS idx_vendors_planning ON public.vendors (is_planned) WHERE is_planned = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_vendors_planned_weekday_gin ON public.vendors USING GIN (planned_weekday) WHERE is_planned = TRUE AND is_deleted = FALSE;

-- Ensure route_rank exists on public.orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS route_rank TEXT DEFAULT NULL;

-- 5. Drop old function signatures
DROP FUNCTION IF EXISTS public.generate_scheduled_orders(DATE);
DROP FUNCTION IF EXISTS public.generate_scheduled_orders();

-- 6. Create the bulletproof scheduled orders generation function
CREATE OR REPLACE FUNCTION public.generate_scheduled_orders(
  p_target_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tbilisi')::date
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_dow INT;
  v_weekday_ka TEXT;
  v_current_week_start DATE;
  v_prev_order_date DATE;
  v_prev_week_start DATE;
  v_weeks_diff INT;
  v_has_order_this_week BOOLEAN;
  v_vendor RECORD;
  v_contact_id TEXT;
  v_warehouse_id TEXT;
  v_new_doc TEXT;
  v_new_order_id TEXT;
  v_created_count INT := 0;
  v_skipped_count INT := 0;
  v_error_count INT := 0;
  v_details JSONB := '[]'::JSONB;
  v_errors JSONB := '[]'::JSONB;
  v_order_timestamp TIMESTAMPTZ;
  v_retry_count INT;
BEGIN
  -- ISO Day of Week: 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = Sunday
  v_target_dow := EXTRACT(ISODOW FROM p_target_date)::INT;

  CASE v_target_dow
    WHEN 1 THEN v_weekday_ka := 'ორშაბათი';
    WHEN 2 THEN v_weekday_ka := 'სამშაბათი';
    WHEN 3 THEN v_weekday_ka := 'ოთხშაბათი';
    WHEN 4 THEN v_weekday_ka := 'ხუთშაბათი';
    WHEN 5 THEN v_weekday_ka := 'პარასკევი';
    WHEN 6 THEN v_weekday_ka := 'შაბათი';
    WHEN 7 THEN v_weekday_ka := 'კვირა';
  END CASE;

  -- ISO week start date (always Monday)
  v_current_week_start := date_trunc('week', p_target_date)::date;

  -- Timestamp of order: 09:00:00 AM Tbilisi time (+04:00) on target date
  v_order_timestamp := (p_target_date || ' 09:00:00+04')::TIMESTAMPTZ;

  -- Loop through active planned vendors that have today's weekday in their planned_weekday array
  FOR v_vendor IN 
    SELECT 
      v.id, 
      v.trade_name, 
      v.company_name, 
      v.warehouse_id, 
      COALESCE(v.frequency_weeks, 1) AS frequency_weeks, 
      v.planned_weekday,
      COALESCE(v.tanks_to_bring, 0) AS tanks_to_bring, 
      COALESCE(v.tanks_to_leave, 0) AS tanks_to_leave
    FROM public.vendors v
    WHERE v.is_deleted = FALSE 
      AND v.is_planned = TRUE 
      AND v.planned_weekday IS NOT NULL
      AND v_target_dow = ANY(v.planned_weekday)
  LOOP
    -- Per-vendor block with exception handler: error on one vendor NEVER breaks others!
    BEGIN
      -- 1. Prevent duplicate scheduled order for this vendor on target date
      IF EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.vendor_id = v_vendor.id
          AND o.is_deleted = FALSE
          AND o.status != 'cancelled'
          AND (o.order_date AT TIME ZONE 'Asia/Tbilisi')::date = p_target_date
      ) THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;

      -- 2. Multi-week frequency check (e.g. Every 2, 3, or 4 weeks)
      IF v_vendor.frequency_weeks > 1 THEN
        -- Check if an order already ran for this vendor during the current calendar week
        SELECT EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.vendor_id = v_vendor.id
            AND o.is_deleted = FALSE
            AND o.status != 'cancelled'
            AND (o.created_by IS NULL OR o.notes::text ILIKE '%გეგმიური%')
            AND date_trunc('week', (o.order_date AT TIME ZONE 'Asia/Tbilisi')::date)::date = v_current_week_start
        ) INTO v_has_order_this_week;

        -- If an order has NOT yet run this week, check weeks elapsed since the last SCHEDULED order
        IF NOT v_has_order_this_week THEN
          SELECT MAX((o.order_date AT TIME ZONE 'Asia/Tbilisi')::date) INTO v_prev_order_date
          FROM public.orders o
          WHERE o.vendor_id = v_vendor.id
            AND o.is_deleted = FALSE
            AND o.status != 'cancelled'
            AND (o.created_by IS NULL OR o.notes::text ILIKE '%გეგმიური%')
            AND (o.order_date AT TIME ZONE 'Asia/Tbilisi')::date < v_current_week_start;

          IF v_prev_order_date IS NOT NULL THEN
            v_prev_week_start := date_trunc('week', v_prev_order_date)::date;
            v_weeks_diff := ((v_current_week_start - v_prev_week_start) / 7)::INT;

            -- If fewer weeks have elapsed than required frequency, skip this week
            IF v_weeks_diff < v_vendor.frequency_weeks THEN
              v_skipped_count := v_skipped_count + 1;
              CONTINUE;
            END IF;
          END IF;
        END IF;
      END IF;

      -- 3. Retrieve primary vendor contact safely
      SELECT c.id INTO v_contact_id
      FROM public.vendor_contacts c
      WHERE c.vendor_id = v_vendor.id AND c.is_deleted = FALSE
      ORDER BY c.is_default DESC, c.sort_order DESC
      LIMIT 1;

      -- 4. Validate warehouse exists to prevent foreign key errors
      v_warehouse_id := v_vendor.warehouse_id;
      IF v_warehouse_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.warehouses w WHERE w.id = v_warehouse_id) THEN
          v_warehouse_id := NULL;
        END IF;
      END IF;

      -- 5. Generate collision-proof unique document number
      v_retry_count := 0;
      LOOP
        v_new_doc := 'DOC-' || TO_CHAR(p_target_date, 'YYYYMMDD') || '-' || LPAD((FLOOR(random() * 90000) + 10000)::TEXT, 5, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.orders WHERE doc_number = v_new_doc);
        v_retry_count := v_retry_count + 1;
        IF v_retry_count > 10 THEN
          v_new_doc := 'DOC-' || TO_CHAR(p_target_date, 'YYYYMMDD') || '-' || SUBSTR(MD5(random()::TEXT), 1, 6);
          EXIT;
        END IF;
      END LOOP;

      v_new_order_id := gen_random_uuid()::TEXT;

      -- 6. Insert scheduled order (route_rank explicitly NULL)
      INSERT INTO public.orders (
        id,
        order_date,
        doc_number,
        vendor_id,
        warehouse_id,
        contact_id,
        operator_id,
        created_by,
        qty_requested,
        tanks_to_leave,
        tanks_to_bring,
        status,
        notes,
        route_rank,
        is_deleted
      ) VALUES (
        v_new_order_id,
        v_order_timestamp,
        v_new_doc,
        v_vendor.id,
        v_warehouse_id,
        v_contact_id,
        NULL,
        NULL,
        NULL,
        v_vendor.tanks_to_leave,
        v_vendor.tanks_to_bring,
        'registered',
        jsonb_build_array(jsonb_build_object(
          'id', 'n_' || SUBSTR(MD5(random()::TEXT), 1, 8),
          'comment', 'გეგმიური შეკვეთა (' || v_weekday_ka || ', სიხშირე: ' || v_vendor.frequency_weeks || ' კვ.)',
          'created_at', NOW()
        )),
        NULL,
        FALSE
      );

      v_created_count := v_created_count + 1;
      v_details := v_details || jsonb_build_object(
        'doc_number', v_new_doc,
        'vendor_id', v_vendor.id,
        'trade_name', COALESCE(v_vendor.trade_name, v_vendor.company_name),
        'tanks_to_bring', v_vendor.tanks_to_bring,
        'tanks_to_leave', v_vendor.tanks_to_leave
      );

    EXCEPTION WHEN OTHERS THEN
      -- Record error without failing whole batch
      v_error_count := v_error_count + 1;
      v_errors := v_errors || jsonb_build_object(
        'vendor_id', v_vendor.id,
        'trade_name', COALESCE(v_vendor.trade_name, v_vendor.company_name),
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'target_date', p_target_date,
    'dow', v_target_dow,
    'weekday', v_weekday_ka,
    'created_count', v_created_count,
    'skipped_count', v_skipped_count,
    'error_count', v_error_count,
    'orders', v_details,
    'errors', v_errors
  );
END;
$$;

-- 7. Reschedule pg_cron to run daily at 6:00 AM Tbilisi time (02:00 AM UTC)
DO $$
DECLARE
  v_job RECORD;
BEGIN
  FOR v_job IN SELECT jobid FROM cron.job WHERE jobname = 'generate-scheduled-orders-6am-tbilisi' LOOP
    PERFORM cron.unschedule(v_job.jobid);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'generate-scheduled-orders-6am-tbilisi',
  '0 2 * * *',
  'SELECT public.generate_scheduled_orders()'
);
