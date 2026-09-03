import React from 'react';
import { Vendor, Order, User, Truck, Communication } from '../../types';
import { 
  Building2, ShoppingBag, Truck as TruckIcon, 
  Users, Fuel, Calendar, HelpCircle 
} from 'lucide-react';
import { t } from '../../utils/lang';

interface Props {
  suppliers: Vendor[]; // Pass vendors from parent App
  totalSuppliersCount?: number;
  orders: Order[];
  employees: User[];   // Pass users from parent App
  trucks: Truck[];
  communications?: Communication[];
  onNavigate: (tab: string) => void;
  onSelectReminder?: (comm: Communication) => void;
}

export default function DashboardView({ 
  suppliers, 
  totalSuppliersCount, 
  orders, 
  employees, 
  trucks, 
  communications = [], 
  onNavigate,
  onSelectReminder
}: Props) {
  const activeOrders = orders.filter(o => o.status === 'registered' || o.status === 'driver_assigned' || o.status === 'picked_up');
  const completedOrders = orders.filter(o => o.status === 'completed');
  
  const totalLiters = completedOrders.reduce((sum, curr) => sum + (curr.fact_qty || 0), 0);
  const activeDrivers = employees.filter(e => e.role === 'driver').length;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  
  const todayReminders = (communications || []).filter(c => 
    !c.is_deleted && 
    c.type === 'reminder' && 
    c.reminder_time &&
    c.reminder_time.split('T')[0] === todayStr
  );

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
            {activeOrders.length}
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

          {activeOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              {t("No active orders are currently registered.")}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeOrders.slice(0, 5).map(order => {
                const supplierObj = suppliers.find(s => s.id === order.vendor_id);
                return (
                  <div key={order.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800">
                          {supplierObj ? supplierObj.trade_name : (order.vendor_name || t('Unknown Supplier'))}
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                          {order.doc_number}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-450 font-sans">
                        {t("Warehouse")}: {order.warehouse_name || t('Unspecified')} • {t("Qty")}: {order.qty_requested} L.
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
          <div className="flex items-center justify-between border-b border-gray-50 pb-3">
            <h3 className="font-extrabold text-sm text-gray-800">{t("Reminders")}</h3>
            <span className="text-[10px] font-extrabold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">
              {todayReminders.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {todayReminders.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">
                {t("No reminders for today.")}
              </p>
            ) : (
              todayReminders.map(rem => {
                const supplier = suppliers.find(s => s.id === rem.vendor_id);
                const hasTime = !!rem.has_time;
                const timeStr = hasTime && rem.reminder_time ? rem.reminder_time.substring(11, 16) : null;
                const reminderDate = rem.reminder_time ? new Date(rem.reminder_time) : null;
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
