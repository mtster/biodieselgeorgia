import React, { useState, useEffect, useMemo } from 'react';
import { Order, Vendor, User } from '../../types';
import { t, formatDate, formatDateTime, formatOrderCompletionTime } from '../../utils/lang';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { CalendarClock } from 'lucide-react';
import { getOrdersPaginated } from '../../services/orderService';

interface Props {
  editingVendor: Vendor;
  users: User[];
}

export default function VendorOrdersSection({
  editingVendor,
  users
}: Props) {
  const [loadedOrders, setLoadedOrders] = useState<Order[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const INITIAL_PAGE_SIZE = 4;
  const SCROLL_PAGE_SIZE = 3;

  // Initial lazy/partial fetch for this supplier (fetch 4 latest orders chronologically by order_date)
  useEffect(() => {
    let isMounted = true;
    if (!editingVendor.id) {
      setLoadedOrders([]);
      setHasMore(false);
      setOffset(0);
      return;
    }

    setIsLoading(true);
    getOrdersPaginated(INITIAL_PAGE_SIZE, 0, {
      vendorId: editingVendor.id,
      sortBy: 'order_date_desc',
      skipRelatedHydration: true
    })
      .then(res => {
        if (!isMounted) return;
        const fetched = res.orders || [];
        setLoadedOrders(fetched);
        setOffset(fetched.length);
        setHasMore(fetched.length < (res.totalCount || 0));
      })
      .catch(err => {
        console.warn('Failed to lazily load vendor orders:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [editingVendor.id]);

  // Load next batch (fetch another 3) when scrolling down the table
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || !editingVendor.id) return;
    setIsLoadingMore(true);
    try {
      const res = await getOrdersPaginated(SCROLL_PAGE_SIZE, offset, {
        vendorId: editingVendor.id,
        sortBy: 'order_date_desc',
        skipRelatedHydration: true
      });
      const newItems = res.orders || [];
      setLoadedOrders(prev => {
        const existingIds = new Set(prev.map(o => o.id));
        const toAdd = newItems.filter(o => !existingIds.has(o.id));
        return [...prev, ...toAdd];
      });
      const newOffset = offset + newItems.length;
      setOffset(newOffset);
      setHasMore(newOffset < (res.totalCount || 0) && newItems.length > 0);
    } catch (err) {
      console.warn('Failed to load more orders:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      if (hasMore && !isLoadingMore && !isLoading) {
        handleLoadMore();
      }
    }
  };

  const displayOrders = useMemo(() => {
    return [...loadedOrders]
      .filter(o => !o.is_deleted)
      .sort((a, b) => {
        const orderB = b.order_date ? new Date(b.order_date).getTime() : 0;
        const orderA = a.order_date ? new Date(a.order_date).getTime() : 0;
        if (orderB !== orderA) return orderB - orderA;
        const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
        const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
        return createdB - createdA;
      });
  }, [loadedOrders]);

  const orderColumns: ColumnConfig<Order>[] = [
    {
      header: t('Order Date'),
      key: 'order_date',
      render: (ord) => formatDate(ord.order_date)
    },
    {
      header: t('Status'),
      key: 'status',
      className: 'whitespace-nowrap',
      render: (ord) => {
        const s = ord.status;
        let label = t(s);
        if (s === 'driver_assigned') label = t('Driver Assigned');
        else if (s === 'picked_up') label = t('Picked Up');
        else if (s === 'completed') label = t('Completed');
        else if (s === 'cancelled') label = t('cancelled');
        else if (s === 'uncompleted') label = t('uncompleted');
        else if (s === 'registered') label = t('registered');

        const statusStyles: Record<string, string> = {
          completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          driver_assigned: 'bg-blue-50 text-blue-800 border-blue-200',
          picked_up: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          registered: 'bg-slate-100 text-slate-700 border-slate-200',
          cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
          uncompleted: 'bg-amber-50 text-amber-800 border-amber-200',
        };

        const badgeClass = statusStyles[s] || 'bg-slate-50 text-slate-700 border-slate-200';

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wide whitespace-nowrap ${badgeClass}`}>
            {label}
          </span>
        );
      }
    },
    {
      header: t('Completion Time'),
      key: 'completed_at',
      render: (ord) => ord.completed_at ? formatOrderCompletionTime(ord.completed_at) : '-'
    },
    {
      header: t('Comment'),
      key: 'comment',
      render: (ord) => {
        const notes = ord.notes && ord.notes.length > 0 ? ord.notes : null;
        if (notes && notes.length > 0) {
          const hasImportant = notes.some(n => n.before_leaving_base);
          const priorityNote = notes.find(n => n.before_leaving_base) || notes[0];

          return (
            <div
              className="flex items-center gap-1.5 max-w-[240px]"
              title={notes.map(n => {
                const a = (users?.find(e => e.id === n.user_id)?.name) || n.user_name || '';
                return `${a ? a + ': ' : ''}${n.comment}${n.before_leaving_base ? ' [ბაზიდან გასვლამდე საყურადღებო]' : ''}`;
              }).join('\n')}
            >
              {hasImportant && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold shrink-0 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                  საყურადღებო
                </span>
              )}
              <span className={`truncate text-xs ${hasImportant ? 'text-rose-700 font-semibold' : 'text-gray-700'}`}>
                {priorityNote.comment}
              </span>
              {notes.length > 1 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 text-gray-500 rounded font-mono shrink-0">
                  +{notes.length - 1}
                </span>
              )}
            </div>
          );
        }
        return ord.note ? (
          <span className="truncate text-xs text-gray-700 max-w-[200px] block" title={ord.note}>{ord.note}</span>
        ) : '-';
      }
    },
    {
      header: (
        <div className="flex flex-col items-center justify-center leading-[1.05] tracking-tight py-0 select-none">
          <span className="text-[9px] font-bold text-amber-800">შეკვ.</span>
          <span className="text-[9px] font-extrabold text-amber-950">რაოდენობა</span>
        </div>
      ),
      key: 'planned',
      className: 'bg-amber-50/70 font-semibold text-gray-950 px-1 text-center w-16 max-w-[72px]',
      render: (ord) => ord.qty_requested != null ? `${ord.qty_requested} ლ` : '-'
    },
    {
      header: (
        <div className="flex flex-col items-center justify-center leading-[1.05] tracking-tight py-0 select-none">
          <span className="text-[9px] font-bold text-amber-800">შეკვ.</span>
          <span className="text-[9px] font-extrabold text-amber-950">გამოტანა</span>
        </div>
      ),
      key: 'tanks_to_bring',
      className: 'bg-amber-50/70 font-semibold text-gray-950 px-1 text-center w-14 max-w-[64px]',
      render: (ord) => ord.tanks_to_bring != null ? `${ord.tanks_to_bring}` : '-'
    },
    {
      header: (
        <div className="flex flex-col items-center justify-center leading-[1.05] tracking-tight py-0 select-none">
          <span className="text-[9px] font-bold text-amber-800">შეკვ.</span>
          <span className="text-[9px] font-extrabold text-amber-950">დატოვება</span>
        </div>
      ),
      key: 'tanks_to_leave',
      className: 'bg-amber-50/70 font-semibold text-gray-950 px-1 text-center w-14 max-w-[64px]',
      render: (ord) => ord.tanks_to_leave != null ? `${ord.tanks_to_leave}` : '-'
    },
    {
      header: (
        <div className="flex flex-col items-center justify-center leading-[1.05] tracking-tight py-0 select-none">
          <span className="text-[9px] font-bold text-sky-800">ფაქტ.</span>
          <span className="text-[9px] font-extrabold text-sky-950">რაოდენობა</span>
        </div>
      ),
      key: 'fact_qty',
      className: 'bg-sky-100/75 font-semibold text-sky-950 px-1 text-center w-16 max-w-[72px]',
      render: (ord) => ord.fact_qty != null ? `${ord.fact_qty} ლ` : '-'
    },
    {
      header: (
        <div className="flex flex-col items-center justify-center leading-[1.05] tracking-tight py-0 select-none">
          <span className="text-[9px] font-bold text-sky-800">ფაქტ.</span>
          <span className="text-[9px] font-extrabold text-sky-950">გამოტანა</span>
        </div>
      ),
      key: 'fact_tank_pickup',
      className: 'bg-sky-100/75 font-semibold text-sky-950 px-1 text-center w-14 max-w-[64px]',
      render: (ord) => ord.fact_tank_pickup === undefined || ord.fact_tank_pickup === null ? '-' : ord.fact_tank_pickup
    },
    {
      header: (
        <div className="flex flex-col items-center justify-center leading-[1.05] tracking-tight py-0 select-none">
          <span className="text-[9px] font-bold text-sky-800">ფაქტ.</span>
          <span className="text-[9px] font-extrabold text-sky-950">დატოვება</span>
        </div>
      ),
      key: 'fact_tank_dropoff',
      className: 'bg-sky-100/75 font-semibold text-sky-950 px-1 text-center w-14 max-w-[64px]',
      render: (ord) => ord.fact_tank_dropoff === undefined || ord.fact_tank_dropoff === null ? '-' : ord.fact_tank_dropoff
    },
    {
      header: t('Created By') || 'შექმნა',
      key: 'operator_id',
      render: (ord) => {
        const isPlanned = (!ord.operator_id && !ord.created_by) || (Array.isArray(ord.notes) && ord.notes.some(n => n?.comment?.includes('გეგმიური') || n?.comment?.toLowerCase().includes('automated scheduled')));
        if (isPlanned) {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/70 shadow-2xs tracking-wide select-none" title="ავტომატური გეგმიური შეკვეთა">
              <CalendarClock size={12} className="text-emerald-600 shrink-0" />
              <span>გეგმიური</span>
            </span>
          );
        }
        const creatorId = ord.operator_id || ord.created_by;
        if (!creatorId) return <span className="text-gray-400 text-xs">-</span>;
        const cleanCreator = String(creatorId).trim().toLowerCase();
        const emp = users.find(e => e.id === creatorId || (e.id && String(e.id).trim().toLowerCase() === cleanCreator));
        return <span className="text-gray-800 text-xs font-normal">{emp ? emp.name : (ord.operator_name || '-')}</span>;
      }
    },
    {
      header: t('Created At') || 'შეიქმნა',
      key: 'created_at',
      render: (ord) => ord.created_at ? formatDateTime(ord.created_at) : '-'
    }
  ];

  return (
    <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
        <span className="text-xs font-bold uppercase text-gray-500 tracking-wider font-sans">
          {t("Orders")}
        </span>
      </div>

      <div className="pt-1">
        <StandardTable
          data={displayOrders}
          columns={orderColumns}
          emptyMessage={t("No active collection order entries were located.")}
          hidePagination={true}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          tableScrollClassName="max-h-[178px] overflow-y-auto"
          onScroll={handleTableScroll}
        />
      </div>
    </div>
  );
}
