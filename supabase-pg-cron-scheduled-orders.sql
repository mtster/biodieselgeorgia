-- ====================================================================
--  SUPABASE PG_CRON: AUTOMATED SCHEDULED ORDERS AT 6:00 AM TBILISI TIME
-- ====================================================================
--  Schedule: Runs every day at 6:00 AM Tbilisi time (02:00 AM UTC).
--  Function: Checks all active planned vendors (is_planned = TRUE)
--            whose scheduled weekday matches the current day in Tbilisi.
--            Applies the multi-week frequency (frequency_weeks).
--            Creates orders with the exact configured tanks_to_bring
--            and tanks_to_leave.
-- ====================================================================

-- 1. Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the scheduled order generation database function
CREATE OR REPLACE FUNCTION public.generate_scheduled_orders(
  p_target_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tbilisi')::date
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_day_of_week INT;
  v_weekday_str TEXT;
  v_weekday_ka TEXT;
  v_vendor RECORD;
  v_contact_id TEXT;
  v_new_doc TEXT;
  v_new_order_id TEXT;
  v_created_count INT := 0;
  v_details JSONB := '[]'::JSONB;
  v_prev_order_date TIMESTAMPTZ;
  v_days_since_prev INT;
  v_min_days INT;
  v_order_timestamp TIMESTAMPTZ;
BEGIN
  -- Determine weekday (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_target_date)::INT;
  CASE v_day_of_week
    WHEN 0 THEN v_weekday_str := 'sunday';    v_weekday_ka := 'კვირა';
    WHEN 1 THEN v_weekday_str := 'monday';    v_weekday_ka := 'ორშაბათი';
    WHEN 2 THEN v_weekday_str := 'tuesday';   v_weekday_ka := 'სამშაბათი';
    WHEN 3 THEN v_weekday_str := 'wednesday'; v_weekday_ka := 'ოთხშაბათი';
    WHEN 4 THEN v_weekday_str := 'thursday';  v_weekday_ka := 'ხუთშაბათი';
    WHEN 5 THEN v_weekday_str := 'friday';    v_weekday_ka := 'პარასკევი';
    WHEN 6 THEN v_weekday_str := 'saturday';  v_weekday_ka := 'შაბათი';
  END CASE;

  -- Timestamp of order: 09:00:00 AM Tbilisi time (+04:00) on the target date
  v_order_timestamp := (p_target_date || ' 09:00:00+04')::TIMESTAMPTZ;

  FOR v_vendor IN 
    SELECT 
      id, 
      trade_name, 
      company_name, 
      warehouse_id, 
      frequency_weeks, 
      tanks_to_bring, 
      tanks_to_leave, 
      operator_id, 
      manager_id
    FROM public.vendors
    WHERE is_deleted = FALSE 
      AND is_planned = TRUE 
      AND LOWER(planned_weekday) = v_weekday_str
  LOOP
    -- Frequency check (if set to every 2 or 3 weeks)
    IF COALESCE(v_vendor.frequency_weeks, 1) > 1 THEN
      SELECT MAX(order_date) INTO v_prev_order_date
      FROM public.orders
      WHERE vendor_id = v_vendor.id
        AND is_deleted = FALSE
        AND (order_date AT TIME ZONE 'Asia/Tbilisi')::date < p_target_date;

      IF v_prev_order_date IS NOT NULL THEN
        v_days_since_prev := p_target_date - (v_prev_order_date AT TIME ZONE 'Asia/Tbilisi')::date;
        v_min_days := (v_vendor.frequency_weeks * 7) - 3;
        -- If previous order was too recent, skip this execution cycle
        IF v_days_since_prev < v_min_days THEN
          CONTINUE;
        END IF;
      END IF;
    END IF;

    -- Prevent duplicate order for this vendor on target date
    IF EXISTS (
      SELECT 1 FROM public.orders
      WHERE vendor_id = v_vendor.id
        AND is_deleted = FALSE
        AND (order_date AT TIME ZONE 'Asia/Tbilisi')::date = p_target_date
    ) THEN
      CONTINUE;
    END IF;

    -- Retrieve primary vendor contact
    SELECT id INTO v_contact_id
    FROM public.vendor_contacts
    WHERE vendor_id = v_vendor.id AND is_deleted = FALSE
    ORDER BY is_default DESC, sort_order DESC
    LIMIT 1;

    -- Generate random document number and unique order ID
    v_new_doc := 'DOC-' || (FLOOR(100000 + random() * 900000)::INT)::TEXT;
    v_new_order_id := 'ord_' || SUBSTR(MD5(random()::TEXT), 1, 10) || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;

    -- Insert scheduled order (with created_by = NULL and operator_id = NULL)
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
    'weekday', v_weekday_str,
    'created_count', v_created_count,
    'orders', v_details
  );
END;
$$;

-- 3. Unschedule previous job if it exists to prevent duplicate schedules
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-scheduled-orders-6am-tbilisi') THEN
    PERFORM cron.unschedule('generate-scheduled-orders-6am-tbilisi');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if cron.job is not yet accessible
  NULL;
END $$;

-- 4. Schedule daily execution at 6:00 AM Tbilisi time (UTC+4 = 02:00 AM UTC)
-- Cron syntax: minute (0) hour (2 = 2am UTC / 6am Tbilisi) day-of-month (*) month (*) day-of-week (*)
SELECT cron.schedule(
  'generate-scheduled-orders-6am-tbilisi',
  '0 2 * * *',
  'SELECT public.generate_scheduled_orders()'
);
