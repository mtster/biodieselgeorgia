import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Vendor, Order, City, District } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t } from '../../utils/lang';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  cities: City[];
  districts: District[];
  onBack: () => void;
}

export default function DeliveredOrdersByRegions({
  suppliers,
  orders,
  cities,
  districts,
  onBack,
}: Props) {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(endOfMonth.getDate())}`;
  });
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch completed orders
  const completedOrders = orders.filter(o => o.status === 'completed' && !o.is_deleted);

  // 2. Identify unique city-district pairs from active vendors
  const activeSuppliers = suppliers.filter(s => !s.is_deleted);
  
  // Group key is City + ':::' + District
  const regionGroupsMap: Record<string, { city: string; district: string; sIds: string[] }> = {};
  
  activeSuppliers.forEach(s => {
    const key = `${s.city}:::${s.district}`;
    if (!regionGroupsMap[key]) {
      regionGroupsMap[key] = {
        city: s.city,
        district: s.district,
        sIds: [],
      };
    }
    regionGroupsMap[key].sIds.push(s.id);
  });

  // 3. Map aggregates per group
  const regionRows = Object.values(regionGroupsMap)
    .map(g => {
      // Find completed orders for these suppliers
      const regionOrders = completedOrders.filter(o => g.sIds.includes(o.vendor_id));

      // Filter by period
      const filteredOrders = regionOrders.filter(o => {
        const oDateStr = o.pickup_date_time || o.order_date;
        if (!oDateStr) return true;
        const datePart = oDateStr.split('T')[0];
        if (startDate && datePart < startDate) return false;
        if (endDate && datePart > endDate) return false;
        return true;
      });

      const visitsAmount = filteredOrders.length;
      const oilAmount = filteredOrders.reduce((sum, o) => sum + (o.fact_qty || o.qty_requested || 0), 0);
      const cost = filteredOrders.reduce((sum, o) => {
        const liters = o.fact_qty || o.qty_requested || 0;
        const s = activeSuppliers.find(x => x.id === o.vendor_id);
        const price = s ? (s.price_per_liter || 0) : 0;
        return sum + (liters * price);
      }, 0);

      return {
        city: g.city,
        region: g.district,
        visitsAmount,
        oilAmount,
        cost,
      };
    })
    // Apply search filter (matching city or region)
    .filter(row => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          row.city.toLowerCase().includes(term) ||
          row.region.toLowerCase().includes(term)
        );
      }
      return true;
    })
    // Show only regions with visits to be clean and accurate
    .filter(row => row.visitsAmount > 0);

  // Summary row calculations
  const totalVisits = regionRows.reduce((sum, r) => sum + r.visitsAmount, 0);
  const totalOil = regionRows.reduce((sum, r) => sum + r.oilAmount, 0);
  const totalCost = regionRows.reduce((sum, r) => sum + r.cost, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Delivered Orders by Regions")}</>}
        onBack={onBack}
        backButtonId="reports-regions-back"
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
                onSearchChange={setSearchTerm}
                searchPlaceholder={t("Search regions by city name or district representation...")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABLE DATA SPREADSHEET CANVAS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="select-none bg-slate-50 border-b border-gray-200">
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("City")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Region (District)")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-center">
                  {t("Visits Amount")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                  {t("Oil Amount (Liters)")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                  {t("Cost (₾)")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {regionRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                  <td className="py-3.5 px-4 font-semibold text-gray-900">
                    {row.city}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-gray-700">
                    {row.region}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-medium text-gray-650">
                    {row.visitsAmount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-800">
                    {row.oilAmount.toLocaleString()} L
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800">
                    {row.cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾
                  </td>
                </tr>
              ))}

              {regionRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No matching regional record aggregates found.")}
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {regionRows.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                    {t("TOTAL SUMMARY")}
                  </td>
                  <td className="py-4 px-4 font-semibold">
                    {regionRows.length} {t("active regions")}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-sm text-emerald-950">
                    {totalVisits}
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-emerald-950">
                    {totalOil.toLocaleString()} L
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-emerald-950">
                    {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾
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
