import React from 'react';
import { Vendor, Order, City, District } from '../../types';
import { Bell, ShieldAlert, Award, TrendingUp, Compass } from 'lucide-react';
import { formatDate } from '../../utils/lang';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  onNavigate: (tab: string) => void;
}

export default function AnalyticsView({ suppliers, orders, onNavigate }: Props) {
  // 1. Calculate overdue locations (no pickups for more than 15 days or past average interval)
  const now = new Date().getTime();
  const defaultIntervalMs = 15 * 24 * 60 * 60 * 1000;

  const overdueSuppliers = suppliers.filter(sup => {
    if (!sup.last_pickup_date) {
      const created = new Date(sup.created_at).getTime();
      return (now - created) > defaultIntervalMs;
    }
    const last = new Date(sup.last_pickup_date).getTime();
    const intervalLimit = sup.average_interval_days
      ? sup.average_interval_days * 24 * 60 * 60 * 1000
      : defaultIntervalMs;
    return (now - last) > intervalLimit;
  });

  // 2. Calculated Metrics
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalLiters = completedOrders.reduce((sum, curr) => sum + (curr.fact_qty || 0), 0);
  const avgLiters = completedOrders.length > 0 ? Math.round(totalLiters / completedOrders.length) : 0;

  // 3. City Breakdown
  const cityCountMap: Record<string, number> = {};
  const cityLitersMap: Record<string, number> = {};

  suppliers.forEach(sup => {
    cityCountMap[sup.city] = (cityCountMap[sup.city] || 0) + 1;
  });

  completedOrders.forEach(ord => {
    const s = suppliers.find(x => x.id === ord.vendor_id);
    if (s) {
      cityLitersMap[s.city] = (cityLitersMap[s.city] || 0) + (ord.fact_qty || 0);
    }
  });

  return (
    <div className="space-y-6 pt-4 md:pt-6" id="analytics-view-panel">
      
      {/* Overview Head */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-800">Analytics & Monitoring</h2>
        <p className="text-xs text-gray-500 mt-1 pb-1">
          Monitor supplier activity, identify overdue collection points, and track geographical statistics.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium block">Overdue Suppliers</span>
            <span className="text-lg font-black text-red-600 font-mono">
              {overdueSuppliers.length}
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium block">Average Volume / Collection</span>
            <span className="text-lg font-black text-gray-800 font-mono">
              {avgLiters} L
            </span>
          </div>
        </div>

        <div className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center gap-4 shadow-xs">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Compass size={20} />
          </div>
          <div>
            <span className="text-[11px] text-gray-400 font-medium block">Active Points Share</span>
            <span className="text-lg font-black text-gray-800 font-mono">
              {suppliers.filter(s => !!s.last_pickup_date).length} / {suppliers.length}
            </span>
          </div>
        </div>

      </div>

      {/* Main split: Left - Overdue list with alerts, Right - Cities share */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Overdue Suppliers list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
          <div className="border-b border-gray-50 pb-3">
            <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              Overdue Suppliers (Urgent Pick-up Required)
            </h3>
            <p className="text-[11px] text-gray-400 mt-1 font-sans">
              These points have not been collected within the last 15 days or past their custom collection interval.
            </p>
          </div>

          {overdueSuppliers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              Excellent! No overdue collection points identified.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-750">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase font-mono bg-gray-50/50">
                    <th className="py-2.5 px-3">Supplier / Vendor</th>
                    <th className="py-2.5 px-3">Address / District</th>
                    <th className="py-2.5 px-3">Last Pick-up</th>
                    <th className="py-2.5 px-3">Days Past</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {overdueSuppliers.map(sup => {
                    const daysPast = sup.last_pickup_date 
                      ? Math.round((now - new Date(sup.last_pickup_date).getTime()) / (1000 * 60 * 60 * 24))
                      : 'Never';
                    return (
                      <tr key={sup.id} className="hover:bg-red-50/10">
                        <td className="py-3 px-3">
                          <span className="font-bold text-gray-900 block">{sup.trade_name}</span>
                          <span className="text-[9px] text-gray-400 block font-mono">Tax ID: {sup.id_code}</span>
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {sup.city}, {sup.district}
                        </td>
                        <td className="py-3 px-3 text-red-650 font-mono font-bold">
                          {sup.last_pickup_date 
                            ? formatDate(sup.last_pickup_date) 
                            : 'Never'}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-gray-550">
                          {daysPast === 'Never' ? 'New' : `${daysPast} days ago`}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button 
                            onClick={() => onNavigate('communications')}
                            className="bg-red-50 text-red-700 hover:bg-red-100 text-[10px] font-bold px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Bell size={12} />
                            Contact
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* City breakdowns indicators */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
          <div className="border-b border-gray-50 pb-3 font-sans">
            <h3 className="font-extrabold text-sm text-gray-800">Geographical Distribution</h3>
            <p className="text-[11px] text-gray-400 mt-1">Distribution of suppliers and collected Liters by city</p>
          </div>

          <div className="space-y-4">
            {Object.keys(cityCountMap).map(city => {
              const count = cityCountMap[city];
              const liters = cityLitersMap[city] || 0;
              const pct = Math.round((count / suppliers.length) * 100) || 0;
              return (
                <div key={city} className="space-y-1.5 font-sans">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                    <span>{city}</span>
                    <span className="text-[11px] text-gray-450 font-mono">
                      {count} supp. ({liters.toLocaleString()} L)
                    </span>
                  </div>
                  {/* Custom progress bars */}
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}

            {Object.keys(cityCountMap).length === 0 && (
              <div className="text-center py-10 text-xs text-gray-400">
                No geographical data available yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
