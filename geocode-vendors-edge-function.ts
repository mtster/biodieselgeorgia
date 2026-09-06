import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

/**
 * Supabase Edge Function: geocode-vendors-edge-function
 * 
 * Converts raw vendor addresses to geographic coordinates (latitude, longitude)
 * using Geoapify Geocoding API with rate-limiting and free-tier boundary checks.
 * 
 * Query optimization:
 * - Selects vendors where latitude is NULL and is_deleted = false
 * - Suffixes "Tbilisi, Georgia" for Tbilisi vendors to avoid geographic ambiguity
 * - Rate-limits to 4-5 requests/sec to strictly respect Geoapify's free tier
 * - Keeps wall-clock execution well below Supabase's 150s limit via batching
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Load environment secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    const geoapifyKey = Deno.env.get('GEOAPIFY_API_KEY') ?? ""

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration. Set SUPABASE_URL and SERVICE_ROLE_KEY." }), 
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!geoapifyKey) {
      return new Response(
        JSON.stringify({ error: "Missing GEOAPIFY_API_KEY in Edge Function secrets." }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 3. Initialize Supabase Admin Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })

    // 4. Authorization check
    const authHeader = req.headers.get('Authorization') || ''
    const apiKeyHeader = req.headers.get('apikey') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    let isAuthorized = false

    if (authHeader) {
      if (supabaseServiceKey && authHeader.includes(supabaseServiceKey)) {
        isAuthorized = true
      } else if (anonKey && (authHeader.includes(anonKey) || apiKeyHeader === anonKey)) {
        isAuthorized = true
      } else if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]
        if (anonKey && token === anonKey) {
          isAuthorized = true
        } else {
          const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
          if (!authErr && user) {
            isAuthorized = true
          }
        }
      }
    } else if (apiKeyHeader && anonKey && apiKeyHeader === anonKey) {
      isAuthorized = true
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // 5. Parse request parameters (batch size, optional specific vendor IDs)
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const batchSize = Math.min(Math.max(Number(body.batch_size) || 30, 1), 100)
    const specificVendorIds: string[] | null = Array.isArray(body.vendor_ids) ? body.vendor_ids : null

    // 6. Query total count of remaining ungeocoded vendors
    const { count: totalUngeocoded } = await supabase
      .from('vendors')
      .select('id', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .is('latitude', null)

    // 7. Fetch next chunk of vendors to geocode
    let vendorQuery = supabase
      .from('vendors')
      .select('id, trade_name, company_name, address, city, district')
      .eq('is_deleted', false)
      .is('latitude', null)

    if (specificVendorIds && specificVendorIds.length > 0) {
      vendorQuery = vendorQuery.in('id', specificVendorIds)
    }

    const { data: vendors, error: queryErr } = await vendorQuery.limit(batchSize)

    if (queryErr) {
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (!vendors || vendors.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        updated: 0,
        remaining: 0,
        has_more: false,
        message: "ყველა მომწოდებლის გეოლოკაცია უკვე განსაზღვრულია."
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // 8. Process geocoding with Geoapify
    const results: any[] = []
    let updatedCount = 0

    for (const vendor of vendors) {
      const rawAddress = (vendor.address || '').trim()
      if (!rawAddress) {
        results.push({ id: vendor.id, name: vendor.trade_name, success: false, error: "Empty address" })
        continue
      }

      // Geo-disambiguation: Append "Tbilisi, Georgia" if city is Tbilisi or unspecified
      const cityStr = (vendor.city || '').toLowerCase()
      const isTbilisi = !vendor.city || cityStr.includes('თბილის') || cityStr.includes('tbilisi')
      let queryText = rawAddress
      if (isTbilisi) {
        queryText = `${rawAddress}, Tbilisi, Georgia`
      } else if (vendor.city) {
        queryText = `${rawAddress}, ${vendor.city}, Georgia`
      } else {
        queryText = `${rawAddress}, Georgia`
      }

      try {
        const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(queryText)}&apiKey=${geoapifyKey}&limit=1&format=json`
        const geoRes = await fetch(geoUrl, {
          headers: {
            'Referer': 'https://biodieselgeorgia.vercel.app/',
            'Origin': 'https://biodieselgeorgia.vercel.app',
            'Accept': 'application/json'
          }
        })
        
        if (!geoRes.ok) {
          const errBody = await geoRes.text().catch(() => '')
          const shortErr = errBody.slice(0, 150)
          results.push({ id: vendor.id, name: vendor.trade_name, success: false, error: `Geoapify HTTP ${geoRes.status}: ${shortErr}` })
          // If auth or domain restriction failed, abort batch to prevent hammering Geoapify
          if (geoRes.status === 401 || geoRes.status === 403) {
            break
          }
          continue
        }

        const geoJson = await geoRes.json()
        if (geoJson.results && geoJson.results.length > 0) {
          const lat = Number(geoJson.results[0].lat)
          const lon = Number(geoJson.results[0].lon)

          // Persist coordinates to database
          const { error: updErr } = await supabase
            .from('vendors')
            .update({ latitude: lat, longitude: lon })
            .eq('id', vendor.id)

          if (!updErr) {
            updatedCount++
            results.push({ id: vendor.id, name: vendor.trade_name, lat, lon, success: true })
          } else {
            results.push({ id: vendor.id, name: vendor.trade_name, success: false, error: updErr.message })
          }
        } else {
          results.push({ id: vendor.id, name: vendor.trade_name, success: false, error: "Coordinates not found" })
        }

        // Rate limit pause: ~220ms delay guarantees <= 4.5 requests/second (safe for free tier)
        await new Promise(res => setTimeout(res, 220))
      } catch (err: any) {
        results.push({ id: vendor.id, name: vendor.trade_name, success: false, error: err.message })
      }
    }

    const remainingCount = Math.max((totalUngeocoded || 0) - updatedCount, 0)

    return new Response(JSON.stringify({
      success: true,
      processed: vendors.length,
      updated: updatedCount,
      remaining: remainingCount,
      has_more: updatedCount > 0 && remainingCount > 0,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (globalErr: any) {
    return new Response(JSON.stringify({ error: globalErr.message || "Internal function error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
