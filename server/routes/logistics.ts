import express from "express";
import { supabaseAdmin, isSupabaseConfigured } from "../config";

const router = express.Router();

// Bulk Geocoding of Vendors via Geoapify
router.post("/api/geocode-vendors", async (req, res) => {
  try {
    const geoapifyKey = process.env.GEOAPIFY_API_KEY || process.env.VITE_GEOAPIFY_API_KEY || "";
    const batchSize = Math.min(Math.max(Number(req.body.batch_size) || 25, 1), 100);
    const vendorIds = Array.isArray(req.body.vendor_ids) ? req.body.vendor_ids : null;

    if (!isSupabaseConfigured || !supabaseAdmin) {
      return res.status(400).json({ error: "Supabase configuration missing on server." });
    }

    // If GEOAPIFY_API_KEY is not in server env, try invoking Supabase Edge Function directly
    if (!geoapifyKey) {
      try {
        const { data, error: fnErr } = await supabaseAdmin.functions.invoke("geocode-vendors", {
          body: req.body
        });
        if (!fnErr && data) {
          return res.json(data);
        }
        if (fnErr) {
          console.warn("Supabase Edge Function geocode-vendors returned error:", fnErr);
        }
      } catch (e: any) {
        console.warn("Failed to proxy to geocode-vendors edge function:", e?.message);
      }

      return res.status(400).json({
        success: false,
        error: "GEOAPIFY_API_KEY გარემოს ცვლადი არ არის კონფიგურირებული სერვერზე.",
        has_more: false
      });
    }

    // Count remaining vendors without coordinates
    const { count: totalUngeocoded, error: countErr } = await supabaseAdmin
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("is_deleted", false)
      .is("latitude", null);

    if (countErr) {
      console.error("Error counting ungeocoded vendors:", countErr);
    }

    // Fetch batch of vendors needing geocoding
    let query = supabaseAdmin
      .from("vendors")
      .select("id, trade_name, company_name, address, city, district")
      .eq("is_deleted", false)
      .is("latitude", null);

    if (vendorIds && vendorIds.length > 0) {
      query = query.in("id", vendorIds);
    }

    const { data: vendors, error: fetchErr } = await query.limit(batchSize);

    if (fetchErr) {
      return res.status(500).json({ error: fetchErr.message });
    }

    if (!vendors || vendors.length === 0) {
      return res.json({
        success: true,
        processed: 0,
        updated: 0,
        remaining: 0,
        has_more: false,
        message: "ყველა მომწოდებელს უკვე მინიჭებული აქვს გეოლოკაციის კოორდინატები."
      });
    }

    const results: { id: string; name: string; address: string; lat?: number; lon?: number; success: boolean; error?: string }[] = [];
    let updatedCount = 0;

    for (const v of vendors) {
      const rawAddress = (v.address || "").trim();
      if (!rawAddress) {
        results.push({ id: v.id, name: v.trade_name || v.company_name, address: "", success: false, error: "მისამართი ცარიელია" });
        continue;
      }

      const cityStr = (v.city || "").toLowerCase();
      const isTbilisi = !v.city || cityStr.includes("თბილის") || cityStr.includes("tbilisi");
      let queryAddress = rawAddress;
      if (isTbilisi) {
        queryAddress = `${rawAddress}, Tbilisi, Georgia`;
      } else if (v.city) {
        queryAddress = `${rawAddress}, ${v.city}, Georgia`;
      } else {
        queryAddress = `${rawAddress}, Georgia`;
      }

      try {
        const geocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(queryAddress)}&apiKey=${geoapifyKey}&limit=1&format=json`;
        const response = await fetch(geocodeUrl, {
          headers: {
            "Referer": "https://biodieselgeorgia.vercel.app/",
            "Origin": "https://biodieselgeorgia.vercel.app",
            "Accept": "application/json"
          }
        });
        
        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          results.push({
            id: v.id,
            name: v.trade_name || v.company_name,
            address: queryAddress,
            success: false,
            error: `Geoapify HTTP ${response.status}: ${errText.slice(0, 100)}`
          });
          if (response.status === 401 || response.status === 403) {
            break;
          }
          continue;
        }

        const geoData = await response.json();
        if (geoData.results && geoData.results.length > 0) {
          const hit = geoData.results[0];
          const lat = Number(hit.lat);
          const lon = Number(hit.lon);

          const { error: updateErr } = await supabaseAdmin
            .from("vendors")
            .update({ latitude: lat, longitude: lon })
            .eq("id", v.id);

          if (updateErr) {
            results.push({ id: v.id, name: v.trade_name, address: queryAddress, success: false, error: updateErr.message });
          } else {
            updatedCount++;
            results.push({ id: v.id, name: v.trade_name || v.company_name, address: queryAddress, lat, lon, success: true });
          }
        } else {
          results.push({ id: v.id, name: v.trade_name, address: queryAddress, success: false, error: "კოორდინატები ვერ მოიძებნა" });
        }

        await new Promise(r => setTimeout(r, 250));
      } catch (callErr: any) {
        results.push({ id: v.id, name: v.trade_name, address: queryAddress, success: false, error: callErr.message });
      }
    }

    const remainingAfter = Math.max((totalUngeocoded || 0) - updatedCount, 0);

    res.json({
      success: true,
      processed: vendors.length,
      updated: updatedCount,
      remaining: remainingAfter,
      has_more: updatedCount > 0 && remainingAfter > 0,
      results
    });
  } catch (err: any) {
    console.error("Geocoding API error:", err);
    res.status(500).json({ error: err.message || "Geocoding process failed" });
  }
});

// Route Optimization via Geoapify Route Planner (with 2-opt TSP fallback)
router.post("/api/optimize-route", async (req, res) => {
  try {
    const geoapifyKey = process.env.GEOAPIFY_API_KEY || process.env.VITE_GEOAPIFY_API_KEY || "";
    let orders: { id: string; vendor_id?: string; lat?: number | null; lon?: number | null; address?: string; name?: string; status?: string; is_deleted?: boolean; order_date?: string; vehicle_id?: string; truck_plate?: string; driver_id?: string }[] = req.body.orders || [];

    const todayStr = (req.body.date && String(req.body.date).slice(0, 10)) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());

    if (isSupabaseConfigured && supabaseAdmin && orders.length > 0) {
      try {
        const orderIds = orders.map(o => o.id).filter(Boolean);
        let query = supabaseAdmin
          .from("orders")
          .select("id, vendor_id, order_date, created_at, status, vehicle_id, truck_plate, driver_id, is_deleted")
          .in("id", orderIds)
          .eq("is_deleted", false)
          .neq("status", "cancelled")
          .neq("status", "completed");

        if (req.body.vehicle_id) {
          query = query.eq("vehicle_id", req.body.vehicle_id);
        } else if (req.body.truck_plate) {
          query = query.eq("truck_plate", req.body.truck_plate);
        }

        const { data: dbOrders, error: dbErr } = await query;
        if (!dbErr && dbOrders) {
          const allowedIdSet = new Set(
            dbOrders.filter((o: any) => {
              const rawDate = o.order_date || o.created_at;
              if (!rawDate) return false;
              try {
                const dStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date(rawDate));
                return dStr === todayStr;
              } catch {
                return String(rawDate).slice(0, 10) === todayStr;
              }
            }).map((o: any) => o.id)
          );
          orders = orders.filter(o => allowedIdSet.has(o.id));
        }
      } catch (dbFilterErr) {
        console.warn("Database validation failed in server optimize-route, falling back to payload validation:", dbFilterErr);
      }
    } else {
      orders = orders.filter((o: any) => {
        if (o.is_deleted) return false;
        if (o.status && (o.status === "cancelled" || o.status === "completed")) return false;
        if (o.order_date || o.created_at) {
          const raw = o.order_date || o.created_at;
          try {
            const dStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date(raw));
            if (dStr !== todayStr) return false;
          } catch {
            if (String(raw).slice(0, 10) !== todayStr) return false;
          }
        }
        if (req.body.vehicle_id && o.vehicle_id && o.vehicle_id !== req.body.vehicle_id) return false;
        if (req.body.truck_plate && o.truck_plate && o.truck_plate !== req.body.truck_plate) return false;
        return true;
      });
    }

    const parseCoord = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    orders.forEach(o => {
      o.lat = parseCoord(o.lat);
      o.lon = parseCoord(o.lon);
    });

    const missingCoordVendorIds = orders
      .filter(o => (o.lat === null || o.lat === undefined) && (o as any).vendor_id)
      .map(o => (o as any).vendor_id!)
      .filter(Boolean);

    if (missingCoordVendorIds.length > 0 && isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: vData } = await supabaseAdmin
          .from('vendors')
          .select('id, latitude, longitude')
          .in('id', missingCoordVendorIds);
        if (vData && vData.length > 0) {
          const vMap = new Map(vData.map((v: any) => [v.id, { lat: parseCoord(v.latitude), lon: parseCoord(v.longitude) }]));
          orders.forEach(o => {
            if ((o.lat === null || o.lat === undefined) && (o as any).vendor_id) {
              const c = vMap.get((o as any).vendor_id);
              if (c && c.lat !== null && c.lon !== null) {
                o.lat = c.lat;
                o.lon = c.lon;
              }
            }
          });
        }
      } catch (cErr) {
        console.warn('Failed querying vendors coordinates in server optimize-route:', cErr);
      }
    }

    if (!Array.isArray(orders) || orders.length <= 1) {
      return res.json({
        success: true,
        optimized_order_ids: orders.map(o => o.id),
        source: "noop"
      });
    }

    const validStops = orders.filter(o => typeof o.lat === "number" && typeof o.lon === "number" && !isNaN(o.lat) && !isNaN(o.lon));
    const unlocatedStops = orders.filter(o => typeof o.lat !== "number" || typeof o.lon !== "number" || isNaN(o.lat) || isNaN(o.lon));

    const LIBERTY_SQUARE: [number, number] = [44.8015, 41.6934];
    let startLocation: [number, number] = LIBERTY_SQUARE;
    if (Array.isArray(req.body.start_location) && req.body.start_location.length === 2) {
      const sLon = parseCoord(req.body.start_location[0]);
      const sLat = parseCoord(req.body.start_location[1]);
      if (sLon !== null && sLat !== null) {
        startLocation = [sLon, sLat];
      }
    }

    if (!geoapifyKey && isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data, error: fnErr } = await supabaseAdmin.functions.invoke("optimize-route", {
          body: {
            ...req.body,
            start_location: startLocation
          }
        });
        if (!fnErr && data?.optimized_order_ids && data.optimized_order_ids.length > 0) {
          return res.json(data);
        }
      } catch (e: any) {
        console.warn("Edge function optimize-route invocation failed from server:", e?.message);
      }
    }

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
        };

        const plannerRes = await fetch(`https://api.geoapify.com/v1/routeplanner?apiKey=${geoapifyKey}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Referer": "https://biodieselgeorgia.vercel.app/",
            "Origin": "https://biodieselgeorgia.vercel.app",
            "Accept": "application/json"
          },
          body: JSON.stringify(plannerPayload)
        });

        if (plannerRes.ok) {
          const plannerData = await plannerRes.json();
          const features = Array.isArray(plannerData?.features) ? plannerData.features : [];
          const orderedJobIds: string[] = [];

          const pushStopId = (id?: string | null) => {
            if (id && !orderedJobIds.includes(id) && validStops.some(s => s.id === id)) {
              orderedJobIds.push(id);
            }
          };

          for (const feat of features) {
            const actions: any[] = feat?.properties?.actions || [];
            for (const act of actions) {
              if (act.type === 'start' || act.type === 'end') continue;

              if (typeof act.job_index === 'number' && validStops[act.job_index]) {
                pushStopId(validStops[act.job_index].id);
                continue;
              }
              if (typeof act.shipment_index === 'number' && validStops[act.shipment_index]) {
                pushStopId(validStops[act.shipment_index].id);
                continue;
              }
              if (act.job_id) {
                pushStopId(String(act.job_id));
                continue;
              }
              if (act.shipment_id) {
                pushStopId(String(act.shipment_id));
                continue;
              }
              if (act.id) {
                pushStopId(String(act.id));
                continue;
              }
              if (typeof act.location_index === 'number' && validStops[act.location_index]) {
                pushStopId(validStops[act.location_index].id);
                continue;
              }
            }

            if (orderedJobIds.length === 0) {
              const waypoints: any[] = feat?.properties?.waypoints || [];
              for (const wp of waypoints) {
                if (Array.isArray(wp.actions)) {
                  for (const wpAct of wp.actions) {
                    if (wpAct.type === 'start' || wpAct.type === 'end') continue;
                    if (typeof wpAct.job_index === 'number' && validStops[wpAct.job_index]) {
                      pushStopId(validStops[wpAct.job_index].id);
                    } else if (wpAct.job_id) {
                      pushStopId(String(wpAct.job_id));
                    } else if (wpAct.id) {
                      pushStopId(String(wpAct.id));
                    }
                  }
                }
                const loc = wp.original_location || wp.location;
                if (Array.isArray(loc) && loc.length >= 2) {
                  const [wpLon, wpLat] = loc;
                  const matched = validStops.find(s => 
                    Math.abs(s.lon! - wpLon) < 0.0001 && Math.abs(s.lat! - wpLat) < 0.0001
                  );
                  if (matched) {
                    pushStopId(matched.id);
                  }
                }
              }
            }
          }

          if (orderedJobIds.length > 0) {
            for (const s of validStops) {
              if (!orderedJobIds.includes(s.id)) {
                orderedJobIds.push(s.id);
              }
            }

            const finalOrderIds = [...orderedJobIds, ...unlocatedStops.map(s => s.id)];

            return res.json({
              success: true,
              optimized_order_ids: finalOrderIds,
              source: "geoapify"
            });
          }
        } else {
          console.warn("Geoapify Route Planner API returned non-OK status:", plannerRes.status, await plannerRes.text());
        }
      } catch (apiErr) {
        console.warn("Geoapify Route Planner call failed, using mathematical TSP solver fallback:", apiErr);
      }
    }

    const haversineDist = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    if (validStops.length > 0) {
      const remaining = [...validStops].sort((a, b) => a.id.localeCompare(b.id));

      let startIdx = 0;
      let startDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineDist(startLocation[1], startLocation[0], remaining[i].lat!, remaining[i].lon!);
        if (d < startDist) {
          startDist = d;
          startIdx = i;
        }
      }

      const route = [remaining.splice(startIdx, 1)[0]];

      while (remaining.length > 0) {
        const current = route[route.length - 1];
        let bestIdx = 0;
        let bestDist = Infinity;

        for (let i = 0; i < remaining.length; i++) {
          const dist = haversineDist(current.lat!, current.lon!, remaining[i].lat!, remaining[i].lon!);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
          }
        }

        route.push(remaining.splice(bestIdx, 1)[0]);
      }

      let improved = true;
      let iterations = 0;
      while (improved && iterations < 50 && route.length >= 4) {
        improved = false;
        iterations++;
        for (let i = 0; i < route.length - 2; i++) {
          for (let j = i + 2; j < route.length; j++) {
            const d1 = haversineDist(route[i].lat!, route[i].lon!, route[i + 1].lat!, route[i + 1].lon!) +
                       (j + 1 < route.length ? haversineDist(route[j].lat!, route[j].lon!, route[j + 1].lat!, route[j + 1].lon!) : 0);
            const d2 = haversineDist(route[i].lat!, route[i].lon!, route[j].lat!, route[j].lon!) +
                       (j + 1 < route.length ? haversineDist(route[i + 1].lat!, route[i + 1].lon!, route[j + 1].lat!, route[j + 1].lon!) : 0);
            if (d2 < d1 - 0.001) {
              const sub = route.slice(i + 1, j + 1).reverse();
              route.splice(i + 1, sub.length, ...sub);
              improved = true;
              break;
            }
          }
          if (improved) break;
        }
      }

      const optimizedOrderIds = [...route.map(s => s.id), ...unlocatedStops.map(s => s.id)];
      return res.json({
        success: true,
        optimized_order_ids: optimizedOrderIds,
        source: "fallback_tsp"
      });
    }

    res.json({
      success: true,
      optimized_order_ids: orders.map(o => o.id),
      source: "preserve"
    });
  } catch (err: any) {
    console.error("Route optimization error:", err);
    res.status(500).json({ error: err.message || "Optimization failed" });
  }
});

export default router;
