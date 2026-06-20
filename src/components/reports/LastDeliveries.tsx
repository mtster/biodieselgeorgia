import React, { useState } from 'react';
import { Vendor, Order, User } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  onBack: () => void;
}

export default function LastDeliveries({
  suppliers,
  orders,
  users,
  onBack,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch completed orders
  const completedOrders = orders.filter(o => o.status === 'completed' && !o.is_deleted);

  // 2. Map all active suppliers to find their last completed delivery
  const deliveryRows = suppliers
    .filter(s => !s.is_deleted)
    .map(s => {
      const sOrders = completedOrders.filter(o => o.vendor_id === s.id);
      
      // Sort orders by date descending to find the last one
      const sortedOrders = [...sOrders].sort((a, b) => {
        const d1 = a.pickup_date_time || a.order_date;
        const d2 = b.pickup_date_time || b.order_date;
        return new Date(d2).getTime() - new Date(d1).getTime();
      });

      const lastOrder = sortedOrders[0];
      const lastDateStr = lastOrder ? (lastOrder.pickup_date_time || lastOrder.order_date) : '';
      const finalDeliveryDate = lastDateStr ? lastDateStr.split('T')[0] : 'No deliveries';

      let daysAgo: number | string = '-';
      if (lastDateStr) {
        const lastDate = new Date(lastDateStr.split('T')[0]);
        const today = new Date();
        // Zero-out hours for precise day diff
        today.setHours(0, 0, 0, 0);
        lastDate.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - lastDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        daysAgo = diffDays < 0 ? 0 : diffDays;
      }

      const managerObj = users.find(u => u.id === s.manager_id);
      const managerName = managerObj ? managerObj.name : 'Unassigned';

      return {
        id: s.id,
        id_code: s.id_code || 'N/A',
        company_name: s.company_name,
        trade_name: s.trade_name,
        city: s.city,
        region: s.district,
        managerName,
        status: s.status || 'Active',
        finalDeliveryDate,
        daysAgo,
      };
    })
    // Apply search filter
    .filter(row => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          row.id_code.toLowerCase().includes(term) ||
          row.company_name.toLowerCase().includes(term) ||
          row.trade_name.toLowerCase().includes(term) ||
          row.city.toLowerCase().includes(term) ||
          row.region.toLowerCase().includes(term) ||
          row.managerName.toLowerCase().includes(term) ||
          row.status.toLowerCase().includes(term)
        );
      }
      return true;
    });

  // Calculate metrics for summary row
  const totalSuppliers = deliveryRows.length;
  const validDaysAgoRows = deliveryRows.filter(r => typeof r.daysAgo === 'number');
  const avgDaysAgo =
    validDaysAgoRows.length > 0
      ? Math.round(validDaysAgoRows.reduce((sum, r) => sum + (r.daysAgo as number), 0) / validDaysAgoRows.length)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports > Last Deliveries"
        onBack={onBack}
        backButtonId="reports-last-deliveries-back"
      />

      {/* FILTER BAR DESIGN */}
      <div className="bg-white p-5 border border-gray-100 rounded-2xl shadow-xs text-left">
        <CentralSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          idPrefix="last-deliveries-search"
          searchPlaceholder="Search last deliveries by company, code, manager, city, region, or status..."
        />
      </div>

      {/* TABLE DATA SPREADSHEET CANVAS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col relative text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="select-none bg-slate-50 border-b border-gray-200">
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  Identification Code
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  Company Name
                </th>
                <th className="py-4 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  City / Region
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  Manager
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  Status
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  Final Delivery Date
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                  Days Ago
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {deliveryRows.map((row) => (
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
                    <span className="text-[10px] text-gray-400 block mt-0.5">{row.region}</span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-600">
                    {row.managerName}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                        row.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : row.status === 'Under Negotiation'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-gray-650">
                    {row.finalDeliveryDate}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800">
                    {typeof row.daysAgo === 'number' ? `${row.daysAgo} days` : row.daysAgo}
                  </td>
                </tr>
              ))}

              {deliveryRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-xs text-gray-400 italic">
                    No matching supplier records found for last deliveries.
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {deliveryRows.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                    TOTAL SUMMARY
                  </td>
                  <td className="py-4 px-4">
                    {totalSuppliers} monitored suppliers
                  </td>
                  <td colSpan={4} className="py-4 px-4"></td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-emerald-950">
                    Avg: {avgDaysAgo} days
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
