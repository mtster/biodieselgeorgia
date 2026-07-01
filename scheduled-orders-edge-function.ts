import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight inspection standard hook
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Retrieve environment parameters safe keys
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing backend configuration variables. Please set SERVICE_ROLE_KEY in Secrets Vault." }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Initialize elevated Admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })

    // Secure verification: Ensure it is called either via internal pg_cron cron job 
    // or by an authorized admin user.
    const authHeader = req.headers.get('Authorization')
    let isAuthorized = false

    if (authHeader) {
      if (authHeader.includes(supabaseServiceKey)) {
        isAuthorized = true
      } else if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
        if (!authErr && user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          if (profile && profile.role === 'admin') {
            isAuthorized = true
          }
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // Determine current time in Georgia/Tbilisi (UTC+4) and calculate tomorrow
    const options = { 
      timeZone: 'Asia/Tbilisi', 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric', 
      hour: 'numeric', 
      minute: 'numeric', 
      second: 'numeric', 
      hour12: false 
    } as const

    const formatter = new Intl.DateTimeFormat('en-US', options)
    const parts = formatter.formatToParts(new Date())

    const yearPart = parts.find(p => p.type === 'year')?.value
    const monthPart = parts.find(p => p.type === 'month')?.value
    const dayPart = parts.find(p => p.type === 'day')?.value

    if (!yearPart || !monthPart || !dayPart) {
      throw new Error("Could not parse Tbilisi time parts")
    }

    // Base date at 12:00:00 (Noon) in Tbilisi time to avoid DST boundary bugs
    const tbilisiDate = new Date(parseInt(yearPart), parseInt(monthPart) - 1, parseInt(dayPart), 12, 0, 0)
    
    // Add 1 day to target tomorrow
    const tomorrowDate = new Date(tbilisiDate)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)

    const tomorrowDayIndex = tomorrowDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    const weekdaysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const targetWeekday = weekdaysMap[tomorrowDayIndex]

    // Fetch active vendors scheduled for tomorrow
    const { data: vendors, error: selectError } = await supabase
      .from('vendors')
      .select('id, company_name, trade_name, warehouse_id')
      .eq('is_deleted', false)
      .eq('is_planned', true)
      .eq('planned_weekday', targetWeekday)

    if (selectError) {
      return new Response(JSON.stringify({ error: `Failed to query scheduled vendors: ${selectError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (!vendors || vendors.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `No scheduled suppliers found for target weekday: ${targetWeekday} (tomorrow).`,
        weekdayChecked: targetWeekday,
        ordersCreated: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const BATCH_SIZE = 100
    const insertedOrders = []

    // Batch insert orders to comply with Supabase limits and optimize compute
    for (let i = 0; i < vendors.length; i += BATCH_SIZE) {
      const batchVendors = vendors.slice(i, i + BATCH_SIZE)
      const batchOrders = batchVendors.map(vendor => {
        const orderId = 'ord_' + crypto.randomUUID().replace(/-/g, '').substring(0, 12)
        const randomSuffix = Math.floor(100000 + Math.random() * 900000)
        const docNumber = `AUTO-${tomorrowDate.toISOString().split('T')[0].replace(/-/g, '')}-${randomSuffix}`
        
        return {
          id: orderId,
          order_date: tomorrowDate.toISOString(),
          doc_number: docNumber,
          vendor_id: vendor.id,
          warehouse_id: vendor.warehouse_id || null,
          qty_requested: 50,
          tanks_to_leave: 1,
          tanks_to_bring: 1,
          status: 'registered',
          note: `Automated scheduled order for ${vendor.trade_name || vendor.company_name}`
        }
      })

      const { data, error: insertError } = await supabase
        .from('orders')
        .insert(batchOrders)
        .select('id, doc_number')

      if (insertError) {
        return new Response(JSON.stringify({ error: `Failed to batch insert orders: ${insertError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
      
      if (data) {
        insertedOrders.push(...data)
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully generated automated orders for ${targetWeekday}.`,
      weekdayChecked: targetWeekday,
      ordersCreated: insertedOrders.length,
      orders: insertedOrders
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
