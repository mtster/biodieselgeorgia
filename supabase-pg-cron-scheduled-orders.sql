-- ====================================================================
--  SUPABASE PG_CRON: MULTI-WEEKDAY AUTOMATED SCHEDULED ORDERS
-- ====================================================================
--  Schedule: Runs every day at 6:00 AM Tbilisi time (02:00 AM UTC).
--  Features:
--    1. Migrates planned_weekday in public.vendors to integer[] (1=Mon ... 7=Sun)
--    2. Supports multiple selected weekdays per vendor (e.g. Tue + Thu)
--    3. Multi-week frequency support (every 1, 2, 3, 4 weeks) with full week-level
--       consistency (runs on all selected days during active week, skips during off-weeks)
--    4. Creates orders with 'გეგმიური შეკვეთა' note and created_by = NULL
--       so the app UI displays the 'გეგმიური' badge.
-- ====================================================================

-- 1. Enable pg_cron and btree_gin extensions if not already present
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- 2. Migrate planned_weekday column to integer[] safely
DO $$
BEGIN
  -- Check if column exists and is not already integer[]
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
          WHEN planned_weekday IS NULL OR trim(planned_weekday) = '' THEN NULL
          WHEN lower(trim(planned_weekday)) = 'monday' THEN ARRAY[1]
          WHEN lower(trim(planned_weekday)) = 'tuesday' THEN ARRAY[2]
          WHEN lower(trim(planned_weekday)) = 'wednesday' THEN ARRAY[3]
          WHEN lower(trim(planned_weekday)) = 'thursday' THEN ARRAY[4]
          WHEN lower(trim(planned_weekday)) = 'friday' THEN ARRAY[5]
          WHEN lower(trim(planned_weekday)) = 'saturday' THEN ARRAY[6]
          WHEN lower(trim(planned_weekday)) = 'sunday' THEN ARRAY[7]
          WHEN planned_weekday ~ '^[0-9]+$' THEN ARRAY[planned_weekday::integer]
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

-- Ensure GIN index for high-scale weekday search performance
DROP INDEX IF EXISTS public.idx_vendors_planning;
DROP INDEX IF EXISTS public.idx_vendors_planned_weekday_gin;
CREATE INDEX IF NOT EXISTS idx_vendors_planning ON public.vendors (is_planned) WHERE is_planned = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_vendors_planned_weekday_gin ON public.vendors USING GIN (planned_weekday) WHERE is_planned = TRUE AND is_deleted = FALSE;

-- 3. Unschedule previous cron job and drop old function versions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-scheduled-orders-6am-tbilisi') THEN
    PERFORM cron.unschedule('generate-scheduled-orders-6am-tbilisi');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP FUNCTION IF EXISTS public.generate_scheduled_orders(DATE);
DROP FUNCTION IF EXISTS public.generate_scheduled_orders();

