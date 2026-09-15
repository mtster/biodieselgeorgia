import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Vendor, Order, User } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t, formatDate } from '../../utils/lang';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  onBack: () => void;
}

export default function DeliveredOrdersByManagers({
  suppliers,
  orders,
  users,
  onBack,
}: Props) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch completed orders (not deleted)
  const completedOrders = orders.filter(o => 
    !o.is_deleted && 
    (o.status === 'completed' || String(o.status).toLowerCase() === 'completed')
  );

  // Helper to find vendor
  const findVendor = (vendorId?: string, order?: Order) => {
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    return suppliers.find(s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)) || null;
  };

  // Helper to find manager name
  const getManagerName = (vendor: Vendor | null, order: Order) => {
    const managerId = vendor?.manager_id || order.operator_id || order.created_by;
    if (managerId) {
      const cleanId = String(managerId).trim().toLowerCase();
      const u = users.find(user => user.id === managerId || (user.id && String(user.id).trim().toLowerCase() === cleanId));
      if (u) return u.name;
    }
    return order.operator_name || '-';
  };

  // Managers list for dropdown filter
  const filterManagers = users.filter(
    u => !u.is_deleted && (u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'operator')
  );

  // Filter completed orders
  const filteredOrders = completedOrders
    .filter(o => {
      // Period filter
      if (startDate || endDate) {
        const oDateStr = o.pickup_date_time || o.order_date || o.created_at;
        if (oDateStr) {
          const datePart = oDateStr.split('T')[0];
          if (startDate && datePart < startDate) return false;
          if (endDate && datePart > endDate) return false;
        }
      }

      const vendor = findVendor(o.vendor_id, o);

      // Manager filter
      if (selectedManager) {
        const managerId = vendor?.manager_id || o.operator_id || o.created_by;
        const cleanSelected = String(selectedManager).trim().toLowerCase();
        const cleanMid = managerId ? String(managerId).trim().toLowerCase() : '';
        if (cleanMid !== cleanSelected) return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const trade = (vendor?.trade_name || o.vendor_name || '').toLowerCase();
        const comp = (vendor?.company_name || '').toLowerCase();
        const addr = (vendor?.address || o.address || '').toLowerCase();
        const mName = getManagerName(vendor, o).toLowerCase();
        if (!trade.includes(term) && !comp.includes(term) && !addr.includes(term) && !mName.includes(term)) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      const dateA = a.order_date || a.pickup_date_time || a.created_at || '';
      const dateB = b.order_date || b.pickup_date_time || b.created_at || '';
      return dateB.localeCompare(dateA);
    });

  // Totals
  const totalFactQty = filteredOrders.reduce((sum, o) => {
    const q = o.fact_qty !== undefined && o.fact_qty !== null ? Number(o.fact_qty) : Number(o.qty_requested || 0);
    return sum + (isNaN(q) ? 0 : q);
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Delivered Orders by Managers")}</>}
        onBack={onBack}
        backButtonId="reports-managers-back"
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

            {/* Manager Filter next to Period Filter */}
            <div className="relative min-w-[170px]">
              <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 font-sans uppercase tracking-wider">
                {t("Manager")}
              </span>
              <select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
              >
                <option value="">{t("All Managers")}</option>
                {filterManagers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                ▼
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <CentralSearchBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder={t("Search managers by employee legal name...")}
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
                  {t("Company Name")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Delivered Quantity (L)")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Date")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("City")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Manager")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredOrders.map((ord) => {
                const vendor = findVendor(ord.vendor_id, ord);
                const tradeName = vendor?.trade_name || vendor?.company_name || ord.vendor_name || '-';
                const address = vendor?.address || ord.address || '';
                const city = vendor?.city || ord.city || '-';
                const manager = getManagerName(vendor, ord);
                const factQty = ord.fact_qty !== undefined && ord.fact_qty !== null ? ord.fact_qty : (ord.qty_requested ?? 0);
                const factVal = `${factQty} L`;
                const dateStr = formatDate(ord.order_date || ord.pickup_date_time || ord.created_at);

                return (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-900 text-xs">
                        {tradeName}
                      </div>
                      {address && (
                        <div className="text-[11px] text-gray-400 font-normal truncate max-w-[280px] mt-0.5" title={address}>
                          {address}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-850">
                      {factVal}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-600">
                      {dateStr}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {city}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      {manager}
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No matching manager record aggregates found.")}
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {filteredOrders.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                    {t("TOTAL SUMMARY")}
                  </td>
                  <td className="py-4 px-4 font-mono text-sm text-emerald-950 font-bold">
                    {totalFactQty.toLocaleString()} L
                  </td>
                  <td className="py-4 px-4 text-xs text-gray-600 font-normal">
                    {filteredOrders.length} {t("records")}
                  </td>
                  <td className="py-4 px-4"></td>
                  <td className="py-4 px-4"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
