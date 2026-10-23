import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Vendor, Order, User, Truck, Communication, Warehouse } from '../../types';
import { 
  Building2, ShoppingBag, Truck as TruckIcon, 
  Users, Fuel, Calendar, HelpCircle, User as UserIcon, ChevronDown,
  Search, X, Clock
} from 'lucide-react';
import { t, formatDate } from '../../utils/lang';
import { getActiveOrdersCount } from '../../lib/db';
import { getDashboardTodayRemindersPaginated } from '../../services/dashboardRemindersService';
import { useDebouncedSearch } from '../../hooks/useDebounce';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { onRealtimeDbChange } from '../../lib/realtime';

interface Props {
  suppliers: Vendor[]; // Pass vendors from parent App
  totalSuppliersCount?: number;
  activeOrdersCount?: number;
  orders: Order[];
  employees: User[];   // Pass users from parent App
  trucks: Truck[];
  warehouses?: Warehouse[];
  communications?: Communication[];
  currentUser?: User;
  onNavigate: (tab: string) => void;
  onSelectReminder?: (comm: Communication) => void;
  onSelectOrder?: (order: Order) => void;
  onSelectVendor?: (vendorId: string, vendor?: Vendor) => void;
}

// Module-level in-memory cache to prevent redundant fetches and recalculation across page changes
interface DashboardMemoryCache {
  dateStr: string;
  completedOrders: Order[];
  totalCompletedCount: number;
  todayActiveOrdersCount: number;
  vendorLookup: Record<string, { trade_name: string; company_name?: string; address: string }>;
  remindersByFilter: Record<string, { reminders: Communication[]; totalCount: number; timestamp: number }>;
  timestamp: number;
}

const dashboardCache: DashboardMemoryCache = {
  dateStr: '',
  completedOrders: [],
  totalCompletedCount: 0,
  todayActiveOrdersCount: 0,
  vendorLookup: {},
  remindersByFilter: {},
  timestamp: 0
};

let inFlightDashboardPromise: Promise<void> | null = null;