-- 4. Create the new high-scale scheduled order generation database function
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
  v_new_doc TEXT;
  v_new_order_id TEXT;
  v_created_count INT := 0;
  v_details JSONB := '[]'::JSONB;
  v_order_timestamp TIMESTAMPTZ;
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

  -- Week starts on Monday (ISO standard)
  v_current_week_start := date_trunc('week', p_target_date)::date;

  -- Timestamp of order: 09:00:00 AM Tbilisi time (+04:00) on target date
  v_order_timestamp := (p_target_date || ' 09:00:00+04')::TIMESTAMPTZ;

  -- Loop through active planned vendors that have today's weekday in their planned_weekday array
  FOR v_vendor IN 
    SELECT 
      id, 
      trade_name, 
      company_name, 
      warehouse_id, 
      frequency_weeks, 
      planned_weekday,
      tanks_to_bring, 
      tanks_to_leave, 
      operator_id, 
      manager_id
    FROM public.vendors
    WHERE is_deleted = FALSE 
      AND is_planned = TRUE 
      AND planned_weekday IS NOT NULL
      AND v_target_dow = ANY(planned_weekday)
  LOOP

    -- 1. Prevent duplicate order for this vendor on target date
    IF EXISTS (
      SELECT 1 FROM public.orders
      WHERE vendor_id = v_vendor.id
        AND is_deleted = FALSE
        AND (order_date AT TIME ZONE 'Asia/Tbilisi')::date = p_target_date
    ) THEN
      CONTINUE;
    END IF;

    -- 2. Multi-week frequency check (e.g. Every 2 or 3 weeks)
    IF COALESCE(v_vendor.frequency_weeks, 1) > 1 THEN
      -- Check if an order already ran for this vendor during the current calendar week
      SELECT EXISTS (
        SELECT 1 FROM public.orders
        WHERE vendor_id = v_vendor.id
          AND is_deleted = FALSE
          AND date_trunc('week', (order_date AT TIME ZONE 'Asia/Tbilisi')::date)::date = v_current_week_start
      ) INTO v_has_order_this_week;

      -- If an order has NOT yet run this week, check how many weeks passed since the previous scheduled week
      IF NOT v_has_order_this_week THEN
        SELECT MAX((order_date AT TIME ZONE 'Asia/Tbilisi')::date) INTO v_prev_order_date
        FROM public.orders
        WHERE vendor_id = v_vendor.id
          AND is_deleted = FALSE
          AND (order_date AT TIME ZONE 'Asia/Tbilisi')::date < v_current_week_start;

        IF v_prev_order_date IS NOT NULL THEN
          v_prev_week_start := date_trunc('week', v_prev_order_date)::date;
          v_weeks_diff := (v_current_week_start - v_prev_week_start) / 7;

          -- If fewer weeks have elapsed than the requested frequency, skip this week
          IF v_weeks_diff < v_vendor.frequency_weeks THEN
            CONTINUE;
          END IF;
        END IF;
      END IF;
    END IF;

    -- 3. Retrieve primary vendor contact
    SELECT id INTO v_contact_id
    FROM public.vendor_contacts
    WHERE vendor_id = v_vendor.id AND is_deleted = FALSE
    ORDER BY is_default DESC, sort_order DESC
    LIMIT 1;

    -- 4. Generate random document number and unique order ID
    v_new_doc := 'DOC-' || (FLOOR(100000 + random() * 900000)::INT)::TEXT;
    v_new_order_id := 'ord_' || SUBSTR(MD5(random()::TEXT), 1, 10) || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;

    -- 5. Insert scheduled order (created_by = NULL and operator_id = NULL)
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
      is_deleted
    ) VALUES (
      v_new_order_id,
      v_order_timestamp,
      v_new_doc,
      v_vendor.id,
      v_vendor.warehouse_id,
      v_contact_id,
      NULL,
      NULL,
      NULL,
      COALESCE(v_vendor.tanks_to_leave, 0),
      COALESCE(v_vendor.tanks_to_bring, 0),
      'registered',
      jsonb_build_array(jsonb_build_object(
        'id', 'n_' || SUBSTR(MD5(random()::TEXT), 1, 8),
        'comment', 'გეგმიური შეკვეთა (' || v_weekday_ka || ', სიხშირე: ' || COALESCE(v_vendor.frequency_weeks, 1) || ' კვ.)',
        'created_at', NOW()
      )),
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
  END LOOP;

  RETURN jsonb_build_object(
    'target_date', p_target_date,
    'dow', v_target_dow,
    'weekday', v_weekday_ka,
    'created_count', v_created_count,
    'orders', v_details
  );
END;
$$;

-- 5. Schedule daily execution at 6:00 AM Tbilisi time (UTC+4 = 02:00 AM UTC)
-- Cron expression: minute (0) hour (2) day-of-month (*) month (*) day-of-week (*)
SELECT cron.schedule(
  'generate-scheduled-orders-6am-tbilisi',
  '0 2 * * *',
  'SELECT public.generate_scheduled_orders()'
);
