import React, { useState } from 'react';
import { Vendor, Order } from '../types';
import { FileSpreadsheet, Percent, BarChart3, HelpCircle, FileText } from 'lucide-react';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
}

export default function ReportsView({ suppliers, orders }: Props) {
  const [reportType, setReportType] = useState<'monthly' | 'supplier'>('monthly');

  const completedOrders = orders.filter(o => o.status === 'completed');

  // Group by Month (YYYY-MM)
  const monthlyData: Record<string, { total: number; count: number; max: number }> = {};
  completedOrders.forEach(o => {
    const month = o.pickup_date_time ? o.pickup_date_time.slice(0, 7) : o.order_date.slice(0, 7);
    const lit = o.qty_actual || o.qty_requested || 0;
    if (!monthlyData[month]) {
      monthlyData[month] = { total: 0, count: 0, max: 0 };
    }
    monthlyData[month].total += lit;
    monthlyData[month].count += 1;
    if (lit > monthlyData[month].max) {
      monthlyData[month].max = lit;
    }
  });

  // Group by Supplier
  const supplierData: Record<string, { total: number; count: number; tradeName: string; code: string }> = {};
  completedOrders.forEach(o => {
    const sId = o.vendor_id;
    const sObj = suppliers.find(x => x.id === sId);
    const lit = o.qty_actual || o.qty_requested || 0;
    
    if (!supplierData[sId]) {
      supplierData[sId] = { 
        total: 0, 
        count: 0, 
        tradeName: sObj?.trade_name || (o.vendor_name || 'Unknown'), 
        code: sObj?.id_code || 'N/A' 
      };
    }
    supplierData[sId].total += lit;
    supplierData[sId].count += 1;
  });

  const totalVolume = completedOrders.reduce((sum, curr) => sum + (curr.qty_actual || 0), 0);

  return (
    <div className="space-y-6" id="reports-view-panel">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">Reports & Summaries</h2>
          <p className="text-xs text-gray-500 mt-1 pb-1">Generate oil collection aggregates by reporting periods and suppliers.</p>
        </div>

        {/* Filters */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl border">
          <button 
            onClick={() => setReportType('monthly')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              reportType === 'monthly' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-550 hover:text-gray-800'
            }`}
          >
            Monthly Report
          </button>
          <button 
            onClick={() => setReportType('supplier')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              reportType === 'supplier' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-550 hover:text-gray-800'
            }`}
          >
            Supplier Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border p-4 rounded-xl shadow-xs">
          <span className="text-[11px] text-gray-400 font-bold block">Total Received Volume</span>
          <span className="text-xl font-mono font-black text-emerald-800">{totalVolume.toLocaleString()} L.</span>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-xs">
          <span className="text-[11px] text-gray-400 font-bold block">Completed Collected Tasks</span>
          <span className="text-xl font-mono font-black text-gray-800">{completedOrders.length} collections</span>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-xs font-sans">
          <span className="text-[11px] text-gray-400 font-bold block">Average Collected Per Task</span>
          <span className="text-xl font-mono font-black text-gray-800">
            {completedOrders.length > 0 ? Math.round(totalVolume / completedOrders.length) : 0} L.
          </span>
        </div>
      </div>

      {reportType === 'monthly' ? (
        <div className="bg-white border rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
            <FileText size={16} className="text-emerald-700" />
            Monthly Collection Stat Aggregates
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-700">
              <thead>
                <tr className="border-b text-[10px] text-gray-400 uppercase font-mono bg-gray-50/50">
                  <th className="py-2.5 px-3">Report Month</th>
                  <th className="py-2.5 px-3">Collected Liters (Actual)</th>
                  <th className="py-2.5 px-3">Pickup Count</th>
                  <th className="py-2.5 px-3">Average Volume / Pickup</th>
                  <th className="py-2.5 px-3">Max Single Pickup</th>
                  <th className="py-2.5 px-3 text-right">Total Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.keys(monthlyData).sort().reverse().map(month => {
                  const data = monthlyData[month];
                  const avg = Math.round(data.total / data.count);
                  const share = totalVolume > 0 ? Math.round((data.total / totalVolume) * 100) : 0;
                  return (
                    <tr key={month} className="hover:bg-slate-50/25">
                      <td className="py-3 px-3 font-mono font-bold text-gray-900">{month}</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-800">{data.total.toLocaleString()} L.</td>
                      <td className="py-3 px-3 font-mono text-gray-600">{data.count}</td>
                      <td className="py-3 px-3 font-mono text-gray-500">{avg} L.</td>
                      <td className="py-3 px-3 font-mono text-gray-500">{data.max} L.</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-gray-450">{share}%</td>
                    </tr>
                  );
                })}

                {Object.keys(monthlyData).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-xs text-gray-400">
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
            <BarChart3 size={16} className="text-emerald-700 font-bold" />
            Supplier-wise Literage Accumulation Report
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-700">
              <thead>
                <tr className="border-b text-[10px] text-gray-400 uppercase font-mono bg-gray-50">
                  <th className="py-2.5 px-3">Supplier Object</th>
                  <th className="py-2.5 px-3">Code / Tax ID</th>
                  <th className="py-2.5 px-3">Total Dispatched (Liters)</th>
                  <th className="py-2.5 px-3">Collection Frequency</th>
                  <th className="py-2.5 px-3">Average / Dispatched (L.)</th>
                  <th className="py-2.5 px-3 text-right">Share (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.keys(supplierData).map(sId => {
                  const data = supplierData[sId];
                  const avg = Math.round(data.total / data.count);
                  const pct = totalVolume > 0 ? Math.round((data.total / totalVolume) * 100) : 0;
                  return (
                    <tr key={sId} className="hover:bg-slate-50/25">
                      <td className="py-3 px-3 font-bold text-gray-900">{data.tradeName}</td>
                      <td className="py-3 px-3 font-mono text-gray-400">{data.code}</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-800">{data.total.toLocaleString()} L.</td>
                      <td className="py-3 px-3 font-mono text-gray-500">{data.count} collections</td>
                      <td className="py-3 px-3 font-mono text-gray-500">{avg} L.</td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-gray-450">{pct}%</td>
                    </tr>
                  );
                })}

                {Object.keys(supplierData).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-xs text-gray-400">
                      No records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
