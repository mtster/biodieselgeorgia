import React, { useState, useEffect, useMemo } from 'react';
import { Vendor, Order, User, Truck, Communication, Warehouse } from '../../types';
import { 
  Building2, ShoppingBag, Truck as TruckIcon, 
  Users, Fuel, Calendar, HelpCircle, User as UserIcon, ChevronDown 
} from 'lucide-react';
import { t } from '../../utils/lang';
import { getActiveOrdersCount } from '../../lib/db';

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
}

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
  onSelectReminder
}: Props) {
  const [internalActiveOrdersCount, setInternalActiveOrdersCount] = useState<number | undefined>(activeOrdersCount);

  useEffect(() => {
    if (activeOrdersCount !== undefined) {
      setInternalActiveOrdersCount(activeOrdersCount);
    } else {
      getActiveOrdersCount().then(cnt => setInternalActiveOrdersCount(cnt));
    }
  }, [activeOrdersCount]);

  const activeOrders = orders.filter(o => o.status === 'registered' || o.status === 'driver_assigned' || o.status === 'picked_up');
  const displayOrders = activeOrders.length > 0 ? activeOrders : orders;
  
  const totalLiters = orders.reduce((sum, curr) => sum + (curr.fact_qty || 0), 0);
  const activeDrivers = employees.filter(e => e.role === 'driver').length;

  // Filter all users except driver and driver assistants
  const eligibleUsers = useMemo(() => {
    const excludedRoles = ['driver', 'driver_assistant', 'assistant_driver', 'assistant'];
    const map = new Map<string, User>();
    (employees || []).forEach(e => {
      const r = (e.role || '').toLowerCase().trim();
      if (!e.is_deleted && !excludedRoles.includes(r)) {
        map.set(e.id, e);
      }
    });
    if (currentUser && !currentUser.is_deleted) {
      const curRole = (currentUser.role || '').toLowerCase().trim();
      if (!excludedRoles.includes(curRole)) {
        map.set(currentUser.id, currentUser);
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ka'));
  }, [employees, currentUser]);

  // Pre-choose the currently logged in user when app loads
  const [selectedUserId, setSelectedUserId] = useState<string>(() => currentUser?.id || '');

  useEffect(() => {
    if (currentUser?.id) {
      setSelectedUserId(currentUser.id);
    }
  }, [currentUser?.id]);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();
  const todayStr = `${todayYear}-${pad(todayMonth + 1)}-${pad(todayDate)}`;

  // Also calculate current date in Georgia / Tbilisi timezone (Asia/Tbilisi UTC+4)
  const tbilisiTodayStr = (() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(now);
    } catch {
      return todayStr;
    }
  })();

  const isReminderForToday = (c: Communication): boolean => {
    if (c.is_deleted) return false;
    const hasReminderTime = !!c.reminder_time && String(c.reminder_time).trim().length > 0;
    const isReminderType = (c.type || '').toString().toLowerCase().trim() === 'reminder';
    if (!hasReminderTime && !isReminderType) return false;

    const raw = String(c.reminder_time || c.date_time || '').trim();
    if (!raw) return false;

    // 1. Direct string match for YYYY-MM-DD against local or Tbilisi date
    if (raw.startsWith(todayStr) || raw.startsWith(tbilisiTodayStr)) return true;
    const datePart = raw.split('T')[0].split(' ')[0];
    if (datePart === todayStr || datePart === tbilisiTodayStr) return true;

    // Extract YYYY-MM-DD pattern from string
    const match = raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      const extractedDate = `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`;
      if (extractedDate === todayStr || extractedDate === tbilisiTodayStr) return true;
    }

    // 2. Parse Date and check local user timezone, Georgia (Tbilisi) timezone, and UTC
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      // Local client date
      if (d.getFullYear() === todayYear && d.getMonth() === todayMonth && d.getDate() === todayDate) {
        return true;
      }
      // Tbilisi timezone (Asia/Tbilisi UTC+4)
      try {
        const remTbilisiStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(d);
        if (remTbilisiStr === tbilisiTodayStr || remTbilisiStr === todayStr) return true;
      } catch {}
      // UTC date check (in case stored as UTC without local conversion)
      const utcDateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      if (utcDateStr === todayStr || utcDateStr === tbilisiTodayStr) return true;
    }

    return false;
  };

  const allTodayReminders = useMemo(() => {
    return (communications || []).filter(isReminderForToday);
  }, [communications, todayStr, tbilisiTodayStr]);

  const filteredTodayReminders = useMemo(() => {
    if (!selectedUserId || selectedUserId === 'all') {
      return allTodayReminders;
    }

    const selectedEmployee = eligibleUsers.find(e => e.id === selectedUserId) || employees.find(e => e.id === selectedUserId);
    const selectedEmpName = (selectedEmployee?.name || '').toLowerCase().trim();
    const selId = selectedUserId.toLowerCase().trim();

    return allTodayReminders.filter(rem => {
      // Check ID on all potential user fields
      if (rem.responsible_user_id && String(rem.responsible_user_id).toLowerCase().trim() === selId) return true;
      if (rem.user_id && String(rem.user_id).toLowerCase().trim() === selId) return true;
      if (rem.created_by && String(rem.created_by).toLowerCase().trim() === selId) return true;
      
      // Check names
      if (selectedEmpName) {
        if (rem.responsible_user_name && rem.responsible_user_name.toLowerCase().trim() === selectedEmpName) return true;
        if (rem.user_name && rem.user_name.toLowerCase().trim() === selectedEmpName) return true;
        if (rem.created_by && rem.created_by.toLowerCase().trim() === selectedEmpName) return true;
      }

      return false;
    });
  }, [allTodayReminders, selectedUserId, eligibleUsers, employees]);

  return (
    <div className="space-y-6 pt-4 md:pt-6" id="dashboard-view-panel">
      {/* Dynamic Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-2xl p-6 shadow-sm border border-emerald-800/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-700/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300 font-mono">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <button 
          id="indicator-vendors"
          onClick={() => onNavigate('suppliers')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group cursor-pointer"
        >
          <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <Building2 size={20} />
          </div>
          <span className="text-xs text-gray-400 font-medium block">{t("Suppliers")}</span>
          <span className="text-xl font-extrabold text-gray-800 font-mono">
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
          <span className="text-xl font-extrabold text-gray-800 font-mono">
            {internalActiveOrdersCount !== undefined ? internalActiveOrdersCount : orders.filter(o => !o.is_deleted && o.status === 'registered').length}
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
          <span className="text-xl font-extrabold text-gray-800 font-mono">
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
          <span className="text-xl font-extrabold text-gray-800 font-mono">
            {activeDrivers} / {employees.length}
          </span>
        </button>

      </div>

      {/* Main Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Latest active orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-50 pb-3">
            <h3 className="font-extrabold text-sm text-gray-800">{t("Latest Active Orders")}</h3>
            <button 
              onClick={() => onNavigate('orders')}
              className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              {t("View All")}
            </button>
          </div>

          {displayOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              {t("No active orders are currently registered.")}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayOrders.slice(0, 5).map(order => {
                const supplierObj = suppliers.find(s => 
                  (s.id && order.vendor_id && s.id.toLowerCase() === order.vendor_id.toLowerCase()) ||
                  (s.trade_name && order.vendor_name && s.trade_name.toLowerCase() === order.vendor_name.toLowerCase()) ||
                  (s.company_name && order.vendor_name && s.company_name.toLowerCase() === order.vendor_name.toLowerCase())
                );
                const vendorDisplayName = supplierObj?.trade_name || supplierObj?.company_name || order.vendor_name || (order as any).vendors?.trade_name || (order as any).vendors?.company_name || t('Unknown Supplier');

                const warehouseObj = warehouses?.find(w => 
                  (w.id && order.warehouse_id && w.id === order.warehouse_id) ||
                  (w.id && supplierObj?.warehouse_id && w.id === supplierObj.warehouse_id)
                );
                const warehouseDisplayName = order.warehouse_name || warehouseObj?.name || (order as any).warehouses?.name || t('Unspecified');

                return (
                  <div key={order.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800">
                          {vendorDisplayName}
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                          {order.doc_number}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-450 font-sans">
                        {t("Warehouse")}: {warehouseDisplayName} • {t("Qty")}: {order.qty_requested || order.fact_qty || 0} L.
                      </p>
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block ${
                        order.status === 'registered' 
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-150' 
                          : order.status === 'driver_assigned'
                          ? 'bg-blue-50 text-blue-700 border border-blue-150' 
                          : order.status === 'picked_up'
                          ? 'bg-purple-50 text-purple-700 border border-purple-150'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-150'
                      }`}>
                        {order.status === 'registered' 
                          ? t('Registered') 
                          : order.status === 'driver_assigned' 
                          ? t('Driver Assigned') 
                          : order.status === 'picked_up' 
                          ? t('Picked Up') 
                          : t('Active')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reminders panel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-50 pb-3 gap-2">
            <h3 className="font-extrabold text-sm text-gray-800">{t("Reminders")}</h3>

            <div className="flex items-center gap-2">
              {/* User icon button filter dropdown */}
              <div className="relative inline-flex items-center" title={t("Filter by user") || "მომხმარებლით გაფილტვრა"}>
                <div className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-gray-200/90 rounded-lg px-2 py-1 text-xs transition shadow-2xs cursor-pointer">
                  <UserIcon size={13} className="text-emerald-700 shrink-0" />
                  <ChevronDown size={11} className="text-gray-400 shrink-0" />
                </div>
                <select
                  id="dashboard-reminders-user-filter"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  title={t("Filter by user") || "მომხმარებლით გაფილტვრა"}
                >
                  <option value="all">{t("All Users")}</option>
                  {eligibleUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reminders count badge */}
              <span className="text-[10px] font-extrabold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100/60">
                {filteredTodayReminders.length}
              </span>
            </div>
          </div>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {filteredTodayReminders.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">
                {t("No reminders for today.")}
              </p>
            ) : (
              filteredTodayReminders.map(rem => {
                const supplier = suppliers.find(s => s.id === rem.vendor_id);
                const hasTime = !!rem.has_time;
                const reminderDate = rem.reminder_time ? new Date(rem.reminder_time) : null;
                const timeStr = hasTime && reminderDate && !isNaN(reminderDate.getTime())
                  ? `${pad(reminderDate.getHours())}:${pad(reminderDate.getMinutes())}`
                  : null;
                const isPastDue = hasTime && reminderDate && !isNaN(reminderDate.getTime()) ? now.getTime() > reminderDate.getTime() : false;

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
          </div>
        </div>

      </div>
    </div>
  );
}
