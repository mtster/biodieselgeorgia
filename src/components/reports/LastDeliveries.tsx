import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Vendor, Order, User, City, District } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import { t } from '../../utils/lang';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  cities?: City[];
  districts?: District[];
  onBack: () => void;
}

// Highly reliable timezone-safe days difference function
function getDaysDiff(dateStr: string): number {
  if (!dateStr) return 0;
  // Match YYYY-MM-DD format (e.g., "2026-06-29")
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    // Fallback to standard UTC matching if non-standard format
    const lastDate = new Date(dateStr);
    const today = new Date();
    const utc1 = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    const utc2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
  }
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // Month is 0-indexed in JS
  const day = parseInt(match[3], 10);
  
  const lastDateUtc = Date.UTC(year, month, day);
  
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = todayUtc - lastDateUtc;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays < 0 ? 0 : diffDays;
}

export interface OverdueVendorRow {
  id: string;
  id_code: string;
  company_name: string;
  trade_name: string;
  city: string;
  region: string;
  managerName: string;
  status: string;
  finalDeliveryDate: string;
  daysAgo: number;
  overdueDays: number;
  threshold: number;
}

// Module-level in-flight promise & result cache to prevent duplicate fetches across mounts
let inFlightFetchPromise: Promise<{ vendors: Vendor[]; orders: Order[] }> | null = null;
let cachedData: { vendors: Vendor[]; orders: Order[] } | null = null;
let cachedOverdueRecords: OverdueVendorRow[] | null = null;

