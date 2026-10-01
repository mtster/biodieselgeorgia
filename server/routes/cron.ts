import express from "express";
import { generatePlannedOrders } from "../services/plannedOrdersService";

const router = express.Router();

// General endpoint for generating planned orders (callable from client app, cron, or background tasks)
router.all(["/api/cron/scheduled-orders", "/api/orders/generate-planned"], async (req, res) => {
  try {
    const vendorId = (req.query.vendor_id as string) || (req.body?.vendor_id as string);
    const target = (req.query.target as string) || (req.body?.target as string); // 'today', 'tomorrow', 'both'

    let targetDates: Date[] | undefined = undefined;
    if (target === 'today') {
      targetDates = [new Date()];
    } else if (target === 'tomorrow') {
      targetDates = [new Date(Date.now() + 24 * 60 * 60 * 1000)];
    } else {
      // Default: today and tomorrow
      targetDates = [new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000)];
    }

    const result = await generatePlannedOrders({
      vendorId: vendorId || undefined,
      targetDates
    });

    res.json(result);
  } catch (e: any) {
    console.error("Scheduled orders endpoint error:", e);
    res.status(500).json({ success: false, error: e.message || "Internal server error" });
  }
});

export default router;
