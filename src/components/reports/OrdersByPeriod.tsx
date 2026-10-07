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

  // Extra vendors map to ensure vendors missing from initial supplier batch are seamlessly resolved
  const [extraVendors, setExtraVendors] = useState<Map<string, Vendor>>(new Map());
  const [dbOrders, setDbOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Manager options
  const filterManagers = users.filter(
    u => !u.is_deleted && (u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'operator')
  );

  // Fetch completed orders directly with vendor pre-joined to eliminate missing vendor names or cities
  useEffect(() => {
    let isCancelled = false;
    async function loadCompletedOrders() {
      if (!isSupabaseConfigured || !supabase) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, vendor:vendors(id, trade_name, company_name, city, district, address, manager_id, operator_id)')
          .eq('is_deleted', false)
          .eq('status', 'completed')
          .order('order_date', { ascending: false });

        if (!error && data && !isCancelled) {
          setDbOrders(data as Order[]);
          setExtraVendors(prev => {
            const nextMap = new Map(prev);
            data.forEach((o: any) => {
              if (o.vendor && o.vendor.id) {
                nextMap.set(o.vendor.id, o.vendor);
                nextMap.set(String(o.vendor.id).toLowerCase().trim(), o.vendor);
              }
            });
            return nextMap;
          });
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
  }, []);

  // Also prefetch any missing vendor IDs if there are local orders not yet synced
  useEffect(() => {
    const knownIds = new Set(suppliers.map(s => s.id));
    const missingIds = Array.from(new Set(
      orders
        .map(o => o.vendor_id)
        .filter(id => Boolean(id && !knownIds.has(id) && !extraVendors.has(id)))
    )) as string[];

    if (missingIds.length > 0 && isSupabaseConfigured && supabase) {
      // Chunk in batches of 50 to avoid URI length limits
      const chunks: string[][] = [];
      for (let i = 0; i < missingIds.length; i += 50) {
        chunks.push(missingIds.slice(i, i + 50));
      }

      Promise.all(
        chunks.map(chunk =>
          supabase
            .from('vendors')
            .select('id, trade_name, company_name, city, district, address, manager_id, operator_id')
            .in('id', chunk)
        )
      ).then(results => {
        setExtraVendors(prev => {
          const updated = new Map(prev);
          results.forEach(({ data, error }) => {
            if (!error && data) {
              data.forEach((v: any) => {
                updated.set(v.id, v);
                if (v.id) updated.set(String(v.id).toLowerCase().trim(), v);
              });
            }
          });
          return updated;
        });
      });
    }
  }, [orders, suppliers]);

  // Combine DB orders with any in-memory completed orders
  const allCompletedOrders = useMemo(() => {
    if (dbOrders.length > 0) {
      const dbIds = new Set(dbOrders.map(o => o.id));
      const unsaved = orders.filter(o => 
        !o.is_deleted && 
        (o.status === 'completed' || String(o.status).toLowerCase() === 'completed') &&
        !dbIds.has(o.id)
      );
      return [...dbOrders, ...unsaved];
    }
    return orders.filter(o => 
      !o.is_deleted && 
      (o.status === 'completed' || String(o.status).toLowerCase() === 'completed')
    );
  }, [dbOrders, orders]);

  // Robust helper to find vendor (checks attached order.vendor, extraVendors cache, and suppliers list)
  const findVendor = (vendorId?: string, order?: Order): Vendor | null => {
    if (order && (order as any).vendor) {
      return (order as any).vendor as Vendor;
    }
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    return (
      extraVendors.get(vendorId) ||
      extraVendors.get(cleanId) ||
      suppliers.find(s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)) ||
      null
    );
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
        // 1. Period filter (checked against effective order date)
        if (startDate || endDate) {
          const oDateStr = o.order_date || o.pickup_date_time || o.created_at;
          if (oDateStr) {
            const datePart = oDateStr.includes('T') ? oDateStr.split('T')[0] : oDateStr.slice(0, 10);
            if (startDate && datePart < startDate) return false;
            if (endDate && datePart > endDate) return false;
          }
        }

        const vendor = findVendor(o.vendor_id, o);
        const tradeName = vendor?.trade_name || vendor?.company_name || o.vendor_name || (o as any).trade_name || (o as any).company_name || '';
        const compName = vendor?.company_name || '';
        const address = vendor?.address || o.address || [vendor?.city, vendor?.district].filter(Boolean).join(', ') || '';
        const cityVal = vendor?.city || o.city || (cities.find(c => c.id === (vendor as any)?.city_id)?.name) || '';

        // 2. City filter
        if (selectedCity) {
          if (cityVal.toLowerCase() !== selectedCity.toLowerCase()) return false;
        }

        // 3. Manager filter
        if (selectedManager) {
          const managerId = vendor?.manager_id || o.operator_id || o.created_by || (o as any).manager_id;
          const cleanSelected = String(selectedManager).trim().toLowerCase();
          const cleanMid = managerId ? String(managerId).trim().toLowerCase() : '';
          if (cleanMid !== cleanSelected) return false;
        }

        // 4. Search Bar filter: separate purely numeric from words/letters search
        if (debouncedSearchTerm.trim()) {
          const rawTerm = debouncedSearchTerm.trim();
          const isPureNumber = /^\d+(\.\d+)?$/.test(rawTerm);

          if (isPureNumber) {
            // Numeric input: query ONLY by შემოტანილი რაოდენობა with EXACT number match
            const searchNum = Number(rawTerm);
            const factQty = o.fact_qty !== undefined && o.fact_qty !== null ? Number(o.fact_qty) : Number(o.qty_requested ?? 0);
            if (isNaN(factQty) || factQty !== searchNum) {
              return false;
            }
          } else {
            // Words or mixed (letters + numbers): query ONLY by trade_name
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
  }, [allCompletedOrders, startDate, endDate, selectedCity, selectedManager, debouncedSearchTerm, extraVendors, suppliers, cities]);

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
              placeholder="ძიება კომპანიით და რაოდენობით"
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
        {isLoading && dbOrders.length === 0 && (
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
                  შემოტანილი რაოდენობა (ლ)
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
                const city = vendor?.city || ord.city || (cities.find(c => c.id === (vendor as any)?.city_id)?.name) || '-';
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
                      {city}
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
