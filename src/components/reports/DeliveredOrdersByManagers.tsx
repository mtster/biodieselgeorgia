import React, { useState } from 'react';
import { Vendor, Order, User } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';

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
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch completed orders
  const completedOrders = orders.filter(o => o.status === 'completed' && !o.is_deleted);

  // 2. Identify active suppliers
  const activeSuppliers = suppliers.filter(s => !s.is_deleted);

  // Group by manager_id
  const managerGroupsMap: Record<string, { managerId: string; sIds: string[] }> = {};

  activeSuppliers.forEach(s => {
    // If no manager is assigned, classify as 'Unassigned'
    const mId = s.manager_id || 'unassigned';
    if (!managerGroupsMap[mId]) {
      managerGroupsMap[mId] = {
        managerId: mId,
        sIds: [],
      };
    }
    managerGroupsMap[mId].sIds.push(s.id);
  });

  // 3. Compute stats per manager
  const managerRows = Object.values(managerGroupsMap)
    .map(g => {
      // Find completed orders for these suppliers
      const managerOrders = completedOrders.filter(o => g.sIds.includes(o.vendor_id));

      // Filter by period
      const filteredOrders = managerOrders.filter(o => {
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

      let managerName = 'Unassigned Account';
      if (g.managerId !== 'unassigned') {
        const userObj = users.find(u => u.id === g.managerId);
        managerName = userObj ? userObj.name : 'Unknown Manager';
      }

      return {
        managerId: g.managerId,
        managerName,
        visitsAmount,
        oilAmount,
        cost,
      };
    })
    // Apply search filter (matching manager name)
    .filter(row => {
      if (searchTerm) {
        return row.managerName.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    })
    // Show only managers with active visits
    .filter(row => row.visitsAmount > 0);

  // Summary row calculations
  const totalVisits = managerRows.reduce((sum, r) => sum + r.visitsAmount, 0);
  const totalOil = managerRows.reduce((sum, r) => sum + r.oilAmount, 0);
  const totalCost = managerRows.reduce((sum, r) => sum + r.cost, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports > Delivered Orders by Managers"
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

            <div className="flex-1 min-w-[200px]">
              <CentralSearchBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                searchPlaceholder="Search managers by employee legal name..."
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
                  Manager Name
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-center">
                  Visits Amount
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                  Oil Amount (Liters)
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                  Cost (₾)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {managerRows.map((row) => (
                <tr key={row.managerId} className="hover:bg-slate-50/80 transition-colors text-xs font-sans text-gray-700">
                  <td className="py-3.5 px-4 font-semibold text-gray-900">
                    {row.managerName}
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

              {managerRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-20 text-xs text-gray-400 italic">
                    No matching manager record aggregates found.
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {managerRows.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                    TOTAL SUMMARY
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
