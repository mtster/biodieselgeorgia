import React, { useState } from 'react';
import { Supplier, Order } from '../types';
import { FileSpreadsheet, Percent, BarChart3, HelpCircle, FileText } from 'lucide-react';

interface Props {
  suppliers: Supplier[];
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
    const sId = o.supplier_id;
    const sObj = suppliers.find(x => x.id === sId);
    const lit = o.qty_actual || o.qty_requested || 0;
    
    if (!supplierData[sId]) {
      supplierData[sId] = { 
        total: 0, 
        count: 0, 
        tradeName: sObj?.trade_name || 'უცნობი', 
        code: sObj?.company_code || 'N/A' 
      };
    }
    supplierData[sId].total += lit;
    supplierData[sId].count += 1;
  });

  const totalVolume = completedOrders.reduce((sum, curr) => sum + (curr.qty_actual || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">რეპორტები და ანგარიშები</h2>
          <p className="text-xs text-gray-500 mt-1">ზეთის შეგროვების ჯამური მაჩვენებლების გენერირება პერიოდების და მომწოდებლების მიხედვით.</p>
        </div>

        {/* Filters */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl border">
          <button 
            onClick={() => setReportType('monthly')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              reportType === 'monthly' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-550 hover:text-gray-800'
            }`}
          >
            ყოველთვიური რეპორტი
          </button>
          <button 
            onClick={() => setReportType('supplier')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              reportType === 'supplier' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-550 hover:text-gray-800'
            }`}
          >
            რეპორტი მომწოდებლებზე
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border p-4 rounded-xl shadow-xs">
          <span className="text-[11px] text-gray-400 font-bold block">სულ მიღებული მოცულობა</span>
          <span className="text-xl font-mono font-black text-emerald-800">{totalVolume.toLocaleString()} ლ.</span>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-xs">
          <span className="text-[11px] text-gray-400 font-bold block">შესრულებული შეკვეთები</span>
          <span className="text-xl font-mono font-black text-gray-800">{completedOrders.length} კოლექცია</span>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-xs">
          <span className="text-[11px] text-gray-400 font-bold block">შეგროვების საშუალო მაჩვენებელი</span>
          <span className="text-xl font-mono font-black text-gray-800">
            {completedOrders.length > 0 ? Math.round(totalVolume / completedOrders.length) : 0} ლ.
          </span>
        </div>
      </div>

      {reportType === 'monthly' ? (
        <div className="bg-white border rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
            <FileText size={16} className="text-emerald-700" />
            ყოველთვიური შეგროვების სტატისტიკა
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-700">
              <thead>
                <tr className="border-b text-[10px] text-gray-405 uppercase font-mono bg-gray-50/50">
                  <th className="py-2.5 px-3">საანგარიშო თვე</th>
                  <th className="py-2.5 px-3">შეგროვებული ლიტრები (ფაქტ.)</th>
                  <th className="py-2.5 px-3">გატანების რაოდენობა</th>
                  <th className="py-2.5 px-3">საშუალო მოცულობა გატანაზე</th>
                  <th className="py-2.5 px-3">მაქსიმალური გატანა</th>
                  <th className="py-2.5 px-3 text-right">წილი მთლიანობაში</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.keys(monthlyData).sort().reverse().map(month => {
                  const data = monthlyData[month];
                  const avg = Math.round(data.total / data.count);
                  const share = totalVolume > 0 ? Math.round((data.total / totalVolume) * 100) : 0;
                  return (
                    <tr key={month} className="hover:bg-slate-50/20">
                      <td className="py-3 px-3 font-mono font-bold text-gray-900">{month}</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-800">{data.total.toLocaleString()} ლ.</td>
                      <td className="py-3 px-3 font-mono text-gray-600">{data.count}</td>
                      <td className="py-3 px-3 font-mono text-gray-500">{avg} ლ.</td>
                      <td className="py-3 px-3 font-mono text-gray-500">{data.max} ლ.</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-gray-450">{share}%</td>
                    </tr>
                  );
                })}

                {Object.keys(monthlyData).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-xs text-gray-400">
                      მონაცემები არ მოიძებნა.
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
            <BarChart3 size={16} className="text-emerald-700" />
            ლიტრაჟის რეპორტი მომწოდებელი ობიექტების მიხედვით
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-700">
              <thead>
                <tr className="border-b text-[10px] text-gray-405 uppercase font-mono bg-gray-50">
                  <th className="py-2.5 px-3">მომწოდებელი ობიექტი</th>
                  <th className="py-2.5 px-3">კოდი</th>
                  <th className="py-2.5 px-3">სულ ჩაბარებული (ლიტრებში)</th>
                  <th className="py-2.5 px-3">გატანების სიხშირე (ჯერ)</th>
                  <th className="py-2.5 px-3">საშუალოდ გატანაზე (ლიტრი)</th>
                  <th className="py-2.5 px-3 text-right">წილი (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.keys(supplierData).map(sId => {
                  const data = supplierData[sId];
                  const avg = Math.round(data.total / data.count);
                  const pct = totalVolume > 0 ? Math.round((data.total / totalVolume) * 100) : 0;
                  return (
                    <tr key={sId} className="hover:bg-slate-50/20">
                      <td className="py-3 px-3 font-bold text-gray-900">{data.tradeName}</td>
                      <td className="py-3 px-3 font-mono text-gray-400">{data.code}</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-800">{data.total.toLocaleString()} ლ.</td>
                      <td className="py-3 px-3 font-mono text-gray-500">{data.count} კოლექცია</td>
                      <td className="py-3 px-3 font-mono text-gray-500">{avg} ლ.</td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-gray-450">{pct}%</td>
                    </tr>
                  );
                })}

                {Object.keys(supplierData).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-xs text-gray-400">
                      მონაცემები არ მოიძებნა.
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
