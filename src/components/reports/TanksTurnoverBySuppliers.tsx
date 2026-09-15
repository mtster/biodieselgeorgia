import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ArrowUpDown } from 'lucide-react';
import { Vendor, Order, User, City, District, Warehouse } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar, { SearchSuggestionItem } from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t } from '../../utils/lang';
import { useDebounce } from '../../hooks/useDebounce';
import { getVendorsPaginated } from '../../services/vendorService';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  cities: City[];
  districts: District[];
  warehouses?: Warehouse[];
  onBack: () => void;
}

interface VendorTurnoverRow {
  vendorId: string;
  tradeName: string;
  companyName?: string;
  address?: string;
  totalQty: number;      // რაოდენობა(ლ)
  totalPickup: number;   // გამოტანა (fact_tank_pickup)
  totalDropoff: number;  // დატოვება (fact_tank_dropoff)
  ordersCount: number;
}

export default function TanksTurnoverBySuppliers({
  suppliers,
  orders,
  users,
  cities,
  districts,
  warehouses = [],
  onBack,
}: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 250);
  const [remoteSuppliers, setRemoteSuppliers] = useState<Vendor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [remoteOffset, setRemoteOffset] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(5);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedVendorObj, setSelectedVendorObj] = useState<Vendor | null>(null);
  const [sortBy, setSortBy] = useState<'trade_name' | 'qty' | 'pickup' | 'dropoff'>('qty');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Active suppliers, warehouses, and completed orders
  const activeSuppliers = suppliers.filter(s => !s.is_deleted);
  const activeWarehouses = (warehouses || []).filter(w => !w.is_deleted);
  const completedOrders = orders.filter(o => 
    !o.is_deleted && 
    (o.status === 'completed' || String(o.status).toLowerCase() === 'completed')
  );

  // Helper to find vendor across local cached suppliers, remote fetched suppliers, or currently selected vendor
  const findVendor = (vendorId?: string, order?: Order): Vendor | null => {
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    if (selectedVendorObj && (selectedVendorObj.id === vendorId || (selectedVendorObj.id && String(selectedVendorObj.id).trim().toLowerCase() === cleanId))) {
      return selectedVendorObj;
    }
    const fromSuppliers = suppliers.find(s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId));
    if (fromSuppliers) return fromSuppliers;
    return remoteSuppliers.find(s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)) || null;
  };

  // Compute selected address badge for the search input
  const selectedAddress = useMemo(() => {
    if (selectedVendorObj && selectedVendorObj.address) {
      return selectedVendorObj.address;
    }
    if (!searchTerm) return '';
    const termLower = searchTerm.trim().toLowerCase();
    const match = suppliers.find(
      (s) =>
        s.trade_name?.trim().toLowerCase() === termLower ||
        s.company_name?.trim().toLowerCase() === termLower
    ) || remoteSuppliers.find(
      (s) =>
        s.trade_name?.trim().toLowerCase() === termLower ||
        s.company_name?.trim().toLowerCase() === termLower
    );
    return match?.address || '';
  }, [selectedVendorObj, suppliers, remoteSuppliers, searchTerm]);

  // Remote fetching for suppliers (fetching 5 at a time, identical to DeliveredOrdersBySuppliers)
  useEffect(() => {
    let isMounted = true;
    const term = debouncedSearch.trim();

    if (!term) {
      setRemoteSuppliers((prev) => (prev.length > 0 ? [] : prev));
      setIsSearching(false);
      setIsLoadingMore(false);
      setHasMore(false);
      setRemoteOffset(0);
      setDisplayLimit(5);
      return;
    }

    if (selectedVendorObj) {
      const matchTrade = (selectedVendorObj.trade_name || '').trim().toLowerCase();
      const matchComp = (selectedVendorObj.company_name || '').trim().toLowerCase();
      const termLower = term.toLowerCase();
      if (termLower === matchTrade || termLower === matchComp) {
        setIsSearching(false);
        setIsLoadingMore(false);
        setHasMore(false);
        return;
      }
    }

    setIsSearching(true);
    setRemoteOffset(0);
    setDisplayLimit(5);

    getVendorsPaginated(5, 0, { searchTerm: term }, { includeContacts: false })
      .then((res) => {
        if (isMounted) {
          const fetched = res.vendors || [];
          setRemoteSuppliers(fetched);
          setRemoteOffset(fetched.length);
          setHasMore(fetched.length === 5 && (res.totalCount ? fetched.length < res.totalCount : true));
          setIsSearching(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch autocomplete suppliers', err);
        if (isMounted) {
          setIsSearching(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, selectedVendorObj]);

  // Load next 5 suppliers on scrolling to the bottom of the dropdown
  const handleLoadMore = () => {
    if (isLoadingMore || isSearching) return;

    if (displayLimit < allSearchSuggestions.length) {
      setDisplayLimit((prev) => prev + 5);
    }

    if (hasMore) {
      const term = debouncedSearch.trim();
      if (!term) return;

      setIsLoadingMore(true);
      getVendorsPaginated(5, remoteOffset, { searchTerm: term }, { includeContacts: false })
        .then((res) => {
          const fetched = res.vendors || [];
          setRemoteSuppliers((prev) => {
            const ids = new Set(prev.map((v) => v.id));
            const newVendors = fetched.filter((v) => !ids.has(v.id));
            return [...prev, ...newVendors];
          });
          setRemoteOffset((prev) => prev + fetched.length);
          setDisplayLimit((prev) => prev + 5);
          setHasMore(fetched.length === 5 && (res.totalCount ? remoteOffset + fetched.length < res.totalCount : true));
          setIsLoadingMore(false);
        })
        .catch((err) => {
          console.warn('Failed to load more autocomplete suppliers', err);
          setIsLoadingMore(false);
        });
    }
  };

  // Autocomplete search suggestions (cached + remote)
  const allSearchSuggestions: SearchSuggestionItem[] = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    const map = new Map<string, Vendor>();

    if (selectedVendorObj) {
      const trade = (selectedVendorObj.trade_name || '').toLowerCase();
      const comp = (selectedVendorObj.company_name || '').toLowerCase();
      const addr = (selectedVendorObj.address || '').toLowerCase();
      if (!term || trade.includes(term) || comp.includes(term) || addr.includes(term)) {
        map.set(selectedVendorObj.id, selectedVendorObj);
      }
    }

    activeSuppliers.forEach((s) => {
      const trade = (s.trade_name || '').toLowerCase();
      const comp = (s.company_name || '').toLowerCase();
      const code = (s.id_code || '').toLowerCase();
      const addr = (s.address || '').toLowerCase();
      if (trade.includes(term) || comp.includes(term) || code.includes(term) || addr.includes(term)) {
        map.set(s.id, s);
      }
    });

    remoteSuppliers.forEach((s) => {
      map.set(s.id, s);
    });

    return Array.from(map.values())
      .map((s) => ({
        id: s.id,
        title: s.trade_name || s.company_name || '',
        subtitle: s.company_name,
        address: s.address,
      }));
  }, [searchTerm, activeSuppliers, remoteSuppliers, selectedVendorObj]);

  const searchSuggestions = useMemo(() => {
    return allSearchSuggestions.slice(0, displayLimit);
  }, [allSearchSuggestions, displayLimit]);

  // Managers list for dropdown filter
  const filterManagers = users.filter(
    u => !u.is_deleted && (u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'operator')
  );

  // Filter completed orders exactly identical to DeliveredOrdersBySuppliers
  const filteredOrders = useMemo(() => {
    return completedOrders.filter(o => {
      // Period filter
      if (startDate || endDate) {
        const oDateStr = o.pickup_date_time || o.order_date || o.created_at;
        if (oDateStr) {
          const datePart = oDateStr.split('T')[0];
          if (startDate && datePart < startDate) return false;
          if (endDate && datePart > endDate) return false;
        }
      }

      const vendor = findVendor(o.vendor_id, o);

      // Warehouse filter
      if (selectedWarehouse) {
        const orderWarehouseId = o.warehouse_id || vendor?.warehouse_id;
        if (orderWarehouseId !== selectedWarehouse) return false;
      }

      // City filter
      const cityVal = vendor?.city || o.city || '';
      if (selectedCity && cityVal !== selectedCity) return false;

      // Region/District filter
      const districtVal = vendor?.district || o.district || '';
      if (selectedDistrict && districtVal !== selectedDistrict) return false;

      // Manager filter
      const managerId = vendor?.manager_id || o.operator_id || o.created_by;
      if (selectedManager && managerId !== selectedManager) return false;

      // Search filter
      if (selectedVendorId) {
        if (o.vendor_id !== selectedVendorId) return false;
      } else if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const trade = (vendor?.trade_name || o.vendor_name || '').toLowerCase();
        const comp = (vendor?.company_name || '').toLowerCase();
        const addr = (vendor?.address || o.address || '').toLowerCase();
        const code = (vendor?.id_code || '').toLowerCase();
        const matchingRemoteIds = new Set(
          remoteSuppliers
            .filter(rs => {
              const rTrade = (rs.trade_name || '').toLowerCase();
              const rComp = (rs.company_name || '').toLowerCase();
              const rAddr = (rs.address || '').toLowerCase();
              const rCode = (rs.id_code || '').toLowerCase();
              return rTrade.includes(term) || rComp.includes(term) || rAddr.includes(term) || rCode.includes(term);
            })
            .map(rs => rs.id)
        );

        if (!trade.includes(term) && !comp.includes(term) && !addr.includes(term) && !code.includes(term) && !matchingRemoteIds.has(o.vendor_id)) {
          return false;
        }
      }

      return true;
    });
  }, [completedOrders, startDate, endDate, selectedWarehouse, selectedCity, selectedDistrict, selectedManager, selectedVendorId, searchTerm, remoteSuppliers, suppliers, selectedVendorObj]);

  // Aggregate factual quantity, factual pickup, factual dropoff per individual vendor
  const turnoverRows = useMemo(() => {
    const map = new Map<string, VendorTurnoverRow>();

    filteredOrders.forEach((o) => {
      const vId = o.vendor_id || 'unknown';
      const vendor = findVendor(o.vendor_id, o);
      const tradeName = vendor?.trade_name || vendor?.company_name || o.vendor_name || t('Unnamed Supplier');
      const companyName = vendor?.company_name;
      const address = vendor?.address || o.address;

      const qty = o.fact_qty !== undefined && o.fact_qty !== null ? Number(o.fact_qty) : Number(o.qty_requested || 0);
      const pickup = o.fact_tank_pickup !== undefined && o.fact_tank_pickup !== null ? Number(o.fact_tank_pickup) : Number(o.tanks_to_bring || 0);
      const dropoff = o.fact_tank_dropoff !== undefined && o.fact_tank_dropoff !== null ? Number(o.fact_tank_dropoff) : Number(o.tanks_to_leave || 0);

      const existing = map.get(vId);
      if (existing) {
        existing.totalQty += (isNaN(qty) ? 0 : qty);
        existing.totalPickup += (isNaN(pickup) ? 0 : pickup);
        existing.totalDropoff += (isNaN(dropoff) ? 0 : dropoff);
        existing.ordersCount += 1;
      } else {
        map.set(vId, {
          vendorId: vId,
          tradeName,
          companyName,
          address,
          totalQty: isNaN(qty) ? 0 : qty,
          totalPickup: isNaN(pickup) ? 0 : pickup,
          totalDropoff: isNaN(dropoff) ? 0 : dropoff,
          ordersCount: 1,
        });
      }
    });

    // If a specific vendor is selected or searched, ensure it appears even if it had 0 flow in this period
    if (selectedVendorObj && !map.has(selectedVendorObj.id)) {
      map.set(selectedVendorObj.id, {
        vendorId: selectedVendorObj.id,
        tradeName: selectedVendorObj.trade_name || selectedVendorObj.company_name || t('Unnamed Supplier'),
        companyName: selectedVendorObj.company_name,
        address: selectedVendorObj.address,
        totalQty: 0,
        totalPickup: 0,
        totalDropoff: 0,
        ordersCount: 0,
      });
    }

    const rows = Array.from(map.values());

    // Sort rows
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'trade_name') {
        cmp = a.tradeName.localeCompare(b.tradeName, 'ka');
      } else if (sortBy === 'qty') {
        cmp = a.totalQty - b.totalQty;
      } else if (sortBy === 'pickup') {
        cmp = a.totalPickup - b.totalPickup;
      } else if (sortBy === 'dropoff') {
        cmp = a.totalDropoff - b.totalDropoff;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return rows;
  }, [filteredOrders, selectedVendorObj, sortBy, sortOrder]);

  // Overall totals across all filtered vendors
  const totalSummary = useMemo(() => {
    return turnoverRows.reduce(
      (acc, r) => {
        acc.qty += r.totalQty;
        acc.pickup += r.totalPickup;
        acc.dropoff += r.totalDropoff;
        return acc;
      },
      { qty: 0, pickup: 0, dropoff: 0 }
    );
  }, [turnoverRows]);

  const handleSort = (field: 'trade_name' | 'qty' | 'pickup' | 'dropoff') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'trade_name' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Tanks Turnover by Suppliers")}</>}
        onBack={onBack}
        backButtonId="reports-turnover-back"
      />

      {/* FILTER BAR DESIGNS - IDENTICAL TO DeliveredOrdersBySuppliers */}
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
                onSearchChange={(val) => {
                  setSearchTerm(val);
                  if (!val) {
                    setSelectedVendorId(null);
                    setSelectedVendorObj(null);
                  } else if (selectedVendorObj) {
                    const matchTrade = (selectedVendorObj.trade_name || '').trim().toLowerCase();
                    const matchComp = (selectedVendorObj.company_name || '').trim().toLowerCase();
                    const valLower = val.trim().toLowerCase();
                    if (valLower !== matchTrade && valLower !== matchComp) {
                      setSelectedVendorId(null);
                      setSelectedVendorObj(null);
                    }
                  }
                }}
                suggestions={searchSuggestions}
                isSearching={isSearching}
                isLoadingMore={isLoadingMore}
                onLoadMore={handleLoadMore}
                selectedAddress={selectedAddress}
                onSelectSuggestion={(item) => {
                  setSearchTerm(item.title);
                  setSelectedVendorId(item.id);
                  const found = remoteSuppliers.find(s => s.id === item.id) || suppliers.find(s => s.id === item.id);
                  if (found) {
                    setSelectedVendorObj(found);
                  } else if (item.address) {
                    setSelectedVendorObj({
                      id: item.id,
                      trade_name: item.title,
                      address: item.address,
                      is_deleted: false,
                    } as Vendor);
                  }
                }}
                searchPlaceholder={t("Search suppliers by name, legal entity or taxation credentials...")}
                filters={[
                  {
                    label: t('Warehouse'),
                    value: selectedWarehouse,
                    placeholder: t('All Warehouses'),
                    onChange: setSelectedWarehouse,
                    options: activeWarehouses.map(w => ({ value: w.id, label: w.name })),
                  },
                  {
                    label: t('City'),
                    value: selectedCity,
                    placeholder: t('All Cities'),
                    onChange: (val) => {
                      setSelectedCity(val);
                      setSelectedDistrict('');
                    },
                    options: cities.map(c => ({ value: c.name, label: c.name })),
                  },
                  {
                    label: t('Region'),
                    value: selectedDistrict,
                    placeholder: t('All Regions'),
                    onChange: setSelectedDistrict,
                    options: districts
                      .filter(d => !selectedCity || d.city_id === cities.find(c => c.name === selectedCity)?.id)
                      .map(d => ({ value: d.name, label: d.name })),
                  },
                  {
                    label: t('Manager'),
                    value: selectedManager,
                    placeholder: t('All Managers'),
                    onChange: setSelectedManager,
                    options: filterManagers.map(m => ({ value: m.id, label: m.name })),
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE: კომპანიის დასახელება(trade_name), რაოდენობა(ლ), გამოტანა, დატოვება */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="select-none bg-slate-50 border-b border-gray-200">
                <th 
                  onClick={() => handleSort('trade_name')}
                  className="py-3.5 px-4 text-[11px] text-gray-500 uppercase font-sans font-bold tracking-wider cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>{t("კომპანიის დასახელება(trade_name)")}</span>
                    <ArrowUpDown size={12} className="text-gray-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('qty')}
                  className="py-3.5 px-4 text-[11px] text-gray-500 uppercase font-sans font-bold tracking-wider text-right cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{t("რაოდენობა(ლ)")}</span>
                    <ArrowUpDown size={12} className="text-gray-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('pickup')}
                  className="py-3.5 px-4 text-[11px] text-gray-500 uppercase font-sans font-bold tracking-wider text-right cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{t("გამოტანა")}</span>
                    <ArrowUpDown size={12} className="text-gray-400" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('dropoff')}
                  className="py-3.5 px-4 text-[11px] text-gray-500 uppercase font-sans font-bold tracking-wider text-right cursor-pointer hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{t("დატოვება")}</span>
                    <ArrowUpDown size={12} className="text-gray-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {turnoverRows.map((row) => (
                <tr key={row.vendorId} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-gray-900 text-xs">
                      {row.tradeName}
                    </div>
                    {row.address && (
                      <div className="text-[11px] text-gray-400 font-normal truncate max-w-[320px] mt-0.5" title={row.address}>
                        {row.address}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-800 text-right">
                    {row.totalQty.toLocaleString()} L
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-sky-800 text-right">
                    {row.totalPickup}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-amber-800 text-right">
                    {row.totalDropoff}
                  </td>
                </tr>
              ))}

              {turnoverRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No matching supplier records found for tank turnovers.")}
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {turnoverRows.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-950 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4">
                    <span className="uppercase tracking-wider text-[10px] text-emerald-900 font-bold block">
                      {t("TOTAL SUMMARY")}
                    </span>
                    <span className="text-[11px] text-emerald-700 font-normal">
                      {turnoverRows.length} {t("active suppliers")}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-emerald-950 font-black">
                    {totalSummary.qty.toLocaleString()} L
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-sky-950 font-black">
                    {totalSummary.pickup}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-amber-950 font-black">
                    {totalSummary.dropoff}
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

