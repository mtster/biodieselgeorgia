import express from "express";
import { supabaseAdmin, isSupabaseConfigured } from "../config";

const router = express.Router();

// Overdue vendors report endpoint using direct comprehensive logic
router.get("/api/reports/overdue-vendors", async (req, res) => {
  try {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return res.status(500).json({ error: "Supabase service role is not configured" });
    }

    // Query active vendors with overdue_threshold_days and last_order_date
    const { data: vendors, error: vErr } = await supabaseAdmin
      .from("vendors")
      .select("id, id_code, company_name, trade_name, city, district, manager_id, is_active, overdue_threshold_days, last_order_date, created_at")
      .eq("is_deleted", false)
      .eq("is_active", true);

    if (vErr) {
      return res.status(500).json({ error: vErr.message });
    }

    const { data: orders, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("vendor_id, order_date")
      .eq("is_deleted", false)
      .eq("status", "completed")
      .order("order_date", { ascending: false });

    if (oErr) {
      return res.status(500).json({ error: oErr.message });
    }

    const latestOrderMap: Record<string, string> = {};
    for (const ord of orders || []) {
      if (ord.vendor_id && !latestOrderMap[ord.vendor_id] && ord.order_date) {
        latestOrderMap[ord.vendor_id] = ord.order_date;
      }
    }

    const now = new Date();
    const results = [];

    for (const v of vendors || []) {
      const orderDateFromList = latestOrderMap[v.id];
      const vendorLastOrderDate = v.last_order_date;
      let lastOrderDateStr: string | null = null;

      if (orderDateFromList && vendorLastOrderDate) {
        lastOrderDateStr = new Date(orderDateFromList) > new Date(vendorLastOrderDate) ? orderDateFromList : vendorLastOrderDate;
      } else {
        lastOrderDateStr = orderDateFromList || vendorLastOrderDate || null;
      }

      if (lastOrderDateStr) {
        const threshold = v.overdue_threshold_days;
        if (threshold !== null && threshold !== undefined && threshold > 0) {
          const diffDays = Math.floor((now.getTime() - new Date(lastOrderDateStr).getTime()) / (1000 * 60 * 60 * 24));
          const overdueDays = diffDays - threshold;
          if (overdueDays > 0) {
            results.push({
              ...v,
              status: 'Active',
              last_order_date: lastOrderDateStr,
              days_ago: diffDays,
              overdue_days: overdueDays
            });
          }
        }
      } else {
        // No orders placed: check if 30 days have passed since created_at
        const createdTime = v.created_at ? new Date(v.created_at).getTime() : now.getTime();
        const daysSinceCreation = Math.floor((now.getTime() - createdTime) / (1000 * 60 * 60 * 24));
        if (daysSinceCreation > 30) {
          const overdueDays = daysSinceCreation - 30;
          results.push({
            ...v,
            status: 'Active',
            last_order_date: null,
            days_ago: daysSinceCreation,
            overdue_days: overdueDays
          });
        }
      }
    }

    results.sort((a, b) => b.overdue_days - a.overdue_days);
    res.json({ success: true, data: results });
  } catch (err: any) {
    console.error("Overdue vendors error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