export default function LastDeliveries({
  suppliers,
  orders,
  users,
  cities = [],
  districts = [],
  onBack,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [overdueRecords, setOverdueRecords] = useState<OverdueVendorRow[]>(cachedOverdueRecords || []);
  const [loading, setLoading] = useState(cachedOverdueRecords ? false : true);

  // Helper maps to resolve city and district UUIDs to actual Georgian names
  const cityMap = useMemo(() => {
    const map = new Map<string, string>();
    cities.forEach(c => {
      const name = (c as any).name_ka || c.name || '';
      if (c.id) map.set(c.id, name);
      if ((c as any).code) map.set((c as any).code, name);
    });
    return map;
  }, [cities]);

  const districtMap = useMemo(() => {
    const map = new Map<string, string>();
    districts.forEach(d => {
      const name = (d as any).name_ka || d.name || '';
      if (d.id) map.set(d.id, name);
      if ((d as any).code) map.set((d as any).code, name);
    });
    return map;
  }, [districts]);

  const resolveCityName = (val?: string) => {
    if (!val) return '—';
    return cityMap.get(val) || val;
  };

  const resolveDistrictName = (val?: string) => {
    if (!val) return '';
    return districtMap.get(val) || val;
  };

  useEffect(() => {
    let isCancelled = false;

    async function calculateOverdueVendors() {
      if (cachedOverdueRecords && cachedOverdueRecords.length > 0) {
        setOverdueRecords(cachedOverdueRecords);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        let activeSuppliers = (suppliers || []).filter(s => s && !s.is_deleted && s.status !== 'Closed' && s.status !== 'Cancelled');
        let completedOrders = (orders || []).filter(o => o && (o.status === 'completed' || String(o.status).toLowerCase() === 'completed') && !o.is_deleted && o.order_date);

        // If either suppliers or orders are not provided in props, load ONCE using shared in-flight promise
        if ((activeSuppliers.length === 0 || completedOrders.length === 0) && isSupabaseConfigured && supabase) {
          try {
            if (cachedData) {
              if (activeSuppliers.length === 0) activeSuppliers = cachedData.vendors;
              if (completedOrders.length === 0) completedOrders = cachedData.orders;
            } else {
              if (!inFlightFetchPromise) {
                inFlightFetchPromise = (async () => {
                  const [vRes, oRes] = await Promise.all([
                    supabase
                      .from('vendors')
                      .select('id, id_code, company_name, trade_name, city, district, manager_id, status, overdue_threshold_days, last_order_date, created_at')
                      .eq('is_deleted', false)
                      .neq('status', 'Closed')
                      .neq('status', 'Cancelled'),
                    supabase
                      .from('orders')
                      .select('vendor_id, order_date')
                      .eq('is_deleted', false)
                      .eq('status', 'completed')
                      .order('order_date', { ascending: false })
                  ]);
                  const loadedVendors = (vRes.data || []) as Vendor[];
                  const loadedOrders = (oRes.data || []) as Order[];
                  cachedData = { vendors: loadedVendors, orders: loadedOrders };
                  return cachedData;
                })().finally(() => {
                  inFlightFetchPromise = null;
                });
              }

              const result = await inFlightFetchPromise;
              if (activeSuppliers.length === 0) activeSuppliers = result.vendors;
              if (completedOrders.length === 0) completedOrders = result.orders;
            }
          } catch (fetchErr) {
            console.warn('Direct Supabase fetch error in LastDeliveries:', fetchErr);
          }
        }

        const latestMap: Record<string, string> = {};
        for (const ord of completedOrders) {
          if (ord.vendor_id && (!latestMap[ord.vendor_id] || new Date(ord.order_date) > new Date(latestMap[ord.vendor_id]))) {
            latestMap[ord.vendor_id] = ord.order_date;
          }
        }

        if (isCancelled) return;

        const calculated: OverdueVendorRow[] = [];

        for (const s of activeSuppliers) {
          let lastDateStr: string | null = null;
          const orderDateFromList = latestMap[s.id];
          const vendorLastOrderDate = s.last_order_date;

          if (orderDateFromList && vendorLastOrderDate) {
            lastDateStr = new Date(orderDateFromList) > new Date(vendorLastOrderDate) ? orderDateFromList : vendorLastOrderDate;
          } else {
            lastDateStr = orderDateFromList || vendorLastOrderDate || null;
          }

          const managerObj = users.find(u => u.id === s.manager_id);
          const managerName = managerObj ? managerObj.name : t('Unassigned');

          const resolvedCity = resolveCityName(s.city);
          const resolvedDistrict = resolveDistrictName(s.district);

          if (lastDateStr) {
            const threshold = s.overdue_threshold_days;
            if (threshold !== null && threshold !== undefined && threshold > 0) {
              const daysAgo = getDaysDiff(lastDateStr);
              const overdueDays = daysAgo - threshold;
              if (overdueDays > 0) {
                calculated.push({
                  id: s.id,
                  id_code: s.id_code || 'N/A',
                  company_name: s.company_name || '',
                  trade_name: s.trade_name || '',
                  city: resolvedCity,
                  region: resolvedDistrict,
                  managerName,
                  status: 'Active',
                  finalDeliveryDate: lastDateStr.split('T')[0],
                  daysAgo,
                  overdueDays,
                  threshold,
                });
              }
            }
          } else {
            const daysSinceCreation = getDaysDiff(s.created_at || new Date().toISOString());
            if (daysSinceCreation > 30) {
              const overdueDays = daysSinceCreation - 30;
              calculated.push({
                id: s.id,
                id_code: s.id_code || 'N/A',
                company_name: s.company_name || '',
                trade_name: s.trade_name || '',
                city: resolvedCity,
                region: resolvedDistrict,
                managerName,
                status: 'Active',
                finalDeliveryDate: t('No deliveries'),
                daysAgo: daysSinceCreation,
                overdueDays,
                threshold: 30,
              });
            }
          }
        }

        calculated.sort((a, b) => b.overdueDays - a.overdueDays);
        cachedOverdueRecords = calculated;

        if (!isCancelled) {
          setOverdueRecords(calculated);
        }
      } catch (err) {
        console.error('Error calculating overdue vendors:', err);
      } finally {
        setLoading(false);
      }
    }

    calculateOverdueVendors();

    return () => {
      isCancelled = true;
    };
  }, [suppliers, orders, users, cityMap, districtMap]);

  // Apply search filter
  const deliveryRows = overdueRecords.filter(row => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        row.id_code.toLowerCase().includes(term) ||
        row.company_name.toLowerCase().includes(term) ||
        row.trade_name.toLowerCase().includes(term) ||
        row.city.toLowerCase().includes(term) ||
        row.region.toLowerCase().includes(term) ||
        row.managerName.toLowerCase().includes(term) ||
        row.status.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Sort by overdueDays descending (highest to top, lowest to bottom)
  const sortedDeliveryRows = [...deliveryRows].sort((a, b) => b.overdueDays - a.overdueDays);

  // Calculate metrics for summary row
  const totalSuppliers = sortedDeliveryRows.length;
  const avgOverdueDays =
    totalSuppliers > 0
      ? Math.round(sortedDeliveryRows.reduce((sum, r) => sum + r.overdueDays, 0) / totalSuppliers)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Last Deliveries")}</>}
        onBack={onBack}
        backButtonId="reports-last-deliveries-back"
      />

      {/* FILTER BAR DESIGN */}
      <div className="text-left">
        <CentralSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          idPrefix="last-deliveries-search"
          searchPlaceholder={t("Search last deliveries by company, code, manager, city, region, or status...")}
        />
      </div>

      {/* TABLE DATA SPREADSHEET CANVAS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
            <p className="text-xs text-gray-450 italic font-medium">{t("Calculating live overdue statuses...")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="select-none bg-slate-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                    {t("Identification Code")}
                  </th>
                  <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                    {t("Company Name")}
                  </th>
                  <th className="py-4 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                    {t("City / Region")}
                  </th>
                  <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                    {t("Manager")}
                  </th>
                  <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                    {t("Status")}
                  </th>
                  <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                    {t("Final Delivery Date")}
                  </th>
                  <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                    {t("Days Overdue")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sortedDeliveryRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                    <td className="py-3.5 px-4 font-mono font-semibold text-gray-500">
                      {row.id_code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                      {row.trade_name}
                      <span className="text-[10px] text-gray-400 font-normal block mt-0.5">
                        {row.company_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {row.city}
                      <span className="text-[10px] text-gray-400 block mt-0.5">{row.region}</span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {row.managerName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                          row.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.status === 'Under Negotiation'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {t(row.status)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-gray-650">
                      {row.finalDeliveryDate}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800">
                      {row.overdueDays} {t('days')}
                    </td>
                  </tr>
                ))}

                {sortedDeliveryRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-20 text-xs text-gray-400 italic">
                      {t("No matching supplier records found for last deliveries.")}
                    </td>
                  </tr>
                )}

                {/* SUMMARY ROW */}
                {sortedDeliveryRows.length > 0 && (
                  <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                    <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                      {t("TOTAL SUMMARY")}
                    </td>
                    <td className="py-4 px-4">
                      {totalSuppliers} {t("monitored suppliers")}
                    </td>
                    <td colSpan={4} className="py-4 px-4"></td>
                    <td className="py-4 px-4 text-right font-mono text-sm text-emerald-950">
                      {t("Avg:")} {avgOverdueDays} {t("days")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
