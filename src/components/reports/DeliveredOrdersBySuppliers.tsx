import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Vendor, Order, User, City, District } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t } from '../../utils/lang';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  cities: City[];
  districts: District[];
  onBack: () => void;
}

export default function DeliveredOrdersBySuppliers({
  suppliers,
  orders,
  users,
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
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Filter out deleted suppliers and managers
  const activeSuppliers = suppliers.filter(s => !s.is_deleted);

  // 2. Fetch completed orders
  const completedOrders = orders.filter(o => o.status === 'completed' && !o.is_deleted);

  // 3. Compute supplier stats
  const supplierRows = activeSuppliers
    .map(s => {
      // Filter completed orders for this supplier
      const sOrders = completedOrders.filter(o => o.vendor_id === s.id);

      // Period filtering
      const filteredOrders = sOrders.filter(o => {
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
        return sum + (liters * (s.price_per_liter || 0));
      }, 0);

      const managerObj = users.find(u => u.id === s.manager_id);
      const managerName = managerObj ? managerObj.name : '';

      return {
        id: s.id,
        id_code: s.id_code || 'N/A',
        company_name: s.company_name,
        trade_name: s.trade_name,
        city: s.city,
        district: s.district,
        manager_id: s.manager_id,
        managerName,
        visitsAmount,
        oilAmount,
        cost,
      };
    })
    // Apply supplier filters
    .filter(row => {
      if (selectedCity && row.city !== selectedCity) return false;
      if (selectedDistrict && row.district !== selectedDistrict) return false;
      if (selectedManager && row.manager_id !== selectedManager) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesIdCode = row.id_code.toLowerCase().includes(term);
        const matchesCompanyName = row.company_name.toLowerCase().includes(term);
        const matchesTradeName = row.trade_name.toLowerCase().includes(term);
        return matchesIdCode || matchesCompanyName || matchesTradeName;
      }
      return true;
    })
    // Only show row if they had deliveries/visits in the selected period (to be useful)
    .filter(row => row.visitsAmount > 0);

  // Summary row calculations
  const totalVisits = supplierRows.reduce((sum, r) => sum + r.visitsAmount, 0);
  const totalOil = supplierRows.reduce((sum, r) => sum + r.oilAmount, 0);
  const totalCost = supplierRows.reduce((sum, r) => sum + r.cost, 0);

  // Managers list for dropdown filter
  const filterManagers = users.filter(u => u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin');

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Delivered Orders by Suppliers")}</>}
        onBack={onBack}
        backButtonId="reports-suppliers-back"
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
                searchPlaceholder={t("Search suppliers by name, legal entity or taxation credentials...")}
                filters={[
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

      {/* TABLE DATA SPREADSHEET CANVAS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="select-none bg-slate-50 border-b border-gray-200">
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Identification Code")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Company Name")}
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
              {supplierRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                  <td className="py-3.5 px-4 font-mono font-semibold text-gray-500">
                    {row.id_code}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">
                    {row.company_name}
                    <span className="text-[10px] text-gray-400 font-normal block mt-0.5">
                      {row.trade_name} • {row.city}, {row.district}
                    </span>
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

              {supplierRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No matching supplier records found.")}
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {supplierRows.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px] px-4">
                    {t("TOTAL SUMMARY")}
                  </td>
                  <td className="py-4 px-4">
                    {supplierRows.length} {t("active suppliers")}
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