export default function DashboardView({ 
  suppliers, 
  totalSuppliersCount, 
  activeOrdersCount,
  orders, 
  employees, 
  trucks, 
  warehouses = [],
  communications = [], 
  currentUser,
  onNavigate,
  onSelectReminder,
  onSelectOrder,
  onSelectVendor
}: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const todayDateStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const isCacheValidForToday = dashboardCache.dateStr === todayDateStr && dashboardCache.timestamp > 0;

  const [dbCompletedOrders, setDbCompletedOrders] = useState<Order[]>(() => 
    isCacheValidForToday ? dashboardCache.completedOrders : []
  );
  const [totalCompletedOrdersCount, setTotalCompletedOrdersCount] = useState<number>(() => 
    isCacheValidForToday ? dashboardCache.totalCompletedCount : 0
  );
  const [isLoadingCompletedOrders, setIsLoadingCompletedOrders] = useState<boolean>(() => 
    !isCacheValidForToday
  );
  const [isLoadingMoreCompletedOrders, setIsLoadingMoreCompletedOrders] = useState<boolean>(false);
  const [vendorLookup, setVendorLookup] = useState<Record<string, { trade_name: string; company_name?: string; address: string }>>(() => 
    isCacheValidForToday ? dashboardCache.vendorLookup : {}
  );
  const [todayActiveOrdersCount, setTodayActiveOrdersCount] = useState<number>(() => 
    isCacheValidForToday ? (dashboardCache.todayActiveOrdersCount || 0) : 0
  );

  // Fetch today's orders directly with vendor relation to guarantee trade_name and address
  const fetchTodayOrdersData = useCallback(async (force = false) => {
    const isFresh = dashboardCache.dateStr === todayDateStr && dashboardCache.timestamp > 0 && (Date.now() - dashboardCache.timestamp < 180000);
    if (!force && isFresh) {
      setDbCompletedOrders(dashboardCache.completedOrders);
      setTotalCompletedOrdersCount(dashboardCache.totalCompletedCount);
      setVendorLookup(dashboardCache.vendorLookup);
      setTodayActiveOrdersCount(dashboardCache.todayActiveOrdersCount);
      setIsLoadingCompletedOrders(false);
      return;
    }

    if (inFlightDashboardPromise) {
      await inFlightDashboardPromise;
      setDbCompletedOrders(dashboardCache.completedOrders);
      setTotalCompletedOrdersCount(dashboardCache.totalCompletedCount);
      setVendorLookup(dashboardCache.vendorLookup);
      setTodayActiveOrdersCount(dashboardCache.todayActiveOrdersCount);
      setIsLoadingCompletedOrders(false);
      return;
    }

    if (isSupabaseConfigured && supabase) {
      inFlightDashboardPromise = (async () => {
        try {
          setIsLoadingCompletedOrders(true);
          // Instantaneous count using head: true
          const { count: compCount, error: countErr } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('is_deleted', false)
            .eq('status', 'completed')
            .gte('order_date', todayDateStr)
            .lte('order_date', todayDateStr + 'T23:59:59.999Z');

          const resolvedCount = (!countErr && compCount !== null) ? compCount : 0;
          setTotalCompletedOrdersCount(resolvedCount);

          // 1. Initial fetch limited to 10 completed orders with joined vendor details
          const { data: compData, error: compErr } = await supabase
            .from('orders')
            .select('*, vendors(id, trade_name, company_name, address)')
            .eq('is_deleted', false)
            .eq('status', 'completed')
            .gte('order_date', todayDateStr)
            .lte('order_date', todayDateStr + 'T23:59:59.999Z')
            .order('completed_at', { ascending: false })
            .range(0, 9);

          let newLookup: Record<string, { trade_name: string; company_name?: string; address: string }> = {};

          if (!compErr && compData) {
            setDbCompletedOrders(compData as any[]);

            const missingVendorIds = compData
              .filter((o: any) => !o.vendors && o.vendor_id)
              .map((o: any) => o.vendor_id);

            if (missingVendorIds.length > 0) {
              const { data: vRows } = await supabase
                .from('vendors')
                .select('id, trade_name, company_name, address')
                .in('id', Array.from(new Set(missingVendorIds)));

              if (vRows) {
                vRows.forEach(v => {
                  newLookup[v.id] = { trade_name: v.trade_name || v.company_name || '', company_name: v.company_name || '', address: v.address || '' };
                });
                setVendorLookup(prev => ({ ...prev, ...newLookup }));
              }
            }
          }

          // 2. Fetch today's active orders count exclusively for current date, status not completed/cancelled, is_deleted = false
          const { count: actCount, error: actErr } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('is_deleted', false)
            .gte('order_date', todayDateStr)
            .lte('order_date', todayDateStr + 'T23:59:59.999Z')
            .not('status', 'in', '("completed","cancelled","canceled")');

          const resolvedActCount = (!actErr && actCount !== null) ? actCount : 0;
          setTodayActiveOrdersCount(resolvedActCount);

          // Update module-level cache
          dashboardCache.dateStr = todayDateStr;
          dashboardCache.completedOrders = (compData as any[]) || [];
          dashboardCache.totalCompletedCount = resolvedCount;
          dashboardCache.todayActiveOrdersCount = resolvedActCount;
          dashboardCache.vendorLookup = { ...dashboardCache.vendorLookup, ...newLookup };
          dashboardCache.timestamp = Date.now();
        } catch (e) {
          console.warn('DashboardView fetchTodayOrdersData error:', e);
        } finally {
          setIsLoadingCompletedOrders(false);
        }
      })();

      await inFlightDashboardPromise;
      inFlightDashboardPromise = null;
      return;
    }

    // Fallback using props
    const localComp = (ordersRef.current || [])
      .filter(o => {
        if (o.is_deleted) return false;
        const oDate = (o.order_date || '').substring(0, 10);
        if (oDate !== todayDateStr) return false;
        const s = (o.status || '').toLowerCase().trim();
        return s === 'completed';
      })
      .sort((a, b) => {
        const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return timeB - timeA;
      });

    setTotalCompletedOrdersCount(localComp.length);
    setDbCompletedOrders(localComp.slice(0, 10));
    setIsLoadingCompletedOrders(false);

    const localActCount = (ordersRef.current || []).filter(o => {
      if (o.is_deleted) return false;
      const oDate = (o.order_date || '').substring(0, 10);
      if (oDate !== todayDateStr) return false;
      const s = (o.status || '').toLowerCase().trim();
      return s !== 'completed' && s !== 'cancelled' && s !== 'canceled';
    }).length;
    setTodayActiveOrdersCount(localActCount);

    dashboardCache.dateStr = todayDateStr;
    dashboardCache.completedOrders = localComp.slice(0, 10);
    dashboardCache.totalCompletedCount = localComp.length;
    dashboardCache.todayActiveOrdersCount = localActCount;
    dashboardCache.timestamp = Date.now();
  }, [todayDateStr]);

  // Paginated infinite scroll: fetch 5 more rows when scrolling near bottom
  const handleCompletedOrdersScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (isLoadingCompletedOrders || isLoadingMoreCompletedOrders) return;
    if (dbCompletedOrders.length >= totalCompletedOrdersCount) return;

    if (target.scrollHeight - target.scrollTop - target.clientHeight < 40) {
      if (!isSupabaseConfigured || !supabase) {
        const localComp = orders
          .filter(o => {
            if (o.is_deleted) return false;
            const oDate = (o.order_date || '').substring(0, 10);
            if (oDate !== todayDateStr) return false;
            return (o.status || '').toLowerCase().trim() === 'completed';
          })
          .sort((a, b) => {
            const timeA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
            const timeB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
            return timeB - timeA;
          });
        const nextBatch = localComp.slice(dbCompletedOrders.length, dbCompletedOrders.length + 5);
        if (nextBatch.length > 0) {
          setDbCompletedOrders(prev => [...prev, ...nextBatch]);
        }
        return;
      }

      setIsLoadingMoreCompletedOrders(true);
      try {
        const from = dbCompletedOrders.length;
        const to = from + 4; // Fetch next 5 rows
        const { data: compData, error: compErr } = await supabase
          .from('orders')
          .select('*, vendors(id, trade_name, company_name, address)')
          .eq('is_deleted', false)
          .eq('status', 'completed')
          .gte('order_date', todayDateStr)
          .lte('order_date', todayDateStr + 'T23:59:59.999Z')
          .order('completed_at', { ascending: false })
          .range(from, to);

        if (!compErr && compData && compData.length > 0) {
          setDbCompletedOrders(prev => {
            const seen = new Set(prev.map(o => o.id));
            const fresh = (compData as any[]).filter(o => !seen.has(o.id));
            return [...prev, ...fresh];
          });

          const missingVendorIds = (compData as any[])
            .filter(o => !o.vendors && o.vendor_id)
            .map(o => o.vendor_id);

          if (missingVendorIds.length > 0) {
            const { data: vRows } = await supabase
              .from('vendors')
              .select('id, trade_name, company_name, address')
              .in('id', Array.from(new Set(missingVendorIds)));

            if (vRows) {
              const map: Record<string, { trade_name: string; company_name?: string; address: string }> = {};
              vRows.forEach(v => {
                map[v.id] = { trade_name: v.trade_name || v.company_name || '', company_name: v.company_name || '', address: v.address || '' };
              });
              setVendorLookup(prev => ({ ...prev, ...map }));
            }
          }
        }
      } catch (err) {
        console.error('Error fetching more completed orders:', err);
      } finally {
        setIsLoadingMoreCompletedOrders(false);
      }
    }
  };

  useEffect(() => {
    fetchTodayOrdersData();
  }, [fetchTodayOrdersData]);

  // Realtime subscription for orders table with cache invalidation
  useEffect(() => {
    const unsub = onRealtimeDbChange((table) => {
      if (table === 'orders') {
        dashboardCache.timestamp = 0; // invalidate cache
        fetchTodayOrdersData(true);
      }
      if (table === 'communications' || table === 'vendor_communications') {
        dashboardCache.remindersByFilter = {}; // invalidate reminders cache
      }
    });
    return () => unsub();
  }, [fetchTodayOrdersData]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    clearSearch,
    triggerImmediateSearch
  } = useDebouncedSearch('', 250);

  // Filter completed orders by trade_name
  const filteredCompletedOrders = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {
      return dbCompletedOrders;
    }
    const term = debouncedSearchTerm.trim().toLowerCase();
    return dbCompletedOrders.filter(order => {
      const vJoined = (order as any).vendors;
      const vFromLookup = order.vendor_id ? vendorLookup[order.vendor_id] : null;
      const vFromSuppliers = suppliers.find(s => s.id === order.vendor_id);
      const tradeName = vJoined?.trade_name || vFromLookup?.trade_name || vFromSuppliers?.trade_name || order.vendor_name || vJoined?.company_name || '';
      return tradeName.toLowerCase().includes(term);
    });
  }, [dbCompletedOrders, debouncedSearchTerm, vendorLookup, suppliers]);

  const formatTimeOnly = (dtStr?: string | null) => {
    if (!dtStr) return '-';
    try {
      const dt = new Date(dtStr);
      if (isNaN(dt.getTime())) {
        const timePart = dtStr.includes('T') ? dtStr.split('T')[1] : dtStr.split(' ')[1];
        return timePart ? timePart.substring(0, 5) : dtStr;
      }
      const hours = String(dt.getHours()).padStart(2, '0');
      const mins = String(dt.getMinutes()).padStart(2, '0');
      return `${hours}:${mins}`;
    } catch {
      return '-';
    }
  };
  
  const totalLiters = orders.reduce((sum, curr) => sum + (curr.fact_qty || 0), 0);
  const activeDrivers = employees.filter(e => e.role === 'driver').length;

  // Filter staff roles strictly excluding drivers, driver assistants, and warehouse managers
  const isExcluded = (user?: User | null) => {
    if (!user) return true;
    const r = (user.role || '').toLowerCase().trim();
    if (r === 'warehouse_manager' || r === 'logistics_manager' || r === 'warehouse_head' || r === 'warehouse' || r.includes('warehouse') || r.includes('საწყობ') || r.includes('ლოჯისტიკ')) return true;
    if (r === 'driver' || r === 'driver_assistant' || r === 'assistant_driver' || r === 'assistant' || r.includes('driver') || r.includes('მძღოლ')) return true;
    if (r === 'vendor' || r.includes('vendor') || r.includes('მომწოდებ')) return true;
    return false;
  };

  const eligibleUsers = useMemo(() => {
    const map = new Map<string, User>();
    (employees || []).forEach(e => {
      if (!e.is_deleted && !isExcluded(e)) {
        map.set(e.id, e);
      }
    });
    if (currentUser && !currentUser.is_deleted && !isExcluded(currentUser)) {
      map.set(currentUser.id, currentUser);
    }
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ka'));
  }, [employees, currentUser]);

  // Pre-choose the currently logged in user when app loads IF eligible, otherwise 'all'
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    if (currentUser && !isExcluded(currentUser)) {
      return currentUser.id || 'all';
    }
    return 'all';
  });

  useEffect(() => {
    if (currentUser?.id) {
      if (!isExcluded(currentUser)) {
        setSelectedUserId(currentUser.id);
      } else {
        setSelectedUserId('all');
      }
    }
  }, [currentUser?.id, currentUser?.role]);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Paginated Reminders State with session cache
  const cachedReminders = dashboardCache.remindersByFilter[selectedUserId];
  const isRemindersCacheFresh = !!cachedReminders && (Date.now() - cachedReminders.timestamp < 180000);

  const [reminders, setReminders] = useState<Communication[]>(() => 
    isRemindersCacheFresh ? cachedReminders.reminders : []
  );
  const [totalRemindersCount, setTotalRemindersCount] = useState<number>(() => 
    isRemindersCacheFresh ? cachedReminders.totalCount : 0
  );
  const [isLoadingReminders, setIsLoadingReminders] = useState<boolean>(() => 
    !isRemindersCacheFresh
  );
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const bottomSentinelRef = React.useRef<HTMLDivElement>(null);

  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  const totalRemindersCountRef = useRef(totalRemindersCount);
  totalRemindersCountRef.current = totalRemindersCount;
  const isLoadingRemindersRef = useRef(isLoadingReminders);
  isLoadingRemindersRef.current = isLoadingReminders;
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;

  // Load next batch of reminders
  const loadMoreReminders = useCallback(async () => {
    if (isLoadingRemindersRef.current || isLoadingMoreRef.current) return;
    if (remindersRef.current.length >= totalRemindersCountRef.current) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    const selectedEmployee = eligibleUsers.find(e => e.id === selectedUserId) || employees.find(e => e.id === selectedUserId);
    const selectedEmpName = selectedEmployee?.name || '';
    const currentOffset = remindersRef.current.length;

    try {
      const res = await getDashboardTodayRemindersPaginated(10, currentOffset, selectedUserId, selectedEmpName);
      setReminders(prev => {
        const seen = new Set(prev.map(r => r.id));
        const fresh = res.reminders.filter(r => !seen.has(r.id));
        const updated = [...prev, ...fresh];
        dashboardCache.remindersByFilter[selectedUserId] = {
          reminders: updated,
          totalCount: res.totalCount,
          timestamp: Date.now()
        };
        return updated;
      });
      setTotalRemindersCount(res.totalCount);
    } catch (err) {
      console.error('Failed to load more reminders:', err);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [selectedUserId, eligibleUsers, employees]);

  // Dynamic overflow & fill check: if current items don't fill the container enough to enable scrolling,
  // automatically load the next batch so the user isn't stuck unable to scroll.
  const checkAndFillContainer = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (isLoadingRemindersRef.current || isLoadingMoreRef.current) return;
    if (remindersRef.current.length >= totalRemindersCountRef.current) return;
    if (remindersRef.current.length === 0) return;

    // If container content fits without a scrollbar (scrollHeight <= clientHeight + 15),
    // auto-fetch more items until it overflows or all items are fetched.
    const hasNoScrollbar = container.scrollHeight <= container.clientHeight + 15;
    if (hasNoScrollbar) {
      loadMoreReminders();
    }
  }, [loadMoreReminders]);

  // Fetch initial 10 rows on filter change / initial load if cache is missing or stale
  useEffect(() => {
    let isMounted = true;
    const cached = dashboardCache.remindersByFilter[selectedUserId];
    const isFresh = !!cached && (Date.now() - cached.timestamp < 180000);

    if (isFresh) {
      setReminders(cached.reminders);
      setTotalRemindersCount(cached.totalCount);
      setIsLoadingReminders(false);
      return;
    }

    setIsLoadingReminders(true);
    const selectedEmployee = eligibleUsers.find(e => e.id === selectedUserId) || employees.find(e => e.id === selectedUserId);
    const selectedEmpName = selectedEmployee?.name || '';

    getDashboardTodayRemindersPaginated(10, 0, selectedUserId, selectedEmpName)
      .then(res => {
        if (!isMounted) return;
        setReminders(res.reminders);
        setTotalRemindersCount(res.totalCount);
        setIsLoadingReminders(false);
        dashboardCache.remindersByFilter[selectedUserId] = {
          reminders: res.reminders,
          totalCount: res.totalCount,
          timestamp: Date.now()
        };
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Failed to load dashboard reminders:', err);
        setIsLoadingReminders(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedUserId, eligibleUsers, employees]);

  // Dynamic layout check: whenever reminders change or finish loading, check if more rows are needed to fill the viewport
  useEffect(() => {
    if (!isLoadingReminders && reminders.length > 0 && reminders.length < totalRemindersCount) {
      const timer = setTimeout(() => {
        checkAndFillContainer();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [reminders.length, isLoadingReminders, totalRemindersCount, checkAndFillContainer]);

  // ResizeObserver: dynamically handles window resizing, maximizing, zooming, or orientation changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      checkAndFillContainer();
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [checkAndFillContainer]);

  // IntersectionObserver on bottom sentinel
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          if (!isLoadingRemindersRef.current && !isLoadingMoreRef.current && remindersRef.current.length < totalRemindersCountRef.current) {
            loadMoreReminders();
          }
        }
      },
      {
        root: container,
        rootMargin: '40px',
        threshold: 0.05
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreReminders, reminders.length]);

  // Wheel fallback: if user scrolls down over container when at edge or non-overflowing
  const handleRemindersWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY > 0 && reminders.length < totalRemindersCount && !isLoadingMore && !isLoadingReminders) {
      const container = scrollContainerRef.current;
      if (container && container.scrollHeight <= container.clientHeight + 15) {
        loadMoreReminders();
      }
    }
  };

  // Standard scroll handler
  const handleRemindersScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (isLoadingRemindersRef.current || isLoadingMoreRef.current) return;
    if (reminders.length >= totalRemindersCount) return;

    if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
      loadMoreReminders();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 space-y-4 pt-2 md:pt-3" id="dashboard-view-panel">
      {/* Dynamic Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-2xl p-5 shadow-sm border border-emerald-800/20 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-700/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300 font-sans">
            {t("Management Panel")}
          </p>
          <h2 className="text-xl md:text-2xl font-black">
            {t("Welcome to Biodiesel Georgia Portal")}
          </h2>
          <p className="text-xs text-emerald-100/80 max-w-xl leading-relaxed">
            {t("Here you can manage suppliers, plan collection orders, monitor warehouse balances and view detailed analytics.")}
          </p>
        </div>
      </div>

      {/* Grid Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 shrink-0">
        
        <button 
          id="indicator-vendors"
          onClick={() => onNavigate('suppliers')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group cursor-pointer"
        >
          <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <Building2 size={20} />
          </div>
          <span className="text-xs text-gray-400 font-medium block">{t("Suppliers")}</span>
          <span className="text-xl font-extrabold text-gray-800 font-sans tabular-nums">
            {totalSuppliersCount !== undefined ? totalSuppliersCount : suppliers.length}
          </span>
        </button>

        <button 
          id="indicator-active-orders"
          onClick={() => onNavigate('orders')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group cursor-pointer"
        >
          <div className="bg-blue-50 text-blue-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <ShoppingBag size={20} />
          </div>
          <span className="text-xs text-gray-400 font-medium block">{t("Active Orders")}</span>
          <span className="text-xl font-extrabold text-gray-900">
            {todayActiveOrdersCount}
          </span>
        </button>

        <button 
          id="indicator-total-liters"
          onClick={() => onNavigate('reports')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group cursor-pointer"
        >
          <div className="bg-orange-50 text-orange-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <Fuel size={20} />
          </div>
          <span className="text-xs text-gray-400 font-medium block">{t("Total Volume (Actual)")}</span>
          <span className="text-xl font-extrabold text-gray-900">
            {totalLiters.toLocaleString()} L.
          </span>
        </button>

        <button 
          id="indicator-drivers"
          onClick={() => onNavigate('employees')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group cursor-pointer"
        >
          <div className="bg-purple-50 text-purple-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <Users size={20} />
          </div>
          <span className="text-xs text-gray-400 font-medium block">{t("Drivers")}</span>
          <span className="text-xl font-extrabold text-gray-900">
            {activeDrivers} / {employees.length}
          </span>
        </button>

      </div>

      {/* Main Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0 items-stretch">
        
        {/* Latest completed orders table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-xs flex flex-col min-h-[420px] lg:min-h-0 lg:h-full">
          <div className="flex flex-wrap items-center justify-between border-b border-gray-50 pb-3 gap-2 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-extrabold text-sm text-gray-800 tracking-tight shrink-0 select-none">
                {t("Today's Completed Orders") || "დღევანდელი შესრულებული შეკვეთები"}
              </h3>
              <span className="text-[11px] font-extrabold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-100/60 min-w-[20px] text-center ml-1">
                {searchTerm.trim() ? filteredCompletedOrders.length : totalCompletedOrdersCount}
              </span>
              <div className="flex items-center ml-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 30);
                  }}
                  title={t("Search")}
                  className="p-1 text-gray-400 hover:text-emerald-800 transition-colors cursor-pointer rounded-md shrink-0"
                >
                  <Search size={14} />
                </button>
                {isSearchOpen && (
                  <div className="relative flex items-center ml-1 animate-in fade-in duration-150">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          clearSearch();
                          setIsSearchOpen(false);
                        }
                      }}
                      onBlur={() => {
                        if (!searchTerm.trim()) {
                          setIsSearchOpen(false);
                        }
                      }}
                      placeholder=""
                      className="w-32 sm:w-48 bg-transparent border-none p-0 text-xs text-gray-900 focus:outline-none focus:ring-0 caret-emerald-700 tracking-tight"
                      autoFocus
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          clearSearch();
                          searchInputRef.current?.focus();
                        }}
                        className="ml-1 text-gray-400 hover:text-gray-600 cursor-pointer p-0.5 shrink-0"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => onNavigate('orders')}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer whitespace-nowrap ml-auto"
            >
              {t("View All")}
            </button>
          </div>

          {filteredCompletedOrders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center py-12 text-gray-400 text-xs">
              {searchTerm.trim() ? (t("No matching orders found") || "შესაბამისი შეკვეთები ვერ მოიძებნა") : (t("No completed orders today") || "დღეს შესრულებული შეკვეთები არ მოიძებნა")}
            </div>
          ) : (
            <div 
              onScroll={handleCompletedOrdersScroll}
              className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-100"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-gray-100 z-10 shadow-2xs">
                  <tr>
                    <th className="px-3.5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-slate-50">{t("მომწოდებელი") || "მომწოდებელი"}</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap bg-slate-50">{t("ტრანსპორტი") || "ტრანსპორტი"}</th>
                    <th className="px-3.5 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap bg-slate-50">{t("Completed At") || "შესრულდა"}</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap bg-slate-50">{t("Fact Qty") || "ფაქტ. რაოდენობა"}</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-sky-900 uppercase tracking-wider text-center whitespace-nowrap bg-sky-100/70 border-x border-sky-100/60">{t("Fact Pickup / Dropoff") || "ფაქტ. გამოტანა/დატოვება"}</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-amber-900 uppercase tracking-wider text-center whitespace-nowrap bg-amber-50/70 border-x border-amber-100/60">{t("Order Pickup / Dropoff") || "შეკვ. გამოტანა/წამოღება"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCompletedOrders.map(order => {
                    const vJoined = (order as any).vendors;
                    const vFromLookup = order.vendor_id ? vendorLookup[order.vendor_id] : null;
                    const vFromSuppliers = suppliers.find(s => 
                      (s.id && order.vendor_id && s.id.toLowerCase() === order.vendor_id.toLowerCase()) ||
                      (s.trade_name && order.vendor_name && s.trade_name.toLowerCase() === order.vendor_name.toLowerCase())
                    );
                    const vendorDisplayName = 
                      vJoined?.trade_name || 
                      vFromLookup?.trade_name || 
                      vFromSuppliers?.trade_name || 
                      order.vendor_name || 
                      vJoined?.company_name || 
                      vFromLookup?.company_name || 
                      vFromSuppliers?.company_name || 
                      '-';
                    const vendorAddress = 
                      vJoined?.address || 
                      vFromLookup?.address || 
                      vFromSuppliers?.address || 
                      order.address || 
                      '';
                    const truckObj = trucks.find(t => t.id === order.vehicle_id);
                    const vehiclePlate = order.truck_plate || truckObj?.plate_number || '-';
                    const targetVendorId = order.vendor_id || vJoined?.id || vFromSuppliers?.id;
                    const targetVendorObj: Vendor | undefined = vFromSuppliers || (vJoined ? {
                      id: targetVendorId,
                      trade_name: vJoined.trade_name || '',
                      company_name: vJoined.company_name || vJoined.trade_name || '',
                      address: vJoined.address || '',
                      company_code: '',
                      bank_account: '',
                      city: '',
                      district: '',
                      price_per_liter: 0,
                      comments: [],
                      status: 'Active'
                    } as Vendor : undefined);

                    return (
                      <tr 
                        key={order.id}
                        onClick={() => {
                          if (targetVendorId && onSelectVendor) {
                            onSelectVendor(targetVendorId, targetVendorObj);
                          } else if (onSelectOrder) {
                            onSelectOrder(order);
                          } else {
                            onNavigate('vendors');
                          }
                        }}
                        className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                      >
                        <td className="px-3.5 py-2.5">
                          <div className="font-extrabold text-gray-900 group-hover:text-emerald-800 transition-colors truncate max-w-[180px] sm:max-w-[240px]">
                            {vendorDisplayName}
                          </div>
                          {vendorAddress && (
                            <div className="text-[10px] text-gray-400 font-normal truncate max-w-[180px] sm:max-w-[240px]">
                              {vendorAddress}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className="text-xs font-semibold text-gray-700">
                            {vehiclePlate}
                          </span>
                        </td>
                        <td className="px-3.5 py-2 text-center whitespace-nowrap font-medium text-gray-600 text-xs">
                          {formatTimeOnly(order.completed_at)}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap font-semibold text-gray-950 text-xs">
                          {order.fact_qty != null ? `${Number(order.fact_qty).toLocaleString()} ლ` : '0 ლ'}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap bg-sky-100/75 border-x border-sky-100/60 font-semibold text-sky-950 text-xs">
                          <span>{order.fact_tank_pickup ?? 0}</span>
                          <span className="text-sky-400/80 mx-1 font-normal">/</span>
                          <span>{order.fact_tank_dropoff ?? 0}</span>
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap bg-amber-50/70 border-x border-amber-100/60 font-semibold text-gray-950 text-xs">
                          <span>{order.tanks_to_bring ?? 0}</span>
                          <span className="text-gray-400 mx-1 font-normal">/</span>
                          <span>{order.tanks_to_leave ?? 0}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {isLoadingMoreCompletedOrders && (
                <div className="text-center py-2 text-[11px] text-gray-400 font-medium">
                  {t("Loading more...") || "იტვირთება..."}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reminders panel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 shadow-xs flex flex-col min-h-[420px] lg:min-h-0 lg:h-full">
          <div className="flex items-center justify-between border-b border-gray-50 pb-3 gap-2 shrink-0">
            <h3 className="font-extrabold text-sm text-gray-800 tracking-tight">{t("Reminders")}</h3>

            <div className="flex items-center gap-2">
              {/* User icon button filter dropdown */}
              <div className="relative inline-flex items-center" title={t("Filter by user") || "მომხმარებლით გაფილტვრა"}>
                <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-gray-200/90 rounded-lg px-2.5 py-1.5 text-xs transition shadow-2xs cursor-pointer">
                  <UserIcon size={14} className="text-emerald-700 shrink-0" />
                  <ChevronDown size={12} className="text-gray-400 shrink-0" />
                </div>
                <select
                  id="dashboard-reminders-user-filter"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer text-xs font-sans"
                  title={t("Filter by user") || "მომხმარებლით გაფილტვრა"}
                  style={{ fontSize: '12px' }}
                >
                  <option value="all" className="text-xs py-1 font-sans">{t("All Users")}</option>
                  {eligibleUsers.map(u => (
                    <option key={u.id} value={u.id} className="text-xs py-1 font-sans">
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reminders count badge */}
              <span className="text-[11px] font-extrabold bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-100/60 min-w-[20px] text-center">
                {totalRemindersCount}
              </span>
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            onScroll={handleRemindersScroll}
            onWheel={handleRemindersWheel}
            className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1"
          >
            {isLoadingReminders && reminders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-xs text-gray-400 animate-pulse">
                {t("Loading...") || "იტვირთება..."}
              </div>
            ) : reminders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-xs text-gray-400 font-sans">
                {t("No reminders for today.") || "დღეს შეხსენებები არ არის."}
              </div>
            ) : (
              reminders.map(rem => {
                const supplier = suppliers.find(s => s.id === rem.vendor_id);
                const hasTime = !!rem.has_time;
                const reminderDate = rem.reminder_time ? new Date(rem.reminder_time) : null;
                const timeStr = hasTime && reminderDate && !isNaN(reminderDate.getTime())
                  ? `${pad(reminderDate.getHours())}:${pad(reminderDate.getMinutes())}`
                  : null;
                const isPastDue = hasTime && reminderDate && !isNaN(reminderDate.getTime())
                  ? now.getTime() > reminderDate.getTime()
                  : false;

                return (
                  <button
                    key={rem.id}
                    type="button"
                    onClick={() => onSelectReminder?.(rem)}
                    className={`w-full text-left p-3 rounded-xl space-y-1 transition cursor-pointer border ${
                      isPastDue
                        ? 'bg-red-100/90 hover:bg-red-200/80 border-red-300 text-red-950 shadow-xs'
                        : 'bg-rose-50/30 hover:bg-rose-50/60 border-rose-100/60 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold leading-none ${isPastDue ? 'text-red-950 font-black' : 'text-gray-800'}`}>
                        {supplier?.trade_name || rem.vendor_name || t("Direct / General")}
                      </span>
                      {timeStr && (
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isPastDue
                            ? 'text-red-900 bg-red-200/90 border border-red-300/60'
                            : 'text-rose-700 bg-rose-100/50'
                        }`}>
                          {timeStr}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs line-clamp-2 ${isPastDue ? 'text-red-900' : 'text-gray-600'}`}>
                      {rem.comment}
                    </p>
                  </button>
                );
              })
            )}

            {/* Bottom sentinel for seamless IntersectionObserver */}
            {reminders.length < totalRemindersCount && (
              <div ref={bottomSentinelRef} className="h-1 w-full pointer-events-none" />
            )}

            {isLoadingMore ? (
              <div className="flex items-center justify-center gap-2 py-2 text-[11px] text-gray-400 font-medium animate-pulse">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                <span>{t("Loading more...") || "იტვირთება..."}</span>
              </div>
            ) : reminders.length < totalRemindersCount ? (
              <div className="pt-1 pb-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => loadMoreReminders()}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/70 rounded-full px-3 py-1 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  title={t("Load more reminders") || "მეტის ჩატვირთვა"}
                >
                  <span>{t("Show more") || "მეტის ნახვა"}</span>
                  <span className="text-[10px] text-emerald-600/80 font-mono font-bold">({reminders.length}/{totalRemindersCount})</span>
                </button>
              </div>
            ) : totalRemindersCount > 10 ? (
              <div className="text-center py-2 text-[10px] text-gray-400 font-medium">
                {t("All reminders loaded") || "ყველა შეხსენება ნაჩვენებია"} ({totalRemindersCount})
              </div>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
}
