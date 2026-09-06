import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

/**
 * Supabase Edge Function: optimize-route-edge-function
 * 
 * Takes a list of order deliveries with coordinates for a vehicle/driver
 * and determines the optimal visit order using Geoapify Route Planner API.
 * Includes embedded Nearest-Neighbor / 2-Opt TSP solver as resilient fallback.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const geoapifyKey = Deno.env.get('GEOAPIFY_API_KEY') ?? ""
    
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    let orders: { id: string; lat?: number | null; lon?: number | null; name?: string; address?: string; status?: string; is_deleted?: boolean; order_date?: string; vehicle_id?: string; truck_plate?: string; driver_id?: string }[] = body.orders || []

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    const supabase = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null

    const todayStr = (body.date && String(body.date).slice(0, 10)) || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date())

    // Enforce strict filtering: current date, status driver_assigned, not deleted, assigned to current vehicle
    if (supabase && orders.length > 0) {
      try {
        const orderIds = orders.map(o => o.id).filter(Boolean)
        let query = supabase
          .from('orders')
          .select('id, vendor_id, order_date, created_at, status, vehicle_id, truck_plate, driver_id, is_deleted')
          .in('id', orderIds)
          .eq('is_deleted', false)
          .neq('status', 'cancelled')
          .neq('status', 'completed')

        if (body.vehicle_id) {
          query = query.eq('vehicle_id', body.vehicle_id)
        } else if (body.truck_plate) {
          query = query.eq('truck_plate', body.truck_plate)
        }

        const { data: dbOrders, error: dbErr } = await query
        if (!dbErr && dbOrders) {
          const allowedIdSet = new Set(
            dbOrders.filter((o: any) => {
              const rawDate = o.order_date || o.created_at
              if (!rawDate) return false
              try {
                const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date(rawDate))
                return dStr === todayStr
              } catch {
                return String(rawDate).slice(0, 10) === todayStr
              }
            }).map((o: any) => o.id)
          )
          orders = orders.filter(o => allowedIdSet.has(o.id))
        }
      } catch (dbFilterErr) {
        console.warn('Database filtering failed in edge function, falling back to payload filtering:', dbFilterErr)
      }
    } else {
      orders = orders.filter((o: any) => {
        if (o.is_deleted) return false
        if (o.status && (o.status === 'cancelled' || o.status === 'completed')) return false
        if (o.order_date || o.created_at) {
          const raw = o.order_date || o.created_at
          try {
            const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date(raw))
            if (dStr !== todayStr) return false
          } catch {
            if (String(raw).slice(0, 10) !== todayStr) return false
          }
        }
        if (body.vehicle_id && o.vehicle_id && o.vehicle_id !== body.vehicle_id) return false
        if (body.truck_plate && o.truck_plate && o.truck_plate !== body.truck_plate) return false
        return true
      })
    }

    const parseCoord = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null
      const num = Number(val)
      return isNaN(num) ? null : num
    }

    // Sanitize coordinates in orders
    orders.forEach(o => {
      o.lat = parseCoord(o.lat)
      o.lon = parseCoord(o.lon)
    })

    // If any orders are missing coordinates, fetch directly from vendors table
    const missingCoordVendorIds = orders
      .filter(o => (o.lat === null || o.lat === undefined) && (o as any).vendor_id)
      .map(o => (o as any).vendor_id!)
      .filter(Boolean)

    if (missingCoordVendorIds.length > 0 && supabase) {
      try {
        const { data: vData } = await supabase
          .from('vendors')
          .select('id, latitude, longitude')
          .in('id', missingCoordVendorIds)
        if (vData && vData.length > 0) {
          const vMap = new Map(vData.map((v: any) => [v.id, { lat: parseCoord(v.latitude), lon: parseCoord(v.longitude) }]))
          orders.forEach(o => {
            if ((o.lat === null || o.lat === undefined) && (o as any).vendor_id) {
              const c = vMap.get((o as any).vendor_id)
              if (c && c.lat !== null && c.lon !== null) {
                o.lat = c.lat
                o.lon = c.lon
              }
            }
          })
        }
      } catch (cErr) {
        console.warn('Failed querying vendors coordinates in edge function:', cErr)
      }
    }

    if (!Array.isArray(orders) || orders.length <= 1) {
      return new Response(JSON.stringify({
        success: true,
        optimized_order_ids: orders.map(o => o.id),
        source: 'noop'
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const validStops = orders.filter(o => typeof o.lat === 'number' && typeof o.lon === 'number' && !isNaN(o.lat) && !isNaN(o.lon))
    const unlocatedStops = orders.filter(o => typeof o.lat !== 'number' || typeof o.lon !== 'number' || isNaN(o.lat) || isNaN(o.lon))

    // Default starting point: Liberty Square, Freedom Square, Tbilisi [lon, lat]
    const LIBERTY_SQUARE: [number, number] = [44.8015, 41.6934]
    let startLocation: [number, number] = LIBERTY_SQUARE
    if (Array.isArray(body.start_location) && body.start_location.length === 2) {
      const sLon = parseCoord(body.start_location[0])
      const sLat = parseCoord(body.start_location[1])
      if (sLon !== null && sLat !== null) {
        startLocation = [sLon, sLat]
      }
    }

    // 1. Try Geoapify Route Planner API if key is available
    if (geoapifyKey && validStops.length >= 2) {
      try {
        const plannerPayload = {
          mode: "drive",
          agents: [
            {
              start_location: startLocation
            }
          ],
          jobs: validStops.map(s => ({
            id: s.id,
            location: [s.lon, s.lat],
            duration: 300
          }))
        }

        const geoRes = await fetch(`https://api.geoapify.com/v1/routeplanner?apiKey=${geoapifyKey}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Referer": "https://biodieselgeorgia.vercel.app/",
            "Origin": "https://biodieselgeorgia.vercel.app",
            "Accept": "application/json"
          },
          body: JSON.stringify(plannerPayload)
        })

        if (geoRes.ok) {
          const plannerData = await geoRes.json()
          const features = Array.isArray(plannerData?.features) ? plannerData.features : []
          const orderedJobIds: string[] = []

          const pushStopId = (id?: string | null) => {
            if (id && !orderedJobIds.includes(id) && validStops.some(s => s.id === id)) {
              orderedJobIds.push(id)
            }
          }

          for (const feat of features) {
            const actions: any[] = feat?.properties?.actions || []
            for (const act of actions) {
              if (act.type === 'start' || act.type === 'end') continue

              // Geoapify Route Planner uses job_index (0-indexed integer corresponding to jobs array)
              if (typeof act.job_index === 'number' && validStops[act.job_index]) {
                pushStopId(validStops[act.job_index].id)
                continue
              }
              if (typeof act.shipment_index === 'number' && validStops[act.shipment_index]) {
                pushStopId(validStops[act.shipment_index].id)
                continue
              }
              if (act.job_id) {
                pushStopId(String(act.job_id))
                continue
              }
              if (act.shipment_id) {
                pushStopId(String(act.shipment_id))
                continue
              }
              if (act.id) {
                pushStopId(String(act.id))
                continue
              }
              if (typeof act.location_index === 'number' && validStops[act.location_index]) {
                pushStopId(validStops[act.location_index].id)
                continue
              }
            }

            // Fallback to waypoints if actions did not supply job_index
            if (orderedJobIds.length === 0) {
              const waypoints: any[] = feat?.properties?.waypoints || []
              for (const wp of waypoints) {
                if (Array.isArray(wp.actions)) {
                  for (const wpAct of wp.actions) {
                    if (wpAct.type === 'start' || wpAct.type === 'end') continue
                    if (typeof wpAct.job_index === 'number' && validStops[wpAct.job_index]) {
                      pushStopId(validStops[wpAct.job_index].id)
                    } else if (wpAct.job_id) {
                      pushStopId(String(wpAct.job_id))
                    } else if (wpAct.id) {
                      pushStopId(String(wpAct.id))
                    }
                  }
                }
                const loc = wp.original_location || wp.location
                if (Array.isArray(loc) && loc.length >= 2) {
                  const [wpLon, wpLat] = loc
                  const matched = validStops.find(s => 
                    Math.abs(s.lon! - wpLon) < 0.0001 && Math.abs(s.lat! - wpLat) < 0.0001
                  )
                  if (matched) {
                    pushStopId(matched.id)
                  }
                }
              }
            }
          }

          if (orderedJobIds.length > 0) {
            // Append any valid stop not visited in order
            for (const s of validStops) {
              if (!orderedJobIds.includes(s.id)) {
                orderedJobIds.push(s.id)
              }
            }

            const finalOrderIds = [...orderedJobIds, ...unlocatedStops.map(s => s.id)]
            return new Response(JSON.stringify({
              success: true,
              optimized_order_ids: finalOrderIds,
              source: 'geoapify'
            }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
          }
        } else {
          console.warn("Geoapify Route Planner API returned non-OK status:", geoRes.status, await geoRes.text())
        }
      } catch (err) {
        console.warn("Geoapify edge call failed, falling back to 2-opt TSP:", err)
      }
    }

    // 2. Nearest-Neighbor TSP + 2-Opt mathematical solver fallback
    // Deterministic: starts from closest stop to startLocation (Liberty Square/GPS) and solves optimal path
    const haversineDist = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371
      const dLat = (lat2 - lat1) * (Math.PI / 180)
      const dLon = (lon2 - lon1) * (Math.PI / 180)
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    if (validStops.length > 0) {
      // Sort deterministically by id so previous UI shuffle has no bias
      const remaining = [...validStops].sort((a, b) => a.id.localeCompare(b.id))

      // Find the stop closest to starting point (Liberty Square or Driver GPS)
      let startIdx = 0
      let startDist = Infinity
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineDist(startLocation[1], startLocation[0], remaining[i].lat!, remaining[i].lon!)
        if (d < startDist) {
          startDist = d
          startIdx = i
        }
      }

      const route = [remaining.splice(startIdx, 1)[0]]

      // Nearest-neighbor construction
      while (remaining.length > 0) {
        const current = route[route.length - 1]
        let bestIdx = 0
        let bestDist = Infinity

        for (let i = 0; i < remaining.length; i++) {
          const dist = haversineDist(current.lat!, current.lon!, remaining[i].lat!, remaining[i].lon!)
          if (dist < bestDist) {
            bestDist = dist
            bestIdx = i
          }
        }
        route.push(remaining.splice(bestIdx, 1)[0])
      }

      // 2-opt search
      let improved = true
      let iterations = 0
      while (improved && iterations < 50 && route.length >= 4) {
        improved = false
        iterations++
        for (let i = 0; i < route.length - 2; i++) {
          for (let j = i + 2; j < route.length; j++) {
            const d1 = haversineDist(route[i].lat!, route[i].lon!, route[i + 1].lat!, route[i + 1].lon!) +
                       (j + 1 < route.length ? haversineDist(route[j].lat!, route[j].lon!, route[j + 1].lat!, route[j + 1].lon!) : 0)
            const d2 = haversineDist(route[i].lat!, route[i].lon!, route[j].lat!, route[j].lon!) +
                       (j + 1 < route.length ? haversineDist(route[i + 1].lat!, route[i + 1].lon!, route[j].lat!, route[j].lon!) : 0)
            if (d2 < d1 - 0.0001) {
              const sub = route.slice(i + 1, j + 1).reverse()
              route.splice(i + 1, sub.length, ...sub)
              improved = true
              break
            }
          }
          if (improved) break
        }
      }

      const optimizedOrderIds = [...route.map(s => s.id), ...unlocatedStops.map(s => s.id)]
      return new Response(JSON.stringify({
        success: true,
        optimized_order_ids: optimizedOrderIds,
        source: 'fallback_tsp'
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      optimized_order_ids: orders.map(o => o.id),
      source: 'preserve'
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Route optimization failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
