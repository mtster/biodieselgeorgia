import { supabaseAdmin, isSupabaseConfigured } from "../config";

interface DateParts {
  year: number;
  month: number;
  day: number;
  weekday: string;
  dateStr: string;
  targetDate: Date;
}

export function getTbilisiDateParts(date = new Date()): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
  const weekday = (parts.find(p => p.type === 'weekday')?.value || '').toLowerCase(); // monday, tuesday, etc.
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;

  // Construct target Date in Tbilisi timezone at 09:00:00 AM (UTC+4 -> 05:00:00 UTC)
  const targetDate = new Date(`${dateStr}T09:00:00+04:00`);

  return { year, month, day, weekday, dateStr, targetDate };
}

const GEORGIAN_WEEKDAY_NAMES: Record<string, string> = {
  monday: 'ორშაბათი',
  tuesday: 'სამშაბათი',
  wednesday: 'ოთხშაბათი',
  thursday: 'ხუთშაბათი',
  friday: 'პარასკევი',
  saturday: 'შაბათი',
  sunday: 'კვირა'
};

export async function generatePlannedOrders(options?: {
  targetDates?: Date[];
  vendorId?: string;
}): Promise<{
  success: boolean;
  createdCount: number;
  orders: any[];
  details: string[];
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return {
      success: false,
      createdCount: 0,
      orders: [],
      details: [],
      error: "Supabase configuration is not active on server."
    };
  }

  try {
    // Target date defaults to Today in Tbilisi timezone
    const now = new Date();
    const datesToProcess = options?.targetDates && options.targetDates.length > 0 
      ? options.targetDates 
      : [now];

    // Fetch active planned vendors
    let vendorQuery = supabaseAdmin
      .from('vendors')
      .select('id, trade_name, company_name, warehouse_id, is_planned, planned_weekday, frequency_weeks, tanks_to_bring, tanks_to_leave, operator_id, manager_id')
      .eq('is_deleted', false)
      .eq('is_planned', true);

    if (options?.vendorId) {
      vendorQuery = vendorQuery.eq('id', options.vendorId);
    }

    const { data: vendors, error: vendorError } = await vendorQuery;
    if (vendorError) {
      console.error('Error querying planned vendors:', vendorError);
      return { success: false, createdCount: 0, orders: [], details: [], error: vendorError.message };
    }

    if (!vendors || vendors.length === 0) {
      return {
        success: true,
        createdCount: 0,
        orders: [],
        details: ['No active planned vendors found.']
      };
    }

    const vendorIds = vendors.map(v => v.id);

    // Fetch default/primary contacts for these vendors
    const { data: contacts } = await supabaseAdmin
      .from('vendor_contacts')
      .select('id, vendor_id, is_default, sort_order')
      .in('vendor_id', vendorIds)
      .eq('is_deleted', false)
      .order('sort_order', { ascending: false });

    const primaryContactMap: Record<string, string> = {};
    if (contacts && contacts.length > 0) {
      for (const c of contacts) {
        if (!primaryContactMap[c.vendor_id] || c.is_default) {
          primaryContactMap[c.vendor_id] = c.id;
        }
      }
    }

    const createdOrders: any[] = [];
    const executionDetails: string[] = [];

    // Process each target date
    for (const d of datesToProcess) {
      const { weekday, dateStr, targetDate } = getTbilisiDateParts(d);
      const weekdayKa = GEORGIAN_WEEKDAY_NAMES[weekday] || weekday;

      const matchingVendors = vendors.filter(v => (v.planned_weekday || '').toLowerCase() === weekday);
      if (matchingVendors.length === 0) {
        continue;
      }

      const dayStartIso = `${dateStr}T00:00:00+04:00`;

      for (const vendor of matchingVendors) {
        // Frequency check if frequency_weeks > 1
        const freqWeeks = Math.max(1, Number(vendor.frequency_weeks) || 1);
        if (freqWeeks > 1) {
          const { data: priorOrders } = await supabaseAdmin
            .from('orders')
            .select('order_date')
            .eq('vendor_id', vendor.id)
            .eq('is_deleted', false)
            .lt('order_date', dayStartIso)
            .order('order_date', { ascending: false })
            .limit(1);

          if (priorOrders && priorOrders.length > 0 && priorOrders[0].order_date) {
            const priorDate = new Date(priorOrders[0].order_date);
            const diffDays = Math.floor((targetDate.getTime() - priorDate.getTime()) / (1000 * 60 * 60 * 24));
            const minDaysRequired = (freqWeeks * 7) - 3;
            if (diffDays < minDaysRequired) {
              executionDetails.push(`Vendor ${vendor.trade_name || vendor.company_name} is scheduled every ${freqWeeks} weeks; last order was ${diffDays} days ago (< ${minDaysRequired} days). Skipped.`);
              continue;
            }
          }
        }

        // Create scheduled order (no duplicate check required as requested)
        const randomSuffix = Math.floor(100000 + Math.random() * 900000);
        const docNumber = `DOC-${randomSuffix}`;
        const orderId = 'ord_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);

        const newOrder = {
          id: orderId,
          order_date: targetDate.toISOString(),
          doc_number: docNumber,
          vendor_id: vendor.id,
          warehouse_id: vendor.warehouse_id || null,
          contact_id: primaryContactMap[vendor.id] || null,
          operator_id: vendor.operator_id || null,
          created_by: vendor.operator_id || vendor.manager_id || null,
          qty_requested: null,
          tanks_to_leave: Number(vendor.tanks_to_leave) || 0,
          tanks_to_bring: Number(vendor.tanks_to_bring) || 0,
          status: 'registered',
          notes: [
            {
              id: 'n_' + Math.random().toString(36).substring(2, 9),
              comment: `გეგმიური შეკვეთა (${weekdayKa}, სიხშირე: ${freqWeeks} კვ.)`,
              created_at: new Date().toISOString()
            }
          ],
          is_deleted: false
        };

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('orders')
          .insert(newOrder)
          .select('id, doc_number, order_date, vendor_id, tanks_to_bring, tanks_to_leave')
          .single();

        if (insertErr) {
          console.error(`Failed to insert planned order for vendor ${vendor.id}:`, insertErr);
          executionDetails.push(`Failed to insert order for ${vendor.trade_name || vendor.company_name}: ${insertErr.message}`);
        } else if (inserted) {
          createdOrders.push(inserted);
          executionDetails.push(`Created order ${inserted.doc_number} for ${vendor.trade_name || vendor.company_name} on ${dateStr} (წამოღება: ${vendor.tanks_to_bring}, დატოვება: ${vendor.tanks_to_leave}).`);

          // Record change in history table
          try {
            await supabaseAdmin.from('change_history').insert({
              id: 'hist_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36),
              date_time: new Date().toISOString(),
              employee_name: 'სისტემა (გეგმიური)',
              operation: 'ავტომატური შეკვეთა',
              field_name: 'დოკუმენტის #',
              old_value: '',
              new_value: `${inserted.doc_number} (${vendor.trade_name || vendor.company_name})`
            });
          } catch (hErr) {
            console.warn('Could not record change_history for planned order:', hErr);
          }
        }
      }
    }

    return {
      success: true,
      createdCount: createdOrders.length,
      orders: createdOrders,
      details: executionDetails
    };
  } catch (err: any) {
    console.error('Unhandled error in generatePlannedOrders:', err);
    return {
      success: false,
      createdCount: 0,
      orders: [],
      details: [],
      error: err?.message || 'Internal server error'
    };
  }
}

// Background scheduler runner
let schedulerTimer: NodeJS.Timeout | null = null;
let lastExecutionDateKey = '';

export function startPlannedOrdersScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  // Check every 60 seconds if it's 6:00 AM in Tbilisi time
  schedulerTimer = setInterval(async () => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tbilisi',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(new Date());

      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;
      const todayKey = `${year}-${month}-${day}`;

      // Run daily at 06:00 AM Tbilisi time
      if (hour === 6 && minute === 0 && lastExecutionDateKey !== todayKey) {
        lastExecutionDateKey = todayKey;
        console.log(`⏰ [06:00 AM Tbilisi] Triggering daily scheduled orders generation for ${todayKey}...`);
        const res = await generatePlannedOrders();
        console.log(`✅ [06:00 AM Tbilisi] Generated ${res.createdCount} planned orders:`, res.details);
      }
    } catch (e) {
      console.error('Scheduled orders 6am check error:', e);
    }
  }, 60 * 1000);

  console.log('🚀 Planned orders background scheduler initialized (checks for 6:00 AM Tbilisi time).');
}
