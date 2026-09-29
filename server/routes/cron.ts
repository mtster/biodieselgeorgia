import express from "express";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAdmin, isSupabaseConfigured } from "../config";

const router = express.Router();

// Endpoint to run / test scheduled order generation
router.all("/api/cron/scheduled-orders", async (req, res) => {
  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return res.status(500).json({ error: "Supabase service role key is not configured on the server." });
    }

    // Check authorization (Bearer token or SERVICE_ROLE_KEY or internal header)
    const authHeader = req.headers.authorization;
    const cronSecret = req.headers['x-cron-secret'];
    let isAuthorized = false;

    if (process.env.SERVICE_ROLE_KEY && authHeader?.includes(process.env.SERVICE_ROLE_KEY)) {
      isAuthorized = true;
    } else if (cronSecret && cronSecret === process.env.SERVICE_ROLE_KEY) {
      isAuthorized = true;
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (!authErr && user) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        if (profile && (profile.role === "admin" || profile.role === "purchasing_head")) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    // Determine tomorrow in Tbilisi time (UTC+4)
    const options = {
      timeZone: 'Asia/Tbilisi',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    } as const;

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(new Date());

    const yearPart = parts.find(p => p.type === 'year')?.value;
    const monthPart = parts.find(p => p.type === 'month')?.value;
    const dayPart = parts.find(p => p.type === 'day')?.value;

    if (!yearPart || !monthPart || !dayPart) {
      return res.status(500).json({ error: "Could not parse Tbilisi time" });
    }

    const tbilisiDate = new Date(parseInt(yearPart), parseInt(monthPart) - 1, parseInt(dayPart), 12, 0, 0);
    const tomorrowDate = new Date(tbilisiDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    const tomorrowDayIndex = tomorrowDate.getDay();
    const weekdaysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetWeekday = weekdaysMap[tomorrowDayIndex];

    const { data: vendors, error: selectError } = await supabaseAdmin
      .from('vendors')
      .select('id, company_name, trade_name, warehouse_id, frequency_weeks, tanks_to_bring, tanks_to_leave')
      .eq('is_deleted', false)
      .eq('is_planned', true)
      .eq('planned_weekday', targetWeekday);

    if (selectError) {
      return res.status(500).json({ error: selectError.message });
    }

    if (!vendors || vendors.length === 0) {
      return res.json({
        success: true,
        message: `No scheduled suppliers found for target weekday: ${targetWeekday} (tomorrow).`,
        weekdayChecked: targetWeekday,
        ordersCreated: 0
      });
    }

    const vendorIds = vendors.map(v => v.id);

    // Fetch contacts to get main contact (is_default)
    const { data: contacts } = await supabaseAdmin
      .from('vendor_contacts')
      .select('id, vendor_id, is_default, sort_order')
      .in('vendor_id', vendorIds)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: false });

    const mainContactMap: Record<string, string> = {};
    if (contacts && contacts.length > 0) {
      for (const c of contacts) {
        if (!mainContactMap[c.vendor_id] || c.is_default) {
          mainContactMap[c.vendor_id] = c.id;
        }
      }
    }

    // Fetch existing orders to check frequency_weeks and prevent duplicates
    const { data: existingOrders } = await supabaseAdmin
      .from('orders')
      .select('id, vendor_id, order_date')
      .in('vendor_id', vendorIds)
      .eq('is_deleted', false)
      .order('order_date', { ascending: false });

    const latestOrderMap: Record<string, Date> = {};
    const existingTomorrowOrders = new Set<string>();
    const tomorrowYMD = tomorrowDate.toISOString().split('T')[0];

    if (existingOrders && existingOrders.length > 0) {
      for (const ord of existingOrders) {
        if (!ord.order_date) continue;
        const ordDateStr = ord.order_date.split('T')[0];
        if (ordDateStr === tomorrowYMD) {
          existingTomorrowOrders.add(ord.vendor_id);
        }
        if (!latestOrderMap[ord.vendor_id]) {
          latestOrderMap[ord.vendor_id] = new Date(ord.order_date);
        }
      }
    }

    const eligibleVendors = vendors.filter(vendor => {
      if (existingTomorrowOrders.has(vendor.id)) {
        return false;
      }

      const freq = Math.max(1, Number(vendor.frequency_weeks) || 1);
      const lastOrderDate = latestOrderMap[vendor.id];

      if (!lastOrderDate) return true;
      if (freq <= 1) return true;

      const diffMs = tomorrowDate.getTime() - lastOrderDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const minDaysRequired = (freq * 7) - 3;
      return diffDays >= minDaysRequired;
    });

    if (eligibleVendors.length === 0) {
      return res.json({
        success: true,
        message: `All scheduled suppliers for ${targetWeekday} were already created or not due based on their weekly frequency.`,
        weekdayChecked: targetWeekday,
        ordersCreated: 0
      });
    }

    const insertedOrders = [];
    const BATCH_SIZE = 100;
    for (let i = 0; i < eligibleVendors.length; i += BATCH_SIZE) {
      const batchVendors = eligibleVendors.slice(i, i + BATCH_SIZE);
      const batchOrders = batchVendors.map(vendor => {
        const orderId = 'ord_' + Math.random().toString(36).substring(2, 14);
        const randomSuffix = Math.floor(100000 + Math.random() * 900000);
        const docNumber = `AUTO-${tomorrowDate.toISOString().split('T')[0].replace(/-/g, '')}-${randomSuffix}`;

        return {
          id: orderId,
          order_date: tomorrowDate.toISOString(),
          doc_number: docNumber,
          vendor_id: vendor.id,
          warehouse_id: vendor.warehouse_id || null,
          contact_id: mainContactMap[vendor.id] || null,
          qty_requested: 0,
          tanks_to_leave: Number(vendor.tanks_to_leave) || 0,
          tanks_to_bring: Number(vendor.tanks_to_bring) || 0,
          status: 'registered',
          note: `Automated scheduled order for ${vendor.trade_name || vendor.company_name}`
        };
      });

      const { data, error: insertError } = await supabaseAdmin
        .from('orders')
        .insert(batchOrders)
        .select('id, doc_number');

      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }
      if (data) {
        insertedOrders.push(...data);
      }
    }

    res.json({
      success: true,
      message: `Successfully generated automated orders for ${targetWeekday}.`,
      weekdayChecked: targetWeekday,
      ordersCreated: insertedOrders.length,
      orders: insertedOrders
    });
  } catch (e: any) {
    console.error("Scheduled orders error:", e);
    res.status(500).json({ error: e.message || "Internal server error" });
  }
});

export default router;
