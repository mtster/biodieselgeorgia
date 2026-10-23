import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronRight, CalendarRange, Loader2 } from 'lucide-react';
import { Vendor, Order, City, District } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t } from '../../utils/lang';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Module-level in-flight cache to deduplicate concurrent requests
let inFlightRegionsPromise: { key: string; promise: Promise<any> } | null = null;

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  cities: City[];
  districts: District[];
  onBack: () => void;
}

export default function DeliveredOrdersByRegions({
  suppliers,
  orders,
  cities,
  districts,
  onBack,
}: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [periodOrders, setPeriodOrders] = useState<Order[]>([]);
  const [isPeriodLoading, setIsPeriodLoading] = useState(false);

  // Scalable period-based fetch: only triggered when user selects a date filter
  useEffect(() => {
    let isCancelled = false;
    if (!startDate && !endDate) {
      setPeriodOrders([]);
      setIsPeriodLoading(false);
      return;
    }

    setIsPeriodLoading(true);

    async function fetchOrdersForPeriod() {
      if (!isSupabaseConfigured || !supabase) {
        setIsPeriodLoading(false);
        return;
      }

      const cacheKey = `${startDate}_${endDate}`;
      if (!inFlightRegionsPromise || inFlightRegionsPromise.key !== cacheKey) {
        let q = supabase
          .from('orders')
          .select(`
            *,
            vendor:vendors(id, trade_name, company_name, id_code, city, district, address, manager_id, warehouse_id)
          `)
          .eq('is_deleted', false)
          .eq('status', 'completed');

        if (startDate) q = q.gte('order_date', startDate);
        if (endDate) q = q.lte('order_date', endDate + 'T23:59:59');
        q = q.order('order_date', { ascending: false });

        inFlightRegionsPromise = {
          key: cacheKey,
          promise: q.then(res => {
            setTimeout(() => {
              if (inFlightRegionsPromise?.key === cacheKey) {
                inFlightRegionsPromise = null;
              }
            }, 1000);
            return res;
          })
        };
      }

      try {
        const { data, error } = await inFlightRegionsPromise.promise;
        if (!error && data && !isCancelled) {
          setPeriodOrders(data as Order[]);
        }
      } catch (err) {
        console.warn('DeliveredOrdersByRegions fetch error:', err);
      } finally {
        if (!isCancelled) setIsPeriodLoading(false);
      }
    }

    fetchOrdersForPeriod();
    return () => {
      isCancelled = true;
    };
  }, [startDate, endDate]);

  // 1. Fetch completed orders from period fetch
  const completedOrders = periodOrders;

  // Fast city ID and district ID resolution maps
  const cityMap = React.useMemo(() => {
    const map = new Map<string, string>();
    (cities || []).forEach(c => {
      if (c.id) {
        map.set(c.id, c.name);
        map.set(c.id.toLowerCase().trim(), c.name);
      }
      if (c.name) {
        map.set(c.name, c.name);
        map.set(c.name.toLowerCase().trim(), c.name);
      }
    });
    return map;
  }, [cities]);

  const districtMap = React.useMemo(() => {
    const map = new Map<string, string>();
    (districts || []).forEach(d => {
      if (d.id) {
        map.set(d.id, d.name);
        map.set(d.id.toLowerCase().trim(), d.name);
      }
      if (d.name) {
        map.set(d.name, d.name);
        map.set(d.name.toLowerCase().trim(), d.name);
      }
    });
    return map;
  }, [districts]);

  const resolveCityName = (val?: string | null): string => {
    if (!val) return t('Other City');
    const clean = String(val).trim();
    return cityMap.get(clean) || cityMap.get(clean.toLowerCase()) || clean;
  };

  const resolveDistrictName = (val?: string | null): string => {
    if (!val) return '-';
    const clean = String(val).trim();
    return districtMap.get(clean) || districtMap.get(clean.toLowerCase()) || clean;
  };

  // Helper to find vendor
  const findVendor = (vendorId?: string, order?: Order) => {
    if (order && (order as any).vendor) {
      return (order as any).vendor as Vendor;
    }
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    return suppliers.find(s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)) || null;
  };

  // 2. Identify and aggregate by region from completed orders
  const regionMap: Record<string, { city: string; region: string; visitsAmount: number; oilAmount: number; cost: number }> = {};

  completedOrders.forEach(o => {
    // Period filter
    if (startDate || endDate) {
      const oDateStr = o.pickup_date_time || o.order_date || o.created_at;
      if (oDateStr) {
        const datePart = oDateStr.split('T')[0];
        if (startDate && datePart < startDate) return;
        if (endDate && datePart > endDate) return;
      }
    }

    const v = findVendor(o.vendor_id, o);
    const rawCity = o.city || v?.city || '';
    const rawDistrict = o.district || v?.district || '';
    const city = resolveCityName(rawCity);
    const district = resolveDistrictName(rawDistrict);
    const key = `${city}:::${district}`;

    if (!regionMap[key]) {
      regionMap[key] = {
        city,
        region: district,
        visitsAmount: 0,
        oilAmount: 0,
        cost: 0,
      };
    }

    const liters = o.fact_qty !== undefined && o.fact_qty !== null ? Number(o.fact_qty) : Number(o.qty_requested || 0);
    const validLiters = isNaN(liters) ? 0 : liters;
    const price = v?.price_per_liter || 0;

    regionMap[key].visitsAmount += 1;
    regionMap[key].oilAmount += validLiters;
    regionMap[key].cost += validLiters * price;
  });

  // 3. Map aggregates per group and apply search
  const regionRows = Object.values(regionMap)
    .filter(row => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          row.city.toLowerCase().includes(term) ||
          row.region.toLowerCase().includes(term)
        );
      }
      return true;
    })
    .sort((a, b) => b.visitsAmount - a.visitsAmount || b.oilAmount - a.oilAmount);

  // Summary row calculations
  const totalVisits = regionRows.reduce((sum, r) => sum + r.visitsAmount, 0);
  const totalOil = regionRows.reduce((sum, r) => sum + r.oilAmount, 0);
  const totalCost = regionRows.reduce((sum, r) => sum + r.cost, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Delivered Orders by Regions")}</>}
        onBack={onBack}
        backButtonId="reports-regions-back"
      />

      {/* FILTER BAR DESIGNS */}
      <div className="text-left">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <PeriodFilter
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
            />

            <div className="flex-1 min-w-[200px]">
              <CentralSearchBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder={t("Search regions by city name or district representation...")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE DATA SPREADSHEET CANVAS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="select-none bg-slate-50 border-b border-gray-200">
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("City")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Region (District)")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-center">
                  {t("Visits Amount")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                  გამოტანილი რაოდენობა (ლ)
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                  {t("Cost (₾)")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {isPeriodLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-xs text-gray-500">
                    <Loader2 className="h-6 w-6 text-emerald-700 animate-spin mx-auto mb-2" />
                    <span>{t("Loading data...")}</span>
                  </td>
                </tr>
              ) : (
                regionRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                      {row.city}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-700">
                      {row.region}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-gray-650">
                      {row.visitsAmount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-800">
                      {row.oilAmount.toLocaleString()} ლ
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800">
                      {row.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾
                    </td>
                  </tr>
                ))
              )}

              {!isPeriodLoading && regionRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No matching regional record aggregates found.")}
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {!isPeriodLoading && regionRows.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                    {t("TOTAL SUMMARY")}
                  </td>
                  <td className="py-4 px-4 font-semibold">
                    {regionRows.length} {t("active regions")}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-sm text-emerald-950">
                    {totalVisits}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-emerald-950">
                    {totalOil.toLocaleString()} ლ
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-emerald-950">
                    {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
