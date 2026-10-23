import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Search, X, Loader2 } from 'lucide-react';
import { Vendor, Order, User, City } from '../../types';
import PageHeader from '../PageHeader';
import PeriodFilter from '../PeriodFilter';
import { t, formatDate } from '../../utils/lang';
import { useDebouncedSearch } from '../../hooks/useDebounce';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  cities: City[];
  onBack: () => void;
}

// In-flight promise cache to deduplicate concurrent/StrictMode mount queries
let inFlightOrdersByPeriodPromise: { key: string; promise: Promise<any> } | null = null;

export default function OrdersByPeriod({
  suppliers,
  orders,
  users,
  cities,
  onBack,
}: Props) {
  // Preset period filter for current day in Asia/Tbilisi timezone
  const todayTbilisi = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());
  }, []);

  const [startDate, setStartDate] = useState(todayTbilisi);
  const [endDate, setEndDate] = useState(todayTbilisi);

  const [selectedCity, setSelectedCity] = useState('');
  const [selectedManager, setSelectedManager] = useState('');

  // Scaleproof debounced search input for company name and liters
  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    clearSearch
  } = useDebouncedSearch('', 300);

  const [dbOrders, setDbOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fast city ID to city name lookup dictionary
  const cityMap = useMemo(() => {
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

  const getCityDisplayName = (val?: string | null): string => {
    if (!val) return '-';
    const clean = String(val).trim();
    return cityMap.get(clean) || cityMap.get(clean.toLowerCase()) || clean;
  };

  // Manager options
  const filterManagers = users.filter(
    u => !u.is_deleted && (u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'operator')
  );

  // Suppliers map from props for instant offline lookup fallback
  const supplierLookup = useMemo(() => {
    const map = new Map<string, Vendor>();
    (suppliers || []).forEach(s => {
      if (s.id) {
        map.set(s.id, s);
        map.set(s.id.toLowerCase().trim(), s);
      }
    });
    return map;
  }, [suppliers]);

  // Scalable, server-side scoped query: fetch ONLY completed orders within the chosen date range
  // Selects only the essential columns and pre-joins vendor in a single minimal query
  useEffect(() => {
    let isCancelled = false;
    async function loadCompletedOrders() {
      if (!isSupabaseConfigured || !supabase) return;
      setIsLoading(true);

      const cacheKey = `${startDate}_${endDate}`;
      if (!inFlightOrdersByPeriodPromise || inFlightOrdersByPeriodPromise.key !== cacheKey) {
        let query = supabase
          .from('orders')
          .select(`
            *,
            vendor:vendors(
              id,
              trade_name,
              company_name,
              city,
              district,
              address,
              manager_id
            )
          `)
          .eq('is_deleted', false)
          .eq('status', 'completed');

        if (startDate) {
          query = query.gte('order_date', startDate);
        }
        if (endDate) {
          query = query.lte('order_date', endDate + 'T23:59:59');
        }

        query = query.order('order_date', { ascending: false });

        inFlightOrdersByPeriodPromise = {
          key: cacheKey,
          promise: query.then(res => {
            setTimeout(() => {
              if (inFlightOrdersByPeriodPromise?.key === cacheKey) {
                inFlightOrdersByPeriodPromise = null;
              }
            }, 1000);
            return res;
          })
        };
      }

      try {
        const { data, error } = await inFlightOrdersByPeriodPromise.promise;

        if (!error && data && !isCancelled) {
          setDbOrders(data as Order[]);
        }
      } catch (err) {
        console.warn('OrdersByPeriod loadCompletedOrders error:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadCompletedOrders();
    return () => {
      isCancelled = true;
    };
  }, [startDate, endDate]);

  // Combine DB orders with local fallback if running offline
  const allCompletedOrders = useMemo(() => {
    if (dbOrders.length > 0 || (isSupabaseConfigured && !isLoading)) {
      return dbOrders;
    }
    // Fallback for local storage environment
    return orders.filter(o => {
      if (o.is_deleted) return false;
      if (o.status !== 'completed' && String(o.status).toLowerCase() !== 'completed') return false;
      const oDateStr = o.order_date || o.pickup_date_time || o.created_at;
      if (oDateStr) {
        const datePart = oDateStr.includes('T') ? oDateStr.split('T')[0] : oDateStr.slice(0, 10);
        if (startDate && datePart < startDate) return false;
        if (endDate && datePart > endDate) return false;
      }
      return true;
    });
  }, [dbOrders, orders, isLoading, startDate, endDate]);

  // Robust helper to resolve vendor details
  const findVendor = (vendorId?: string, order?: Order): Vendor | null => {
    if (order && (order as any).vendor) {
      return (order as any).vendor as Vendor;
    }
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    return supplierLookup.get(vendorId) || supplierLookup.get(cleanId) || null;
  };

  // Helper to find manager name
  const getManagerName = (vendor: Vendor | null, order: Order) => {
    const managerId = vendor?.manager_id || order.operator_id || order.created_by || (order as any).manager_id;
    if (managerId) {
      const cleanId = String(managerId).trim().toLowerCase();
      const u = users.find(user => user.id === managerId || (user.id && String(user.id).trim().toLowerCase() === cleanId));
      if (u) return u.name;
    }
    return order.operator_name || '-';
  };

  // Filter completed orders according to criteria
  const filteredOrders = useMemo(() => {
    return allCompletedOrders
      .filter(o => {
        const vendor = findVendor(o.vendor_id, o);
        const tradeName = vendor?.trade_name || vendor?.company_name || o.vendor_name || (o as any).trade_name || (o as any).company_name || '';
        const rawCity = vendor?.city || o.city || (vendor as any)?.city_id;
        const cityName = getCityDisplayName(rawCity);

        // 1. City filter
        if (selectedCity) {
          if (cityName.toLowerCase() !== selectedCity.toLowerCase() && String(rawCity || '').toLowerCase() !== selectedCity.toLowerCase()) {
            return false;
          }
        }

        // 2. Manager filter
        if (selectedManager) {
          const managerId = vendor?.manager_id || o.operator_id || o.created_by || (o as any).manager_id;
          const cleanSelected = String(selectedManager).trim().toLowerCase();
          const cleanMid = managerId ? String(managerId).trim().toLowerCase() : '';
          if (cleanMid !== cleanSelected) return false;
        }

        // 3. Search Bar filter: separate purely numeric from words/letters search
        if (debouncedSearchTerm.trim()) {
          const rawTerm = debouncedSearchTerm.trim();
          const isPureNumber = /^\d+(\.\d+)?$/.test(rawTerm);

          if (isPureNumber) {
            // Numeric input: query ONLY by გამოტანილი რაოდენობა with EXACT number match
            const searchNum = Number(rawTerm);
            const factQty = o.fact_qty !== undefined && o.fact_qty !== null ? Number(o.fact_qty) : Number(o.qty_requested ?? 0);
            if (isNaN(factQty) || factQty !== searchNum) {
              return false;
            }
          } else {
            // Words or mixed: query ONLY by trade_name
            const lowerTerm = rawTerm.toLowerCase();
            const tradeMatch = tradeName.toLowerCase().includes(lowerTerm);
            if (!tradeMatch) {
              return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.order_date || a.pickup_date_time || a.created_at || '';
        const dateB = b.order_date || b.pickup_date_time || b.created_at || '';
        return dateB.localeCompare(dateA);
      });
  }, [allCompletedOrders, selectedCity, selectedManager, debouncedSearchTerm, supplierLookup, cityMap]);

  // Totals
  const totalFactQty = useMemo(() => {
    return filteredOrders.reduce((sum, o) => {
      const q = o.fact_qty !== undefined && o.fact_qty !== null ? Number(o.fact_qty) : Number(o.qty_requested || 0);
      return sum + (isNaN(q) ? 0 : q);
    }, 0);
  }, [filteredOrders]);

  return (
    <div className="space-y-6 text-left">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Orders by Period")}</>}
        onBack={onBack}
        backButtonId="reports-orders-by-period-back"
      />

      {/* FILTER CONTROLS */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3.5 flex-wrap">
        <PeriodFilter
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />

        {/* City Filter */}
        <div className="relative min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 font-sans uppercase tracking-wider">
            {t("City")}
          </span>
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Cities")}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        {/* Manager Filter */}
        <div className="relative min-w-[160px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 font-sans uppercase tracking-wider">
            {t("Manager")}
          </span>
          <select
            value={selectedManager}
            onChange={(e) => setSelectedManager(e.target.value)}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Managers")}</option>
            {filterManagers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        {/* Search Bar placed to the RIGHT of dropdown filters */}
        <div className="relative flex-1 min-w-[220px]">
          <div className="flex items-center w-full px-3 py-2 bg-slate-100/70 hover:bg-slate-100 border border-gray-200 focus-within:bg-white rounded-xl focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
            <Search size={15} className="text-gray-400 shrink-0 mr-2 pointer-events-none" />
            <input
              id="reports-period-search-input"
              type="text"
              placeholder="ძიება კომპანიით და გამოტანილი რაოდენობით"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none outline-none focus:outline-none p-0 text-xs text-gray-900 font-sans"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer shrink-0"
                title={t("Clear")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLE DATA */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader2 size={24} className="animate-spin text-emerald-700" />
            <span className="text-xs font-medium">მონაცემები იტვირთება...</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="select-none bg-slate-50 border-b border-gray-200">
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Company Name")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  გამოტანილი რაოდენობა (ლ)
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Date")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("City")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Manager")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {/* TOP SUMMARY ROW - Positioned at top so user sees totals instantly without scrolling */}
              {filteredOrders.length > 0 && (
                <tr className="bg-emerald-50/80 text-emerald-950 font-bold border-b-2 border-emerald-500/80 select-none shadow-2xs">
                  <td className="py-3.5 px-4 font-black uppercase tracking-wide text-[10px] text-emerald-900">
                    {t("TOTAL SUMMARY") || "სულ ჯამი"}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-sm text-emerald-950 font-black">
                    {totalFactQty.toLocaleString()} ლ
                  </td>
                  <td className="py-3.5 px-4 text-xs text-emerald-800 font-semibold" colSpan={3}>
                    {filteredOrders.length} {t("records") || "ჩანაწერი"}
                  </td>
                </tr>
              )}

              {filteredOrders.map((ord) => {
                const vendor = findVendor(ord.vendor_id, ord);
                const tradeName = vendor?.trade_name || vendor?.company_name || ord.vendor_name || (ord as any).trade_name || (ord as any).company_name || '-';
                const address = vendor?.address || ord.address || [vendor?.city, vendor?.district].filter(Boolean).join(', ') || '';
                const rawCity = vendor?.city || ord.city || (vendor as any)?.city_id;
                const cityName = getCityDisplayName(rawCity);
                const manager = getManagerName(vendor, ord);
                const factQty = ord.fact_qty !== undefined && ord.fact_qty !== null ? ord.fact_qty : (ord.qty_requested ?? 0);
                const factVal = `${factQty} ლ`;
                const dateStr = formatDate(ord.order_date || ord.pickup_date_time || ord.created_at);

                return (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900 text-xs">
                        {tradeName}
                      </div>
                      {address && (
                        <div className="text-[11px] text-gray-400 font-normal truncate max-w-[280px] mt-0.5" title={address}>
                          {address}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-850">
                      {factVal}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-600">
                      {dateStr}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {cityName}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {manager}
                    </td>
                  </tr>
                );
              })}

              {!isLoading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No records found.")}
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
