import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Vendor, Order, User } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import { t } from '../../utils/lang';

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

  // 2. Map all active suppliers with overdue_threshold_days to find if they are overdue
  const deliveryRows = suppliers
    .filter(s => !s.is_deleted && s.overdue_threshold_days !== null && s.overdue_threshold_days !== undefined && s.overdue_threshold_days > 0)
    .map(s => {
      const sOrders = completedOrders.filter(o => o.vendor_id === s.id);
      
      // Sort orders by order_date descending to find the last one
      const sortedOrders = [...sOrders].sort((a, b) => {
        const d1 = a.order_date;
        const d2 = b.order_date;
        return new Date(d2).getTime() - new Date(d1).getTime();
      });

      const lastOrder = sortedOrders[0];
      const lastDateStr = lastOrder ? lastOrder.order_date : '';
      const finalDeliveryDate = lastDateStr ? lastDateStr.split('T')[0] : t('No deliveries');

      let daysAgo: number | null = null;
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
      const managerName = managerObj ? managerObj.name : t('Unassigned');

      const threshold = s.overdue_threshold_days || 0;
      const overdueDays = daysAgo !== null ? daysAgo - threshold : -1;

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
        overdueDays,
        threshold,
      };
    })
    // Only display overdue suppliers (who had last order at least threshold days ago)
    .filter(row => row.daysAgo !== null && row.overdueDays >= 0)
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

  // Sort by overdueDays descending (highest to top, lowest to bottom)
  const sortedDeliveryRows = [...deliveryRows].sort((a, b) => b.overdueDays - a.overdueDays);

  // Calculate metrics for summary row
  const totalSuppliers = sortedDeliveryRows.length;
  const avgOverdueDays =
    totalSuppliers > 0
      ? Math.round(sortedDeliveryRows.reduce((sum, r) => sum + r.overdueDays, 0) / totalSuppliers)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{t("Reports")} <ChevronRight size={20} className="text-gray-400 mx-1" /> {t("Last Deliveries")}</>}
        onBack={onBack}
        backButtonId="reports-last-deliveries-back"
      />

      {/* FILTER BAR DESIGN */}
      <div className="text-left">
        <CentralSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          idPrefix="last-deliveries-search"
          searchPlaceholder={t("Search last deliveries by company, code, manager, city, region, or status...")}
        />
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
                <th className="py-4 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("City / Region")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Manager")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Status")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider">
                  {t("Final Delivery Date")}
                </th>
                <th className="py-3 px-4 text-[10px] text-gray-400 uppercase font-mono font-bold tracking-wider text-right">
                  {t("Days Overdue")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sortedDeliveryRows.map((row) => (
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
                      {t(row.status)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-gray-650">
                    {row.finalDeliveryDate}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-gray-800">
                    {row.overdueDays} {t('days')}
                  </td>
                </tr>
              ))}

              {sortedDeliveryRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-20 text-xs text-gray-400 italic">
                    {t("No matching supplier records found for last deliveries.")}
                  </td>
                </tr>
              )}

              {/* SUMMARY ROW */}
              {sortedDeliveryRows.length > 0 && (
                <tr className="bg-emerald-50/40 text-emerald-900 font-bold border-t-2 border-emerald-500 select-none">
                  <td className="py-4 px-4 font-bold uppercase tracking-wide text-[10px]">
                    {t("TOTAL SUMMARY")}
                  </td>
                  <td className="py-4 px-4">
                    {totalSuppliers} {t("monitored suppliers")}
                  </td>
                  <td colSpan={4} className="py-4 px-4"></td>
                  <td className="py-4 px-4 text-right font-mono text-sm text-emerald-950">
                    {t("Avg:")} {avgOverdueDays} {t("days")}
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
