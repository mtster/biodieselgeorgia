import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Vendor, Order, User, City, District, Warehouse, Truck, VendorContact } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar, { SearchSuggestionItem } from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t, formatDate } from '../../utils/lang';
import { useDebounce } from '../../hooks/useDebounce';
import { getVendorsPaginated, getVendorContacts } from '../../services/vendorService';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users?: User[];
  cities?: City[];
  districts?: District[];
  warehouses?: Warehouse[];
  trucks?: Truck[];
  onBack: () => void;
}

export default function OrdersReport({
  suppliers,
  orders,
  users = [],
  cities = [],
  districts = [],
  warehouses = [],
  trucks = [],
  onBack,
}: Props) {
  // Default period filter to current date
  const getTodayStr = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  };

  const [startDate, setStartDate] = useState(getTodayStr);
  const [endDate, setEndDate] = useState(getTodayStr);
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

  // Synchronized scroll references
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const summaryContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (summaryContainerRef.current) {
      summaryContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    isSyncingScroll.current = false;
  };

  const handleSummaryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    isSyncingScroll.current = false;
  };

  const scrollLeftBy = (amount: number = 380) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: -amount, behavior: 'smooth' });
    }
  };

  const scrollRightBy = (amount: number = 380) => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // Contacts lookup cache
  const [contactsMap, setContactsMap] = useState<Map<string, VendorContact>>(() => {
    const map = new Map<string, VendorContact>();
    suppliers.forEach((s) => {
      (s.contacts || []).forEach((c) => map.set(c.id, c));
    });
    return map;
  });

  useEffect(() => {
    let isMounted = true;
    getVendorContacts()
      .then((contacts) => {
        if (isMounted && contacts && contacts.length > 0) {
          setContactsMap((prev) => {
            const next = new Map(prev);
            contacts.forEach((c) => next.set(c.id, c));
            return next;
          });
        }
      })
      .catch((err) => {
        console.warn('OrdersReport getVendorContacts catch:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeSuppliers = suppliers.filter((s) => !s.is_deleted);
  const activeWarehouses = (warehouses || []).filter((w) => !w.is_deleted);
  const activeOrders = orders.filter((o) => !o.is_deleted);

  // Helper to find vendor
  const findVendor = (vendorId?: string, order?: Order): Vendor | null => {
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    if (
      selectedVendorObj &&
      (selectedVendorObj.id === vendorId ||
        (selectedVendorObj.id && String(selectedVendorObj.id).trim().toLowerCase() === cleanId))
    ) {
      return selectedVendorObj;
    }
    const fromSuppliers = suppliers.find(
      (s) => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)
    );
    if (fromSuppliers) return fromSuppliers;
    return (
      remoteSuppliers.find(
        (s) => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)
      ) || null
    );
  };

  // Helper to resolve contact
  const getOrderContact = (
    order: Order,
    vendor?: Vendor | null
  ): { name?: string; phone?: string } | null => {
    if (order.contact_id && contactsMap.has(order.contact_id)) {
      const c = contactsMap.get(order.contact_id)!;
      return { name: c.name, phone: c.phone };
    }
    if (vendor?.contacts && vendor.contacts.length > 0) {
      if (order.contact_id) {
        const match = vendor.contacts.find((c) => c.id === order.contact_id);
        if (match) return { name: match.name, phone: match.phone };
      }
      const def = vendor.contacts.find((c) => c.is_default) || vendor.contacts[0];
      if (def) return { name: def.name, phone: def.phone };
    }
    return null;
  };

  // Helper to resolve warehouse name
  const getWarehouseName = (order: Order, vendor?: Vendor | null): string => {
    const wId = order.warehouse_id || vendor?.warehouse_id;
    if (!wId) return order.warehouse_name || '-';
    const found = warehouses.find((w) => w.id === wId);
    return found?.name || order.warehouse_name || '-';
  };

  // Helper to resolve transport / truck plate
  const getTruckPlate = (order: Order): string => {
    if (order.truck_plate) return order.truck_plate;
    if (order.vehicle_id) {
      const found = (trucks || []).find((t) => t.id === order.vehicle_id);
      if (found?.plate_number) return found.plate_number;
    }
    return '-';
  };

  // Helper to resolve driver name
  const getDriverName = (order: Order): string => {
    if (order.driver_name) return order.driver_name;
    if (order.driver_id) {
      const found = users.find(
        (u) => u.id === order.driver_id || (u as any).personal_id === order.driver_id
      );
      if (found?.name) return found.name;
    }
    return '-';
  };

  // Helper to resolve companion / assistant name
  const getCompanionName = (order: Order): string => {
    if (order.companion_name) return order.companion_name;
    if (order.companion_id) {
      const found = users.find(
        (u) => u.id === order.companion_id || (u as any).personal_id === order.companion_id
      );
      if (found?.name) return found.name;
    }
    return '-';
  };

  // Helper to resolve latest comment text
  const getCommentText = (order: Order, vendor?: Vendor | null): string => {
    if (order.notes && order.notes.length > 0) {
      const sorted = [...order.notes].sort((a, b) => {
        const tA = new Date(a.date).getTime() || 0;
        const tB = new Date(b.date).getTime() || 0;
        return tB - tA;
      });
      const latest = sorted[0];
      if (latest && latest.comment?.trim()) {
        return latest.comment.trim();
      }
    }
    if (order.note && order.note.trim()) {
      return order.note.trim();
    }
    const vendorNotes = (vendor as any)?.comments;
    if (Array.isArray(vendorNotes) && vendorNotes.length > 0) {
      const sortedV = [...vendorNotes].sort((a: any, b: any) => {
        const tA = new Date(a.date || a.created_at).getTime() || 0;
        const tB = new Date(b.date || b.created_at).getTime() || 0;
        return tB - tA;
      });
      const latestV = sortedV[0];
      if (latestV && latestV.comment?.trim()) {
        return latestV.comment.trim();
      }
    }
    return '-';
  };

  // Compute selected address badge for the search input
  const selectedAddress = useMemo(() => {
    if (selectedVendorObj && selectedVendorObj.address) {
      return selectedVendorObj.address;
    }
    if (!searchTerm) return '';
    const termLower = searchTerm.trim().toLowerCase();
    const match =
      suppliers.find(
        (s) =>
          s.trade_name?.trim().toLowerCase() === termLower ||
          s.company_name?.trim().toLowerCase() === termLower
      ) ||
      remoteSuppliers.find(
        (s) =>
          s.trade_name?.trim().toLowerCase() === termLower ||
          s.company_name?.trim().toLowerCase() === termLower
      );
    return match?.address || '';
  }, [selectedVendorObj, suppliers, remoteSuppliers, searchTerm]);

  // Remote fetching for suppliers autocomplete
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

    return Array.from(map.values()).map((s) => ({
      id: s.id,
      title: s.trade_name || s.company_name || '',
      subtitle: s.company_name,
      address: s.address,
    }));
  }, [searchTerm, activeSuppliers, remoteSuppliers, selectedVendorObj]);

  const searchSuggestions = useMemo(() => {
    return allSearchSuggestions.slice(0, displayLimit);
  }, [allSearchSuggestions, displayLimit]);

  const filterManagers = users.filter(
    (u) =>
      !u.is_deleted &&
      (u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'operator')
  );

  // Filter orders
  const filteredOrders = useMemo(() => {
    return activeOrders
      .filter((o) => {
        // Period filter (compares pickup_date_time, order_date, or created_at)
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

        // Region filter
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
          const doc = (o.doc_number || '').toLowerCase();
          const matchingRemoteIds = new Set(
            remoteSuppliers
              .filter((rs) => {
                const rTrade = (rs.trade_name || '').toLowerCase();
                const rComp = (rs.company_name || '').toLowerCase();
                const rAddr = (rs.address || '').toLowerCase();
                return rTrade.includes(term) || rComp.includes(term) || rAddr.includes(term);
              })
              .map((rs) => rs.id)
          );

          if (
            !trade.includes(term) &&
            !comp.includes(term) &&
            !addr.includes(term) &&
            !doc.includes(term) &&
            !matchingRemoteIds.has(o.vendor_id)
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.pickup_date_time || a.order_date || a.created_at || '';
        const dateB = b.pickup_date_time || b.order_date || b.created_at || '';
        return dateB.localeCompare(dateA);
      });
  }, [
    activeOrders,
    startDate,
    endDate,
    selectedWarehouse,
    selectedCity,
    selectedDistrict,
    selectedManager,
    selectedVendorId,
    searchTerm,
    remoteSuppliers,
    suppliers,
    selectedVendorObj,
  ]);

  // Aggregate summary totals
  const totalPlannedQty = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.qty_requested || 0), 0);
  }, [filteredOrders]);

  const totalPlannedPickup = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.tanks_to_bring || 0), 0);
  }, [filteredOrders]);

  const totalPlannedDropoff = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.tanks_to_leave || 0), 0);
  }, [filteredOrders]);

  const totalFactQty = useMemo(() => {
    return filteredOrders.reduce((sum, o) => {
      const q = o.fact_qty !== undefined && o.fact_qty !== null ? o.fact_qty : 0;
      return sum + q;
    }, 0);
  }, [filteredOrders]);

  const totalFactPickup = useMemo(() => {
    return filteredOrders.reduce((sum, o) => {
      const p = o.fact_tank_pickup !== undefined && o.fact_tank_pickup !== null ? o.fact_tank_pickup : 0;
      return sum + p;
    }, 0);
  }, [filteredOrders]);

  const totalFactDropoff = useMemo(() => {
    return filteredOrders.reduce((sum, o) => {
      const d = o.fact_tank_dropoff !== undefined && o.fact_tank_dropoff !== null ? o.fact_tank_dropoff : 0;
      return sum + d;
    }, 0);
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
      {/* Custom Scrollbar Styles for persistent horizontal scrolling */}
      <style>{`
        .orders-table-scroll::-webkit-scrollbar {
          height: 12px;
        }
        .orders-table-scroll::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }
        .orders-table-scroll::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 6px;
        }
        .orders-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>

      <PageHeader
        title={
          <>
            {t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("შეკვეთები")}
          </>
        }
        onBack={onBack}
        backButtonId="reports-orders-back"
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
                  const found = remoteSuppliers.find((s) => s.id === item.id) || suppliers.find((s) => s.id === item.id);
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
                    options: activeWarehouses.map((w) => ({ value: w.id, label: w.name })),
                  },
                  {
                    label: t('City'),
                    value: selectedCity,
                    placeholder: t('All Cities'),
                    onChange: (val) => {
                      setSelectedCity(val);
                      setSelectedDistrict('');
                    },
                    options: cities.map((c) => ({ value: c.name, label: c.name })),
                  },
                  {
                    label: t('Region'),
                    value: selectedDistrict,
                    placeholder: t('All Regions'),
                    onChange: setSelectedDistrict,
                    options: districts
                      .filter((d) => !selectedCity || d.city_id === cities.find((c) => c.name === selectedCity)?.id)
                      .map((d) => ({ value: d.name, label: d.name })),
                  },
                  {
                    label: t('Manager'),
                    value: selectedManager,
                    placeholder: t('All Managers'),
                    onChange: setSelectedManager,
                    options: filterManagers.map((m) => ({ value: m.id, label: m.name })),
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE DATA SPREADSHEET CANVAS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        {/* Table Header Action Bar with Quick Scroll Buttons */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">15 სვეტი (15 Columns)</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">გადაახვიეთ ჰორიზონტალურად ყველა მონაცემის სანახავად</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => scrollLeftBy(380)}
              className="p-1 rounded hover:bg-slate-100 text-gray-600 hover:text-gray-900 transition-colors"
              title="გადახვევა მარცხნივ (Scroll Left)"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => scrollRightBy(380)}
              className="p-1 rounded hover:bg-slate-100 text-gray-600 hover:text-gray-900 transition-colors"
              title="გადახვევა მარჯვნივ (Scroll Right)"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* 1. Main Table Container (Header + Data Rows) with permanent scrollbar */}
        <div
          ref={tableContainerRef}
          onScroll={handleTableScroll}
          className="overflow-x-scroll w-full orders-table-scroll"
          style={{
            scrollbarWidth: 'auto',
            scrollbarColor: '#94a3b8 #f1f5f9',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <table className="w-[2270px] min-w-[2270px] text-left border-collapse table-fixed">
            <colgroup>
              <col style={{ width: 260 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 170 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr className="select-none bg-slate-50 border-b border-gray-200">
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("კომპანიის დასახელება")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("საწყობი")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("კონტაქტი")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("დოკუმენტის კოდი")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("შეკვეთის გატანის თარიღი")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap text-right">
                  {t("გეგმ. რაოდენობა(ლ)")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap text-right">
                  {t("გამოტანა")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap text-right">
                  {t("დატოვება")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap text-right">
                  {t("ფაქტ. რაოდენობა(ლ)")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap text-right">
                  {t("ფაქტ. გამოტანა")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap text-right">
                  {t("ფაქტ. დატოვება")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("კომენტარი")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("ტრანსპორტი")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("მძღოლი")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider whitespace-nowrap">
                  {t("დამხმარე")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredOrders.map((ord) => {
                const vendor = findVendor(ord.vendor_id, ord);
                const tradeName = vendor?.trade_name || vendor?.company_name || ord.vendor_name || '-';
                const address = vendor?.address || ord.address || '';
                const warehouseName = getWarehouseName(ord, vendor);
                const contact = getOrderContact(ord, vendor);
                const pickupDateFormatted = formatDate(ord.pickup_date_time || ord.order_date);
                const commentText = getCommentText(ord, vendor);
                const truckPlate = getTruckPlate(ord);
                const driverName = getDriverName(ord);
                const companionName = getCompanionName(ord);

                const plannedQtyFormatted =
                  ord.qty_requested !== undefined && ord.qty_requested !== null
                    ? `${ord.qty_requested.toLocaleString()} L`
                    : '0 L';

                const factQtyFormatted =
                  ord.fact_qty !== undefined && ord.fact_qty !== null
                    ? `${ord.fact_qty.toLocaleString()} L`
                    : '-';

                return (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                    {/* 1. კომპანიის დასახელება (with address) */}
                    <td className="py-3.5 px-4 overflow-hidden">
                      <div className="font-semibold text-gray-900 text-xs truncate" title={tradeName}>
                        {tradeName}
                      </div>
                      {address && (
                        <div className="text-[11px] text-gray-400 font-normal truncate mt-0.5" title={address}>
                          {address}
                        </div>
                      )}
                    </td>

                    {/* 2. საწყობი */}
                    <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap truncate overflow-hidden" title={warehouseName}>
                      {warehouseName}
                    </td>

                    {/* 3. კონტაქტი */}
                    <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap overflow-hidden">
                      {contact ? (
                        <div>
                          {contact.name && <div className="font-semibold text-gray-900 text-xs truncate" title={contact.name}>{contact.name}</div>}
                          {contact.phone && <div className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">{contact.phone}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-300 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* 4. დოკუმენტის კოდი */}
                    <td className="py-3.5 px-4 font-mono font-medium text-gray-700 whitespace-nowrap text-xs">
                      {ord.doc_number ? `#${ord.doc_number}` : '-'}
                    </td>

                    {/* 5. შეკვეთის გატანის თარიღი */}
                    <td className="py-3.5 px-4 font-mono text-gray-600 whitespace-nowrap text-xs">
                      {pickupDateFormatted}
                    </td>

                    {/* 6. გეგმ. რაოდენობა(ლ) */}
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-800 text-right whitespace-nowrap">
                      {plannedQtyFormatted}
                    </td>

                    {/* 7. გამოტანა */}
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-800 text-right whitespace-nowrap">
                      {ord.tanks_to_bring !== undefined && ord.tanks_to_bring !== null ? ord.tanks_to_bring : 0}
                    </td>

                    {/* 8. დატოვება */}
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-800 text-right whitespace-nowrap">
                      {ord.tanks_to_leave !== undefined && ord.tanks_to_leave !== null ? ord.tanks_to_leave : 0}
                    </td>

                    {/* 9. ფაქტ. რაოდენობა(ლ) */}
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-850 text-right whitespace-nowrap">
                      {factQtyFormatted}
                    </td>

                    {/* 10. ფაქტ. გამოტანა */}
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-900 text-right whitespace-nowrap">
                      {ord.fact_tank_pickup !== undefined && ord.fact_tank_pickup !== null ? ord.fact_tank_pickup : '-'}
                    </td>

                    {/* 11. ფაქტ. დატოვება */}
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-900 text-right whitespace-nowrap">
                      {ord.fact_tank_dropoff !== undefined && ord.fact_tank_dropoff !== null ? ord.fact_tank_dropoff : '-'}
                    </td>

                    {/* 12. კომენტარი */}
                    <td className="py-3.5 px-4 text-xs text-gray-700 overflow-hidden">
                      {commentText && commentText !== '-' ? (
                        <div className="truncate" title={commentText}>
                          {commentText}
                        </div>
                      ) : (
                        <span className="text-gray-300 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* 13. ტრანსპორტი */}
                    <td className="py-3.5 px-4 font-mono text-gray-700 whitespace-nowrap text-xs truncate" title={truckPlate}>
                      {truckPlate}
                    </td>

                    {/* 14. მძღოლი */}
                    <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap text-xs truncate" title={driverName}>
                      {driverName}
                    </td>

                    {/* 15. დამხმარე */}
                    <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap text-xs truncate" title={companionName}>
                      {companionName}
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={15} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No records found.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 2. SUMMARY ROW CONTAINER (Positioned directly below horizontal scrollbar, synchronized with table scroll) */}
        {filteredOrders.length > 0 && (
          <div
            ref={summaryContainerRef}
            onScroll={handleSummaryScroll}
            className="overflow-x-auto w-full bg-emerald-50/40 border-t-2 border-emerald-500 select-none orders-table-scroll"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <table className="w-[2270px] min-w-[2270px] text-left border-collapse table-fixed">
              <colgroup>
                <col style={{ width: 260 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 260 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
              </colgroup>
              <tbody>
                <tr className="text-emerald-900 font-bold text-xs">
                  {/* 1. Total summary */}
                  <td className="py-3.5 px-4 font-bold uppercase tracking-wide text-[10px]">
                    {t("TOTAL SUMMARY")}
                    <span className="text-[11px] text-emerald-700 font-normal block">
                      {filteredOrders.length} {t("records")}
                    </span>
                  </td>

                  {/* 2. საწყობი */}
                  <td className="py-3.5 px-4"></td>

                  {/* 3. კონტაქტი */}
                  <td className="py-3.5 px-4"></td>

                  {/* 4. დოკუმენტის კოდი */}
                  <td className="py-3.5 px-4"></td>

                  {/* 5. შეკვეთის გატანის თარიღი */}
                  <td className="py-3.5 px-4"></td>

                  {/* 6. გეგმ. რაოდენობა(ლ) */}
                  <td className="py-3.5 px-4 font-mono text-sm text-gray-950 font-bold text-right whitespace-nowrap">
                    {totalPlannedQty.toLocaleString()} L
                  </td>

                  {/* 7. გამოტანა */}
                  <td className="py-3.5 px-4 font-mono text-sm text-sky-900 font-bold text-right whitespace-nowrap">
                    {totalPlannedPickup}
                  </td>

                  {/* 8. დატოვება */}
                  <td className="py-3.5 px-4 font-mono text-sm text-amber-900 font-bold text-right whitespace-nowrap">
                    {totalPlannedDropoff}
                  </td>

                  {/* 9. ფაქტ. რაოდენობა(ლ) */}
                  <td className="py-3.5 px-4 font-mono text-sm text-emerald-950 font-bold text-right whitespace-nowrap">
                    {totalFactQty.toLocaleString()} L
                  </td>

                  {/* 10. ფაქტ. გამოტანა */}
                  <td className="py-3.5 px-4 font-mono text-sm text-sky-950 font-bold text-right whitespace-nowrap">
                    {totalFactPickup}
                  </td>

                  {/* 11. ფაქტ. დატოვება */}
                  <td className="py-3.5 px-4 font-mono text-sm text-amber-950 font-bold text-right whitespace-nowrap">
                    {totalFactDropoff}
                  </td>

                  {/* 12. კომენტარი */}
                  <td className="py-3.5 px-4"></td>

                  {/* 13. ტრანსპორტი */}
                  <td className="py-3.5 px-4"></td>

                  {/* 14. მძღოლი */}
                  <td className="py-3.5 px-4"></td>

                  {/* 15. დამხმარე */}
                  <td className="py-3.5 px-4"></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
