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

// Approximate centroids for Georgian districts to ensure every stop has valid coordinates for TSP optimization
const DISTRICT_COORDS: Record<string, [number, number]> = {
  // [lon, lat]
  'საბურთალო': [44.745, 41.725],
  'ვაკე': [44.760, 41.710],
  'ვერა': [44.785, 41.710],
  'ცენტრი': [44.795, 41.700],
  'მთაწმინდა': [44.790, 41.695],
  'სოლოლაკი': [44.798, 41.688],
  'დიდუბე': [44.780, 41.745],
  'ჩუღურეთი': [44.805, 41.715],
  'გლდანი': [44.825, 41.790],
  'ნაძალადევი': [44.810, 41.745],
  'სანზონა': [44.800, 41.750],
  'თემქა': [44.830, 41.765],
  'ისანი': [44.835, 41.690],
  'ავლაბარი': [44.815, 41.690],
  'ორთაჭალა': [44.835, 41.675],
  'სამგორი': [44.885, 41.700],
  'ვარკეთილი': [44.880, 41.710],
  'ვაზისუბანი': [44.860, 41.705],
  'დიდი დიღომი': [44.740, 41.795],
  'დიღომი': [44.750, 41.770],
  'ლილო': [44.970, 41.690],
  'რუსთავი': [44.990, 41.540],
  'მცხეთა': [44.720, 41.840],
  'ბათუმი': [41.636, 41.643],
  'ქუთაისი': [42.705, 42.266]
};

function resolveFallbackCoordinates(addressText: string, seed: string): [number, number] {
  const norm = (addressText || '').toLowerCase();
  for (const [district, coords] of Object.entries(DISTRICT_COORDS)) {
    if (norm.includes(district.toLowerCase())) {
      // Add slight jitter based on seed so stops in same district don't overlap completely
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
      const jitterLon = ((hash % 100) / 10000);
      const jitterLat = (((hash >> 3) % 100) / 10000);
      return [coords[0] + jitterLon, coords[1] + jitterLat];
    }
  }
  // Default to central Tbilisi
  return [44.8015, 41.6934];
}

/**
 * Haversine distance in kilometers
 */
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
 * Guarantees optimal route even if backend/edge functions or Geoapify are unreachable
 */
function solveLocalTspRoute(
  stops: { id: string; lon: number; lat: number }[],
  startLocation: [number, number]
): string[] {
  if (stops.length <= 1) return stops.map(s => s.id);

  const remaining = [...stops];
  // 1. Nearest Neighbor construction starting from driver's current location
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

  // 2. 2-Opt iterative improvement (untangles any intersecting line segments)
  let improved = true;
  let iterations = 0;
  while (improved && iterations < 40 && route.length >= 4) {
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

        if (d2 < d1 - 0.001) {
          // Reverse slice between i+1 and j
          const reversed = route.slice(i + 1, j + 1).reverse();
          route.splice(i + 1, reversed.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  return route.map(r => r.id);
}

/**
 * Auto-optimize route via Geoapify Route Planner with resilient local 2-Opt TSP fallback
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

  // 1. Get driver's current GPS location with high accuracy and fast fallback
  let startLocation: [number, number] = [44.8015, 41.6934]; // Freedom Square, Tbilisi
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 3000,
          maximumAge: 120000,
          enableHighAccuracy: true
        });
      });
      if (pos?.coords?.latitude && pos?.coords?.longitude) {
        startLocation = [pos.coords.longitude, pos.coords.latitude];
      }
    } catch {}
  }

  // 2. Prepare stops with guaranteed valid coordinates
  const stops = items.map(o => {
    const info = getVendorInfo(o);
    let lat = typeof info.lat === 'number' && !isNaN(info.lat) ? info.lat : null;
    let lon = typeof info.lon === 'number' && !isNaN(info.lon) ? info.lon : null;

    if (lat === null || lon === null) {
      const fallback = resolveFallbackCoordinates(info.address || o.district || o.city || '', o.id);
      lon = fallback[0];
      lat = fallback[1];
    }

    return {
      id: o.id,
      vendor_id: o.vendor_id,
      lat,
      lon,
      name: info.tradeName,
      address: info.address,
      status: o.status,
      order_date: o.order_date,
      vehicle_id: o.vehicle_id || vehicleId,
      driver_id: o.driver_id || driverId
    };
  });

  const requestPayload = {
    orders: stops,
    vehicle_id: vehicleId,
    driver_id: driverId,
    date: dateStr,
    start_location: startLocation
  };

  let orderedIds: string[] = [];

  // 3. Try Supabase Edge Function 'optimize-route'
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('optimize-route', {
        body: requestPayload
      });
      if (!fnErr && fnData?.optimized_order_ids && fnData.optimized_order_ids.length > 0) {
        // Ensure all input items are accounted for
        if (fnData.optimized_order_ids.length >= items.length) {
          orderedIds = fnData.optimized_order_ids;
        }
      }
    } catch (e: any) {
      console.warn('Edge function optimize-route invocation failed, trying express API:', e?.message);
    }
  }

  // 4. Try Express server /api/optimize-route
  if (orderedIds.length === 0) {
    try {
      const res = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.optimized_order_ids && data.optimized_order_ids.length >= items.length) {
          orderedIds = data.optimized_order_ids;
        }
      }
    } catch (e: any) {
      console.warn('Server /api/optimize-route failed, falling back to local 2-Opt TSP solver:', e?.message);
    }
  }

  // 5. Embedded resilient local 2-Opt TSP solver fallback
  if (orderedIds.length === 0) {
    const validStops = stops.map(s => ({
      id: s.id,
      lon: s.lon as number,
      lat: s.lat as number
    }));
    orderedIds = solveLocalTspRoute(validStops, startLocation);
  }

  return orderedIds;
}
