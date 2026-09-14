import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Vendor, Order, User, City, Warehouse } from '../../types';
import PageHeader from '../PageHeader';
import PeriodFilter from '../PeriodFilter';
import { t, formatDate } from '../../utils/lang';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  cities: City[];
  warehouses: Warehouse[];
  onBack: () => void;
}

export default function OrdersByWarehouse({
  suppliers,
  orders,
  users,
  cities,
  warehouses = [],
  onBack,
}: Props) {
  // Period filter defaults to current date
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedManager, setSelectedManager] = useState('');

  // Manager options
  const filterManagers = users.filter(
    u => !u.is_deleted && (u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'operator')
  );

  // Active warehouses
  const activeWarehouses = warehouses.filter(w => !w.is_deleted);

  // Helper to find vendor
  const findVendor = (vendorId?: string, order?: Order) => {
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    return suppliers.find(s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)) || null;
  };

  // Helper to find warehouse name
  const getWarehouseName = (vendor: Vendor | null, order: Order) => {
    const wId = order.warehouse_id || vendor?.warehouse_id;
    if (wId) {
      const wh = warehouses.find(w => w.id === wId);
      if (wh) return wh.name;
    }
    return order.warehouse_name || '-';
  };

  // Helper to find manager name
  const getManagerName = (vendor: Vendor | null, order: Order) => {
    const managerId = vendor?.manager_id || order.operator_id || order.created_by;
    if (managerId) {
      const u = users.find(user => user.id === managerId);
      if (u) return u.name;
    }
    return order.operator_name || '-';
  };

  // Filter orders
  const filteredOrders = orders
    .filter(o => !o.is_deleted)
    .filter(o => {
      // Period filter
      const oDateStr = o.pickup_date_time || o.order_date;
      if (oDateStr) {
        const datePart = oDateStr.split('T')[0];
        if (startDate && datePart < startDate) return false;
        if (endDate && datePart > endDate) return false;
      }

      const vendor = findVendor(o.vendor_id, o);

      // Warehouse filter
      const whId = o.warehouse_id || vendor?.warehouse_id || '';
      if (selectedWarehouse && whId !== selectedWarehouse) return false;

      // City filter
      const cityVal = vendor?.city || o.city || '';
      if (selectedCity && cityVal !== selectedCity) return false;

      // Manager filter
      const managerId = vendor?.manager_id || o.operator_id || o.created_by;
      if (selectedManager && managerId !== selectedManager) return false;

      return true;
    })
    .sort((a, b) => {
      const dateA = a.order_date || a.pickup_date_time || '';
      const dateB = b.order_date || b.pickup_date_time || '';
      return dateB.localeCompare(dateA);
    });

  // Totals
  const totalFactQty = filteredOrders.reduce((sum, o) => sum + (Number(o.fact_qty) || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Orders by Warehouses")}</>}
        onBack={onBack}
        backButtonId="reports-orders-by-warehouse-back"
      />

      {/* FILTER CONTROLS */}
      <div className="text-left">
        <div className="flex flex-wrap items-center gap-4">
          <PeriodFilter
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />

          {/* Warehouse Filter */}
          <div className="relative min-w-[160px]">
            <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 font-sans uppercase tracking-wider">
              {t("Warehouse")}
            </span>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
            >
              <option value="">{t("All Warehouses")}</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
              ▼
            </div>
          </div>

          {/* City Filter */}
          <div className="relative min-w-[150px]">
            <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 font-sans uppercase tracking-wider">
              {t("City")}
            </span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
            >
              <option value="">{t("All Cities")}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
              ▼
            </div>
          </div>

          {/* Manager Filter */}
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
        </div>
      </div>

      {/* TABLE DATA */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="select-none bg-slate-50 border-b border-gray-200">
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Company Name")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Warehouse")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Picked Up Quantity (L)")}
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
                const warehouseName = getWarehouseName(vendor, ord);
                const city = vendor?.city || ord.city || '-';
                const manager = getManagerName(vendor, ord);
                const factVal = ord.fact_qty !== undefined && ord.fact_qty !== null ? `${ord.fact_qty} L` : '-';
                const dateStr = formatDate(ord.order_date || ord.pickup_date_time);

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
                    <td className="py-3.5 px-4 font-medium text-gray-800">
                      {warehouseName}
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
                  <td colSpan={6} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No records found.")}
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {filteredOrders.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                    {t("TOTAL SUMMARY")}
                  </td>
                  <td className="py-4 px-4"></td>
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
