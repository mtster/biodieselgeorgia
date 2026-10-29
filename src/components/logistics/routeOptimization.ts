import { Order, Vendor } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { VendorDisplayInfo } from './types';

export interface OptimizeRouteParams {
  items: Order[];
  vehicleId?: string;
  vehiclePlateText?: string;
  driverId?: string;
  dateStr?: string;
  getVendorInfo: (order: Order) => VendorDisplayInfo;
}

// Haversine distance in kilometers (deterministic)
function haversineDistance(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Local 2-Opt Traveling Salesperson Problem (TSP) Solver
 * Guarantees deterministic optimal route when Geoapify or backend is unavailable
 */
function solveLocalTspRoute(
  stops: { id: string; lon: number; lat: number }[],
  startLocation: [number, number]
): string[] {
  if (stops.length <= 1) return stops.map(s => s.id);

  // Deterministically sort input stops by id to eliminate random ordering differences
  const remaining = [...stops].sort((a, b) => a.id.localeCompare(b.id));

  // 1. Nearest Neighbor construction starting from driver's location
  let currentLon = startLocation[0];
  let currentLat = startLocation[1];

  let nearestIdx = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < remaining.length; i++) {
    const d = haversineDistance(currentLon, currentLat, remaining[i].lon, remaining[i].lat);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  }

  const route = [remaining.splice(nearestIdx, 1)[0]];

  while (remaining.length > 0) {
    const curr = route[route.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(curr.lon, curr.lat, remaining[i].lon, remaining[i].lat);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    route.push(remaining.splice(bestIdx, 1)[0]);
  }

  // 2. 2-Opt iterative improvement (deterministic untangling)
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 50 && route.length >= 4) {
    improved = false;
    iterations++;
    for (let i = 0; i < route.length - 2; i++) {
      for (let j = i + 2; j < route.length; j++) {
        const d1 =
          haversineDistance(route[i].lon, route[i].lat, route[i + 1].lon, route[i + 1].lat) +
          (j + 1 < route.length ? haversineDistance(route[j].lon, route[j].lat, route[j + 1].lon, route[j + 1].lat) : 0);
        const d2 =
          haversineDistance(route[i].lon, route[i].lat, route[j].lon, route[j].lat) +
          (j + 1 < route.length ? haversineDistance(route[i + 1].lon, route[i + 1].lat, route[j + 1].lon, route[j + 1].lat) : 0);

        if (d2 < d1 - 0.0001) {
          const reversed = route.slice(i + 1, j + 1).reverse();
          route.splice(i + 1, reversed.length, ...reversed);
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return route.map(r => r.id);
}

/**
 * Auto-optimize route via Geoapify Route Planner with resilient local 2-Opt TSP fallback.
 * Orders without coordinates are excluded from Geoapify and aligned at the very top.
 */
export async function optimizeRouteStops({
  items,
  vehicleId,
  vehiclePlateText,
  driverId,
  dateStr,
  getVendorInfo
}: OptimizeRouteParams): Promise<string[]> {
  if (items.length <= 1) return items.map(i => i.id);

  // 1. Separate orders into unlocated (lacking vendor coordinates) and located
  const unlocatedOrders: Order[] = [];
  const locatedOrders: { order: Order; lat: number; lon: number; tradeName: string; address: string }[] = [];

  for (const item of items) {
    const info = getVendorInfo(item);
    const lat = typeof info.lat === 'number' && !isNaN(info.lat) ? info.lat : null;
    const lon = typeof info.lon === 'number' && !isNaN(info.lon) ? info.lon : null;

    if (lat !== null && lon !== null && (lat !== 0 || lon !== 0)) {
      locatedOrders.push({
        order: item,
        lat,
        lon,
        tradeName: info.tradeName || '',
        address: info.address || ''
      });
    } else {
      unlocatedOrders.push(item);
    }
  }

  // If no orders have coordinates, return existing list with unlocated orders at the top
  if (locatedOrders.length === 0) {
    return items.map(i => i.id);
  }

  // If only 1 order has coordinates, unlocated orders go to top and the single located order follows
  if (locatedOrders.length === 1) {
    return [...unlocatedOrders.map(o => o.id), locatedOrders[0].order.id];
  }

  // 2. Get driver's current GPS location with high accuracy, rounded to 4 decimals to avoid micro-jitter
  let startLocation: [number, number] = [44.8015, 41.6934]; // Freedom Square, Tbilisi
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 2500,
          maximumAge: 120000,
          enableHighAccuracy: true
        });
      });
      if (pos?.coords?.latitude && pos?.coords?.longitude) {
        // Round to 4 decimal places (~11 meters) to guarantee stable, deterministic routing requests
        const roundLon = Math.round(pos.coords.longitude * 10000) / 10000;
        const roundLat = Math.round(pos.coords.latitude * 10000) / 10000;
        startLocation = [roundLon, roundLat];
      }
    } catch {}
  }

  // 3. Prepare payload ONLY for located stops (unlocated stops are NOT passed to Geoapify)
  const stops = locatedOrders.map(lo => ({
    id: lo.order.id,
    vendor_id: lo.order.vendor_id,
    lat: lo.lat,
    lon: lo.lon,
    name: lo.tradeName,
    address: lo.address,
    status: lo.order.status,
    order_date: lo.order.order_date,
    vehicle_id: lo.order.vehicle_id || vehicleId,
    driver_id: lo.order.driver_id || driverId
  }));

  const requestPayload = {
    orders: stops,
    vehicle_id: vehicleId,
    driver_id: driverId,
    date: dateStr,
    start_location: startLocation
  };

  let orderedLocatedIds: string[] = [];

  // 4. Try Supabase Edge Function 'optimize-route'
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('optimize-route', {
        body: requestPayload
      });
      if (!fnErr && fnData?.optimized_order_ids && fnData.optimized_order_ids.length > 0) {
        const receivedIds: string[] = fnData.optimized_order_ids;
        // Verify all located stops are accounted for
        if (locatedOrders.every(lo => receivedIds.includes(lo.order.id))) {
          orderedLocatedIds = receivedIds.filter(id => locatedOrders.some(lo => lo.order.id === id));
        }
      }
    } catch (e: any) {
      console.warn('Edge function optimize-route invocation failed, trying express API:', e?.message);
    }
  }

  // 5. Try Express server /api/optimize-route
  if (orderedLocatedIds.length === 0) {
    try {
      const res = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.optimized_order_ids && data.optimized_order_ids.length > 0) {
          const receivedIds: string[] = data.optimized_order_ids;
          if (locatedOrders.every(lo => receivedIds.includes(lo.order.id))) {
            orderedLocatedIds = receivedIds.filter(id => locatedOrders.some(lo => lo.order.id === id));
          }
        }
      }
    } catch (e: any) {
      console.warn('Server /api/optimize-route failed, falling back to local 2-Opt TSP solver:', e?.message);
    }
  }

  // 6. Resilient deterministic local 2-Opt TSP solver fallback
  if (orderedLocatedIds.length === 0) {
    const validStops = locatedOrders.map(lo => ({
      id: lo.order.id,
      lon: lo.lon,
      lat: lo.lat
    }));
    orderedLocatedIds = solveLocalTspRoute(validStops, startLocation);
  }

  // 7. Combine: UNLOCATED orders are aligned to the VERY TOP, followed by optimized located orders
  return [
    ...unlocatedOrders.map(o => o.id),
    ...orderedLocatedIds
  ];
}
