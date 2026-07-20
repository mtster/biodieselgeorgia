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

export default function TanksTurnoverBySuppliers({
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

  // 1. Identify active suppliers
  const activeSuppliers = suppliers.filter(s => !s.is_deleted);

  // 2. Fetch completed orders
  const completedOrders = orders.filter(o => o.status === 'completed' && !o.is_deleted);

  // 3. Compute tank turnover stats
  const turnoverRows = activeSuppliers
    .map(s => {
      const sOrders = completedOrders.filter(o => o.vendor_id === s.id);

      // A. COMPUTE LEDGER FOR HISTORY BEFORE THE PERIOD STARTED
      const ordersBefore = sOrders.filter(o => {
        if (!startDate) return false;
        const oDateStr = o.pickup_date_time || o.order_date;
        if (!oDateStr) return false;
        const datePart = oDateStr.split('T')[0];
        return datePart < startDate;
      });

      const dropoffBefore = ordersBefore.reduce(
        (sum, o) => sum + (o.fact_tank_dropoff !== undefined ? o.fact_tank_dropoff : o.tanks_to_leave),
        0
      );
      const pickupBefore = ordersBefore.reduce(
        (sum, o) => sum + (o.fact_tank_pickup !== undefined ? o.fact_tank_pickup : o.tanks_to_bring),
        0
      );

      // Standard base barrels of this vendor is s.barrels_amount
      const baseBarrels = s.barrels_amount || 0;
      const openingBalance = baseBarrels + dropoffBefore - pickupBefore;

      // B. COMPUTE LEDGER WITHIN FILTERED PERIOD
      const ordersInPeriod = sOrders.filter(o => {
        const oDateStr = o.pickup_date_time || o.order_date;
        if (!oDateStr) return true;
        const datePart = oDateStr.split('T')[0];
        if (startDate && datePart < startDate) return false;
        if (endDate && datePart > endDate) return false;
        return true;
      });

      const filled = ordersInPeriod.reduce(
        (sum, o) => sum + (o.fact_tank_dropoff !== undefined ? o.fact_tank_dropoff : o.tanks_to_leave),
        0
      );
      const returned = ordersInPeriod.reduce(
        (sum, o) => sum + (o.fact_tank_pickup !== undefined ? o.fact_tank_pickup : o.tanks_to_bring),
        0
      );

      // C. FINAL BALANCE
      const finalBalance = openingBalance + filled - returned;

      const managerObj = users.find(u => u.id === s.manager_id);
      const managerName = managerObj ? managerObj.name : t('Unassigned');

      return {
        id: s.id,
        id_code: s.id_code || 'N/A',
        company_name: s.company_name,
        trade_name: s.trade_name,
        city: s.city,
        district: s.district,
        managerId: s.manager_id,
        managerName,
        openingBalance,
        filled,
        returned,
        finalBalance,
      };
    })
    // Apply supplier filters
    .filter(row => {
      if (selectedCity && row.city !== selectedCity) return false;
      if (selectedDistrict && row.district !== selectedDistrict) return false;
      if (selectedManager && row.managerId !== selectedManager) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesIdCode = row.id_code.toLowerCase().includes(term);
        const matchesCompanyName = row.company_name.toLowerCase().includes(term);
        const matchesTradeName = row.trade_name.toLowerCase().includes(term);
        const matchesManager = row.managerName.toLowerCase().includes(term);
        return matchesIdCode || matchesCompanyName || matchesTradeName || matchesManager;
      }
      return true;
    });

  // Summary counts
  const totalOpening = turnoverRows.reduce((sum, r) => sum + r.openingBalance, 0);
  const totalFilled = turnoverRows.reduce((sum, r) => sum + r.filled, 0);
  const totalReturned = turnoverRows.reduce((sum, r) => sum + r.returned, 0);
  const totalFinal = turnoverRows.reduce((sum, r) => sum + r.finalBalance, 0);

  const filterManagers = users.filter(u => u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin');

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Tanks Turnover by Suppliers")}</>}
        onBack={onBack}
        backButtonId="reports-turnover-back"
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
                searchPlaceholder={t("Search suppliers by name, code, or account managers...")}
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
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("City / Region")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Manager")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-center">
                  {t("Opening Balance")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-center">
                  {t("Filled")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-center">
                  {t("Returned")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-center">
                  {t("Final Balance")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {turnoverRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                  <td className="py-3.5 px-4 font-mono font-semibold text-gray-500">
                    {row.id_code}
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">
                    {row.company_name}
                    <span className="text-[10px] text-gray-400 font-normal block mt-0.5">
                      {row.trade_name}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600">
                    {row.city}
                    <span className="text-[10px] text-gray-400 block mt-0.5">{row.district}</span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600 font-medium">
                    {row.managerName}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-gray-750">
                    {row.openingBalance}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-emerald-800">
                    {row.filled}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-semibold text-amber-800">
                    {row.returned}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-gray-900 bg-slate-50/25">
                    {row.finalBalance}
                  </td>
                </tr>
              ))}

              {turnoverRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No matching supplier records found for tank turnovers.")}
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {turnoverRows.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                    {t("TOTAL SUMMARY")}
                  </td>
                  <td className="py-4 px-4">
                    {turnoverRows.length} {t("active suppliers")}
                  </td>
                  <td colSpan={2} className="py-4 px-4"></td>
                  <td className="py-4 px-4 text-center font-mono text-sm text-emerald-950">
                    {totalOpening}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-sm text-emerald-950">
                    {totalFilled}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-sm text-emerald-950">
                    {totalReturned}
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-sm text-emerald-950">
                    {totalFinal}
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
