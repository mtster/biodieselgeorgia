import React, { useState, useEffect, useMemo } from 'react';
import { Communication, Vendor, User } from '../../types';
import { t, formatDateTime } from '../../utils/lang';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { MessageSquare, Edit3, Trash2, Loader2 } from 'lucide-react';
import AddButton from '../AddButton';
import { getCommunicationsPaginated } from '../../services/communicationService';

interface Props {
  communications: Communication[];
  editingVendor: Vendor;
  currentUser: User;
  users: User[];
  isReadOnly: boolean;
  onAddComm: () => void;
  onEditComm: (comm: Communication) => void;
  onTriggerDeleteComm: (comm: Communication) => void;
  onSaveCommunication?: (comm: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
}

export default function VendorCommunicationsSection({
  communications,
  editingVendor,
  currentUser,
  users,
  isReadOnly,
  onAddComm,
  onEditComm,
  onTriggerDeleteComm,
  onSaveCommunication,
  onDeleteCommunication
}: Props) {
  const cleanVendorId = String(editingVendor.id || '').trim().toLowerCase();
  const [loadedComms, setLoadedComms] = useState<Communication[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const INITIAL_PAGE_SIZE = 4;
  const SCROLL_PAGE_SIZE = 3;

  // Initial lazy/partial fetch for this supplier (fetch only 4 latest communications)
  useEffect(() => {
    let isMounted = true;
    if (!editingVendor.id) {
      setLoadedComms([]);
      setHasMore(false);
      setOffset(0);
      return;
    }

    setIsLoading(true);
    getCommunicationsPaginated(INITIAL_PAGE_SIZE, 0, { vendorId: editingVendor.id, skipRelatedHydration: true })
      .then(res => {
        if (!isMounted) return;
        const fetched = res.communications || [];
        setLoadedComms(fetched);
        setOffset(fetched.length);
        setHasMore(fetched.length < (res.totalCount || 0));
      })
      .catch(err => {
        console.warn('Failed to lazily load vendor communications:', err);
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
      const res = await getCommunicationsPaginated(SCROLL_PAGE_SIZE, offset, { vendorId: editingVendor.id, skipRelatedHydration: true });
      const newItems = res.communications || [];
      setLoadedComms(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const toAdd = newItems.filter(c => !existingIds.has(c.id));
        return [...prev, ...toAdd];
      });
      const newOffset = offset + newItems.length;
      setOffset(newOffset);
      setHasMore(newOffset < (res.totalCount || 0) && newItems.length > 0);
    } catch (err) {
      console.warn('Failed to load more communications:', err);
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

  // Keep loadedComms synchronized if a communication was created or updated during this modal session
  useEffect(() => {
    if (!communications || communications.length === 0) return;
    const currentVendorComms = communications.filter(c => 
      !c.is_deleted && (c.vendor_id === editingVendor.id || (cleanVendorId && String(c.vendor_id || '').trim().toLowerCase() === cleanVendorId))
    );
    if (currentVendorComms.length === 0) return;

    setLoadedComms(prev => {
      if (prev.length === 0) return prev;
      const prevIds = new Set(prev.map(c => c.id));
      const newlyCreated = currentVendorComms.filter(c => !prevIds.has(c.id));
      if (newlyCreated.length === 0) {
        return prev.map(p => {
          const match = currentVendorComms.find(c => c.id === p.id);
          return match || p;
        });
      }
      return [...newlyCreated, ...prev];
    });
  }, [communications, editingVendor.id, cleanVendorId]);

  const displayComms = useMemo(() => {
    const map = new Map<string, Communication>();
    loadedComms.forEach(c => {
      if (!c.is_deleted) map.set(c.id, c);
    });
    (communications || []).forEach(c => {
      if (!c.is_deleted) {
        map.set(c.id, c);
      } else {
        map.delete(c.id);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      return new Date(b.date_time || 0).getTime() - new Date(a.date_time || 0).getTime();
    });
  }, [loadedComms, communications]);

  const commColumns: ColumnConfig<Communication>[] = [
    {
      header: t('Date & Time'),
      key: 'date_time',
      render: (comm) => {
        return (
          <span className="font-mono text-xs">{formatDateTime(comm.date_time)}</span>
        );
      }
    },
    {
      header: t('Type'),
      key: 'type',
      className: 'text-center',
      render: (comm) => {
        const styleMap: Record<string, string> = {
          action: 'bg-emerald-50 text-emerald-800 border-emerald-100',
          reminder: 'bg-amber-50 text-amber-800 border-amber-100',
          task: 'bg-blue-50 text-blue-800 border-blue-105',
        };
        const labelMap: Record<string, string> = {
          action: t('Action'),
          reminder: t('Reminder'),
          task: t('Task'),
        };
        const statusClass = styleMap[comm.type] || 'bg-slate-50 text-slate-700 border-slate-100';
        const label = labelMap[comm.type] || comm.type;
        return (
          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${statusClass}`}>
            {t(label)}
          </span>
        );
      }
    },
    {
      header: t('Interaction Details / Comment'),
      key: 'comment',
      className: 'whitespace-normal max-w-[200px] md:max-w-[320px] break-words',
      render: (comm) => (
        <div className="whitespace-normal break-words max-w-[200px] md:max-w-[320px] line-clamp-3 text-left leading-normal" title={comm.comment}>
          {comm.comment}
        </div>
      )
    },
    {
      header: t('Logged By'),
      key: 'user_name',
      render: (comm) => {
        // Resolve author using created_by column from database communications table, falling back to user_id or users list
        const authorUser = users.find(u => {
          if (comm.created_by) {
            if (u.id === comm.created_by || u.id?.toLowerCase() === comm.created_by?.toLowerCase()) return true;
            if (u.email && u.email.toLowerCase() === comm.created_by.toLowerCase()) return true;
            if (u.name && u.name.toLowerCase() === comm.created_by.toLowerCase()) return true;
          }
          if (comm.user_id) {
            if (u.id === comm.user_id || u.id?.toLowerCase() === comm.user_id?.toLowerCase()) return true;
          }
          return false;
        });

        const authorName = authorUser?.name || 
          (comm.created_by && !comm.created_by.includes('-') && comm.created_by.length < 40 ? comm.created_by : '') ||
          comm.user_name || 
          (comm.created_by === currentUser.id || comm.user_id === currentUser.id ? currentUser.name : '') ||
          '-';

        return (
          <span className="font-medium text-slate-600">{authorName}</span>
        );
      }
    },
    {
      header: t('Responsible User'),
      key: 'responsible_user_id',
      render: (comm) => {
        const respId = comm.responsible_user_id || comm.user_id;
        if (!respId) {
          const fallbackName = (comm as any).responsible_user_name || (comm as any).user_name;
          return fallbackName ? <span className="font-semibold text-gray-800">{fallbackName}</span> : <span className="text-gray-400">-</span>;
        }
        const cleanId = String(respId).trim().toLowerCase();
        const emp = users.find(u => u.id === respId || (u.id && String(u.id).trim().toLowerCase() === cleanId));
        const authorName = emp?.name || 
          (comm as any).responsible_user?.name || 
          (comm as any).user?.name || 
          (cleanId === String(currentUser.id).trim().toLowerCase() ? currentUser.name : null) || 
          (comm as any).responsible_user_name || 
          (comm as any).user_name || 
          (!cleanId.includes('-') && cleanId.length < 40 ? respId : '') ||
          '-';
        return authorName !== '-' ? (
          <span className="font-semibold text-gray-800">{authorName}</span>
        ) : (
          <span className="text-gray-400">-</span>
        );
      }
    },
    {
      header: t('Status'),
      key: 'task_status',
      className: 'text-center',
      render: (comm) => {
        const isCompleted = typeof comm.is_completed === 'boolean' 
          ? comm.is_completed 
          : comm.task_status === 'completed';

        if (comm.type !== 'task' && comm.is_completed === undefined && !comm.task_status) {
          return <span className="text-gray-400">-</span>;
        }

        if (isCompleted) {
          return (
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border-emerald-100">
              {t('Completed')}
            </span>
          );
        }

        return (
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase bg-blue-50 text-blue-800 border-blue-100">
            {t('Active')}
          </span>
        );
      }
    }
  ];

  return (
    <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
        <span className="text-xs font-bold uppercase text-gray-500 tracking-wider font-sans">
          {t("Communications")}
        </span>
        {!isReadOnly && (
          <AddButton
            label="Add Communication"
            onClick={onAddComm}
          />
        )}
      </div>

      <div className="pt-1">
        <StandardTable
          data={displayComms}
          columns={commColumns}
          onRowClick={(comm) => {
            onEditComm(comm);
          }}
          emptyMessage={t("No previous interactions logged for this supplier.")}
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
