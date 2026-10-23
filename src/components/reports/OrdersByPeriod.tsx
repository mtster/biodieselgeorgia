import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Search, X, Loader2, FileSpreadsheet, Download, ShieldAlert, CheckCircle2 } from 'lucide-react';
import XLSX from 'xlsx-js-style';
import { Vendor, Order, User, City, Warehouse } from '../../types';
import PageHeader from '../PageHeader';
import PeriodFilter from '../PeriodFilter';
import { t, formatDate } from '../../utils/lang';
import { useDebouncedSearch } from '../../hooks/useDebounce';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { verifyUserRoleAllowed } from '../../utils/jwtAuth';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  cities: City[];
  warehouses?: Warehouse[];
  onBack: () => void;
}

// In-flight promise cache to deduplicate concurrent/StrictMode mount queries
let inFlightOrdersByPeriodPromise: { key: string; promise: Promise<any> } | null = null;

export default function OrdersByPeriod({
  suppliers,
  orders,
  users,
  cities,
  warehouses = [],
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
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  // JWT validation & export modal states
  const [isCheckingJwt, setIsCheckingJwt] = useState(false);
  const [jwtError, setJwtError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [verifiedRole, setVerifiedRole] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  // Warehouse lookup dictionary
  const warehouseMap = useMemo(() => {
    const map = new Map<string, string>();
    (warehouses || []).forEach(w => {
      if (w.id) map.set(w.id, w.name);
    });
    return map;
  }, [warehouses]);

  const getWarehouseDisplayName = (vendor?: Vendor | null, ord?: Order): string => {
    const wId = ord?.warehouse_id || vendor?.warehouse_id;
    if (!wId) return '-';
    return warehouseMap.get(wId) || wId;
  };

  // Manager options
  const filterManagers = users.filter(
    u => !u.is_deleted && (u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'operator')
  );

  const activeWarehouses = (warehouses || []).filter(w => !w.is_deleted);

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
              manager_id,
              warehouse_id
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
    return supplierLookup.get(vendorId) || supplierLookup.get(vendorId.toLowerCase().trim()) || null;
  };

  // Helper to resolve manager display name
  const getManagerDisplayName = (vendor?: Vendor | null, ord?: Order): string => {
    const managerId = vendor?.manager_id || ord?.manager_id;
    if (!managerId) return '-';
    const cleanId = String(managerId).trim().toLowerCase();
    const mgr = users.find(u => u.id === managerId || (u.id && String(u.id).trim().toLowerCase() === cleanId));
    return mgr ? mgr.name : '-';
  };

  // Filter orders by period, city, manager, warehouse and search term
  const filteredOrders = useMemo(() => {
    return allCompletedOrders.filter(ord => {
      const vendor = findVendor(ord.vendor_id, ord);

      // 1. Period filter check
      const orderDateStr = ord.order_date || ord.pickup_date_time || ord.created_at;
      if (orderDateStr) {
        const dateOnly = orderDateStr.includes('T') ? orderDateStr.split('T')[0] : orderDateStr.slice(0, 10);
        if (startDate && dateOnly < startDate) return false;
        if (endDate && dateOnly > endDate) return false;
      }

      // 2. City filter check
      if (selectedCity) {
        const vendorCityRaw = vendor?.city || ord.city || (vendor as any)?.city_id;
        const cityName = getCityDisplayName(vendorCityRaw);
        if (cityName !== selectedCity) return false;
      }

      // 3. Manager filter check
      if (selectedManager) {
        const cleanSelected = String(selectedManager).trim().toLowerCase();
        const vendorManagerId = vendor?.manager_id || ord.manager_id;
        if (!vendorManagerId) return false;
        const cleanMid = String(vendorManagerId).trim().toLowerCase();
        if (cleanMid !== cleanSelected) return false;
      }

      // 4. Warehouse filter check
      if (selectedWarehouse) {
        const ordWh = ord.warehouse_id || vendor?.warehouse_id;
        if (ordWh !== selectedWarehouse) return false;
      }

      // 5. Search bar filter
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase().trim();
        const tradeName = (vendor?.trade_name || vendor?.company_name || ord.vendor_name || (ord as any).trade_name || (ord as any).company_name || '').toLowerCase();
        const compCode = (vendor?.id_code || (ord as any).id_code || '').toLowerCase();
        const docNum = (ord.doc_number || '').toLowerCase();
        const address = (vendor?.address || ord.address || '').toLowerCase();
        const factQty = String(ord.fact_qty !== undefined && ord.fact_qty !== null ? ord.fact_qty : (ord.qty_requested ?? ''));

        const matchesText = tradeName.includes(term) ||
          compCode.includes(term) ||
          docNum.includes(term) ||
          address.includes(term) ||
          factQty.includes(term);

        if (!matchesText) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.order_date || a.pickup_date_time || a.created_at || '';
      const dateB = b.order_date || b.pickup_date_time || b.created_at || '';
      return dateB.localeCompare(dateA);
    });
  }, [allCompletedOrders, startDate, endDate, selectedCity, selectedManager, selectedWarehouse, debouncedSearchTerm, cityMap]);

  // Aggregate factual quantity sum
  const totalFactQty = useMemo(() => {
    return filteredOrders.reduce((sum, o) => {
      const q = o.fact_qty !== undefined && o.fact_qty !== null ? Number(o.fact_qty) : Number(o.qty_requested || 0);
      return sum + (isNaN(q) ? 0 : q);
    }, 0);
  }, [filteredOrders]);

  // Trigger JWT evaluation and open export modal
  const handleInitiateExport = async () => {
    setIsCheckingJwt(true);
    setJwtError(null);
    try {
      const check = await verifyUserRoleAllowed(['admin', 'purchasing_head', 'manager']);
      if (!check.allowed) {
        setJwtError(check.error || 'ექსპორტი დაშვებულია მხოლოდ admin, purchasing_head და manager როლებისთვის.');
        return;
      }
      setVerifiedRole(check.role || 'manager');
      setShowExportModal(true);
    } catch (err: any) {
      setJwtError('ტოკენის ვალიდაცია ვერ მოხერხდა: ' + (err?.message || 'უცნობი შეცდომა'));
    } finally {
      setIsCheckingJwt(false);
    }
  };

  // Perform download to Excel
  const executeExcelDownload = () => {
    setIsExporting(true);
    try {
      const headerRow = [
        'კომპანიის დასახელება',
        'მისამართი',
        'გამოტანილი რაოდენობა',
        'თარიღი',
        'ქალაქი',
        'საწყობი',
        'მენეჯერი'
      ];

      const dataRows = filteredOrders.map(ord => {
        const vendor = findVendor(ord.vendor_id, ord);
        const tradeName = vendor?.trade_name || vendor?.company_name || ord.vendor_name || '-';
        const address = vendor?.address || ord.address || '';
        const rawQty = ord.fact_qty !== undefined && ord.fact_qty !== null ? Number(ord.fact_qty) : Number(ord.qty_requested || 0);
        const factQty = isNaN(rawQty) ? 0 : rawQty;
        const dateStr = formatDate(ord.order_date || ord.pickup_date_time || ord.created_at);
        const city = getCityDisplayName(vendor?.city || ord.city);
        const warehouse = getWarehouseDisplayName(vendor, ord);
        const manager = getManagerDisplayName(vendor, ord);

        return [
          tradeName,
          address,
          factQty,
          dateStr,
          city,
          warehouse,
          manager
        ];
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);

      ws['!cols'] = [
        { wch: 32 }, // კომპანიის დასახელება
        { wch: 38 }, // მისამართი
        { wch: 22 }, // გამოტანილი რაოდენობა
        { wch: 15 }, // თარიღი
        { wch: 18 }, // ქალაქი
        { wch: 20 }, // საწყობი
        { wch: 20 }, // მენეჯერი
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'გამოტანები');
      const fileName = `gamotanebi_${startDate || 'all'}_${endDate || 'all'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      setShowExportModal(false);
    } catch (exportErr) {
      console.error('Excel generation failed:', exportErr);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedManagerName = useMemo(() => {
    if (!selectedManager) return 'ყველა მენეჯერი';
    const mgr = users.find(u => u.id === selectedManager);
    return mgr ? mgr.name : selectedManager;
  }, [selectedManager, users]);

  const selectedWarehouseName = useMemo(() => {
    if (!selectedWarehouse) return 'ყველა საწყობი';
    return warehouseMap.get(selectedWarehouse) || selectedWarehouse;
  }, [selectedWarehouse, warehouseMap]);

  return (
    <div className="space-y-6">
      {/* CENTRALIZED PAGE HEADER WITH EXPORT ACTION */}
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Orders by Period")}</>}
        onBack={onBack}
        backButtonId="reports-orders-by-period-back"
        actions={
          <button
            type="button"
            onClick={handleInitiateExport}
            disabled={isCheckingJwt}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer select-none disabled:opacity-60"
          >
            {isCheckingJwt ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={15} />
            )}
            <span>ექსპორტი</span>
          </button>
        }
      />

      {/* FILTER BAR */}
      <div className="text-left">
        <div className="flex flex-wrap items-center gap-4">
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

          {/* Warehouse Filter (Seated between Manager and Search bar) */}
          <div className="relative min-w-[150px]">
            <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 font-sans uppercase tracking-wider">
              {t("Warehouse") || "საწყობი"}
            </span>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
            >
              <option value="">{t("All Warehouses") || "ყველა საწყობი"}</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
              ▼
            </div>
          </div>

          {/* Search Bar */}
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
                  {t("Warehouse") || "საწყობი"}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Manager")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {/* TOP SUMMARY ROW */}
              {filteredOrders.length > 0 && (
                <tr className="bg-emerald-50/80 text-emerald-950 font-bold border-b-2 border-emerald-500/80 select-none shadow-2xs">
                  <td className="py-3.5 px-4 font-black uppercase tracking-wide text-[10px] text-emerald-900">
                    {t("TOTAL SUMMARY") || "სულ ჯამი"}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-sm text-emerald-950 font-black">
                    {totalFactQty.toLocaleString()} ლ
                  </td>
                  <td className="py-3.5 px-4 text-xs text-emerald-800 font-semibold" colSpan={4}>
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
                const warehouseName = getWarehouseDisplayName(vendor, ord);
                const manager = getManagerDisplayName(vendor, ord);
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
                      {warehouseName}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {manager}
                    </td>
                  </tr>
                );
              })}

              {!isLoading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No records found.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECURITY ACCESS DENIED MODAL */}
      {jwtError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-4 text-left">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="font-bold text-base text-gray-900">წვდომა შეზღუდულია</h3>
                <p className="text-xs text-gray-500">JWT ტოკენის უსაფრთხოების შემოწმება</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-gray-100">
              {jwtError}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setJwtError(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT CONFIRMATION MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 space-y-5 text-left">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">ექსპორტი Excel-ში</h3>
                  <p className="text-xs text-gray-500">გამოტანები პერიოდის მიხედვით</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Role Verification Badge */}
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/80 px-3 py-2 rounded-xl border border-emerald-100">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>
                ტოკენით დამოწმებული როლი: <strong className="font-bold uppercase tracking-wider">{verifiedRole}</strong>
              </span>
            </div>

            {/* Filter Criteria Summary */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-gray-200 text-xs text-gray-700">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                აქტიური ფილტრები ექსპორტისთვის:
              </div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div>
                  <span className="text-gray-400 block text-[11px]">თარიღის დიაპაზონი:</span>
                  <span className="font-semibold font-mono text-gray-900">
                    {startDate || 'ყველა'} — {endDate || 'ყველა'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">ქალაქი:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedCity || 'ყველა ქალაქი'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">საწყობი:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedWarehouseName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">მენეჯერი:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedManagerName}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 mt-2 flex justify-between items-center">
                <span className="text-gray-500 font-medium">ექსპორტირებული ჩანაწერები:</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  {filteredOrders.length} შეკვეთა ({totalFactQty.toLocaleString()} ლ)
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                გაუქმება
              </button>
              <button
                type="button"
                onClick={executeExcelDownload}
                disabled={isExporting || filteredOrders.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer select-none disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                <span>Excel-ის ჩამოტვირთვა</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
