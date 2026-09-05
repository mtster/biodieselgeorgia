import React, { useState, useEffect } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Vendor, Order, User } from '../../types';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import { t } from '../../utils/lang';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface Props {
  suppliers: Vendor[];
  orders: Order[];
  users: User[];
  onBack: () => void;
}

// Highly reliable timezone-safe days difference function
function getDaysDiff(dateStr: string): number {
  if (!dateStr) return 0;
  // Match YYYY-MM-DD format (e.g., "2026-06-29")
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    // Fallback to standard UTC matching if non-standard format
    const lastDate = new Date(dateStr);
    const today = new Date();
    const utc1 = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    const utc2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
  }
  
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // Month is 0-indexed in JS
  const day = parseInt(match[3], 10);
  
  const lastDateUtc = Date.UTC(year, month, day);
  
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffTime = todayUtc - lastDateUtc;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays < 0 ? 0 : diffDays;
}

export interface OverdueVendorRow {
  id: string;
  id_code: string;
  company_name: string;
  trade_name: string;
  city: string;
  region: string;
  managerName: string;
  status: string;
  finalDeliveryDate: string;
  daysAgo: number;
  overdueDays: number;
  threshold: number;
}

export default function LastDeliveries({
  suppliers,
  orders,
  users,
  onBack,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [overdueRecords, setOverdueRecords] = useState<OverdueVendorRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function fetchOverdueVendors() {
      setLoading(true);
      try {
        if (isSupabaseConfigured && supabase) {
          // 1. Primary: Execute high-speed LEFT JOIN LATERAL PostgreSQL RPC function
          // Index used: idx_orders_vendor_completed_date_desc (vendor_id, order_date DESC) WHERE status = 'completed'
          const { data, error } = await supabase.rpc('get_overdue_vendors');

          if (!error && Array.isArray(data) && !isCancelled) {
            const mapped: OverdueVendorRow[] = data.map((row: any) => {
              const managerObj = users.find(u => u.id === row.manager_id);
              const managerName = managerObj ? managerObj.name : t('Unassigned');
              const finalDeliveryDate = row.last_order_date ? row.last_order_date.split('T')[0] : t('No deliveries');
              return {
                id: row.id,
                id_code: row.id_code || 'N/A',
                company_name: row.company_name || '',
                trade_name: row.trade_name || '',
                city: row.city || '',
                region: row.district || '',
                managerName,
                status: 'Active',
                finalDeliveryDate,
                daysAgo: row.days_ago,
                overdueDays: row.overdue_days,
                threshold: row.overdue_threshold_days || 30,
              };
            });
            setOverdueRecords(mapped);
            return;
          }
        }

        // 2. Fallback: Query single newest completed order per vendor and evaluate overdue criteria
        await runClientFallback();
      } catch (err) {
        console.warn('Failed to load via RPC, running fallback:', err);
        await runClientFallback();
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    async function runClientFallback() {
      if (isCancelled) return;
      const latestMap: Record<string, string> = {};

      if (isSupabaseConfigured && supabase) {
        // Leverages (vendor_id, order_date DESC) index
        const { data: ords } = await supabase
          .from('orders')
          .select('vendor_id, order_date')
          .eq('is_deleted', false)
          .eq('status', 'completed')
          .order('order_date', { ascending: false });

        if (ords && ords.length > 0) {
          for (const ord of ords) {
            if (ord.vendor_id && !latestMap[ord.vendor_id] && ord.order_date) {
              latestMap[ord.vendor_id] = ord.order_date;
            }
          }
        }
      } else {
        const completedOrders = orders.filter(o => o.status === 'completed' && !o.is_deleted && o.order_date);
        for (const ord of completedOrders) {
          if (!latestMap[ord.vendor_id] || new Date(ord.order_date) > new Date(latestMap[ord.vendor_id])) {
            latestMap[ord.vendor_id] = ord.order_date;
          }
        }
      }

      // Strictly active suppliers only (is_active !== false)
      const activeSuppliers = suppliers.filter(s => !s.is_deleted && s.is_active !== false);
      const calculated: OverdueVendorRow[] = [];

      for (const s of activeSuppliers) {
        const lastDateStr = latestMap[s.id];
        const managerObj = users.find(u => u.id === s.manager_id);
        const managerName = managerObj ? managerObj.name : t('Unassigned');

        if (lastDateStr) {
          // Vendor had orders: check overdue_threshold_days
          const threshold = s.overdue_threshold_days;
          if (threshold !== null && threshold !== undefined && threshold > 0) {
            const daysAgo = getDaysDiff(lastDateStr);
            const overdueDays = daysAgo - threshold;
            if (overdueDays > 0) {
              calculated.push({
                id: s.id,
                id_code: s.id_code || 'N/A',
                company_name: s.company_name,
                trade_name: s.trade_name,
                city: s.city,
                region: s.district,
                managerName,
                status: 'Active',
                finalDeliveryDate: lastDateStr.split('T')[0],
                daysAgo,
                overdueDays,
                threshold,
              });
            }
          }
        } else {
          // Newly added vendor with NO orders: check if 30 days have passed since created_at
          const daysSinceCreation = getDaysDiff(s.created_at || new Date().toISOString());
          if (daysSinceCreation > 30) {
            const overdueDays = daysSinceCreation - 30;
            calculated.push({
              id: s.id,
              id_code: s.id_code || 'N/A',
              company_name: s.company_name,
              trade_name: s.trade_name,
              city: s.city,
              region: s.district,
              managerName,
              status: 'Active',
              finalDeliveryDate: t('No deliveries'),
              daysAgo: daysSinceCreation,
              overdueDays,
              threshold: 30,
            });
          }
        }
      }

      setOverdueRecords(calculated);
    }

    fetchOverdueVendors();

    return () => {
      isCancelled = true;
    };
  }, [suppliers, orders, users]);

  // Apply search filter
  const deliveryRows = overdueRecords.filter(row => {
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="animate-spin text-emerald-600" size={32} />
            <p className="text-xs text-gray-450 italic font-medium">{t("Calculating live overdue statuses...")}</p>
          </div>
        ) : (
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
                      {row.trade_name}
                      <span className="text-[10px] text-gray-400 font-normal block mt-0.5">
                        {row.company_name}
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
        )}
      </div>
    </div>
  );
}
