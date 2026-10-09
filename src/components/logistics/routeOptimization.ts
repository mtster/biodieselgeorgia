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

/**
 * Auto-optimize route via Geoapify Route Planner (with local TSP fallback)
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

  let startLocation: [number, number] = [44.8015, 41.6934];
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 2500,
          maximumAge: 60000,
          enableHighAccuracy: false
        });
      });
      if (pos?.coords?.latitude && pos?.coords?.longitude) {
        startLocation = [pos.coords.longitude, pos.coords.latitude];
      }
    } catch {}
  }

  const stops = items.map(o => {
    const info = getVendorInfo(o);
    return {
      id: o.id,
      vendor_id: o.vendor_id,
      lat: info.lat,
      lon: info.lon,
      name: info.tradeName,
      address: info.address,
      status: o.status,
      order_date: o.order_date,
      vehicle_id: o.vehicle_id || vehicleId,
      truck_plate: o.truck_plate || vehiclePlateText,
      driver_id: o.driver_id || driverId
    };
  });

  const requestPayload = {
    orders: stops,
    vehicle_id: vehicleId,
    truck_plate: vehiclePlateText,
    driver_id: driverId,
    date: dateStr,
    start_location: startLocation
  };

  let orderedIds: string[] = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('optimize-route', {
        body: requestPayload
      });
      if (!fnErr && fnData?.optimized_order_ids && fnData.optimized_order_ids.length > 0) {
        orderedIds = fnData.optimized_order_ids;
      }
    } catch (e: any) {
      console.warn('Edge function optimize-route failed, trying express API:', e?.message);
    }
  }

  if (orderedIds.length === 0) {
    const res = await fetch('/api/optimize-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload)
    });

    if (!res.ok) {
      throw new Error('მარშრუტის ოპტიმიზაციის მოთხოვნა ვერ შესრულდა');
    }

    const data = await res.json();
    orderedIds = data.optimized_order_ids || [];
  }

  return orderedIds;
}
