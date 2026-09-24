import React, { useState, useEffect, useMemo } from 'react';
import { Communication, User, Vendor, VendorContact } from '../../types';
import { t, formatDateTime, formatDate } from '../../utils/lang';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { getCommunicationsPaginated, saveCommunication, deleteCommunication } from '../../services/communicationService';
import { getVendorContacts } from '../../services/vendorService';
import VendorCommunicationModal from '../vendors/VendorCommunicationModal';
import ConfirmDeleteModal from '../ConfirmDeleteModal';

interface Props {
  vendorId: string;
  vendor?: Vendor | null;
  users?: User[];
  currentUser?: User;
  onSaveCommunication?: (comm: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
  title?: string;
  panelId?: string;
  selectedCommId?: string;
}

export default function OrderCommunicationsSection({
  vendorId,
  vendor,
  users = [],
  currentUser,
  onSaveCommunication,
  onDeleteCommunication,
  title,
  panelId,
  selectedCommId
}: Props) {
  const [loadedComms, setLoadedComms] = useState<Communication[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Communication modal state
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [activeComm, setActiveComm] = useState<Communication | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [commToDelete, setCommToDelete] = useState<Communication | null>(null);

  // Vendor contacts state for dropdown in modal
  const [vendorContacts, setVendorContacts] = useState<VendorContact[]>([]);

  const INITIAL_PAGE_SIZE = 4;
  const SCROLL_PAGE_SIZE = 3;

  // Ultra-fast initial fetch when vendor is selected or changes
  useEffect(() => {
    let isMounted = true;
    if (!vendorId) {
      setLoadedComms([]);
      setOffset(0);
      setHasMore(false);
      setTotalCount(0);
      return;
    }

    setIsLoading(true);
    getCommunicationsPaginated(INITIAL_PAGE_SIZE, 0, { vendorId })
      .then(res => {
        if (!isMounted) return;
        const fetched = res.communications || [];
        setLoadedComms(fetched);
        setOffset(fetched.length);
        const total = res.totalCount || 0;
        setTotalCount(total);
        setHasMore(fetched.length < total);
      })
      .catch(err => {
        console.warn('Failed to load communications for vendor in orders form:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [vendorId]);

  // Load contacts for this vendor so the communication modal has contacts dropdown options
  useEffect(() => {
    let isMounted = true;
    if (!vendorId) {
      setVendorContacts([]);
      return;
    }

    if (vendor?.contacts && vendor.contacts.length > 0) {
      setVendorContacts(vendor.contacts);
    }

    getVendorContacts(vendorId)
      .then(contacts => {
        if (isMounted && contacts && contacts.length > 0) {
          setVendorContacts(contacts);
        }
      })
      .catch(err => {
        console.warn('Failed to load contacts for order vendor communications:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [vendorId, vendor?.contacts]);

  // Load next batch of 3 communications on scrolldown
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || !vendorId) return;
    setIsLoadingMore(true);
    try {
      const res = await getCommunicationsPaginated(SCROLL_PAGE_SIZE, offset, { vendorId });
      const newItems = res.communications || [];
      setLoadedComms(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const toAdd = newItems.filter(c => !existingIds.has(c.id));
        return [...prev, ...toAdd];
      });
      const newOffset = offset + newItems.length;
      setOffset(newOffset);
      const total = res.totalCount || totalCount;
      setTotalCount(total);
      setHasMore(newOffset < total && newItems.length > 0);
    } catch (err) {
      console.warn('Failed to load more communications on scroll in orders form:', err);
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

  const resolvedVendor: Vendor = useMemo(() => {
    if (vendor) return vendor;
    return {
      id: vendorId,
      id_code: '',
      company_name: '',
      trade_name: '',
      company_code: '',
      bank_account: '',
      address: '',
      city: '',
      district: '',
      direction: '',
      status: 'active'
    } as unknown as Vendor;
  }, [vendor, vendorId]);

  const activeUser: User = useMemo(() => {
    if (currentUser) return currentUser;
    if (users.length > 0) return users[0];
    return {
      id: 'system',
      name: 'System',
      personal_id: '',
      email: '',
      phone: '',
      role: 'admin'
    };
  }, [currentUser, users]);

  const handleSaveCommunication = async (payload: Communication) => {
    try {
      if (onSaveCommunication) {
        await onSaveCommunication(payload);
      } else {
        await saveCommunication(payload, activeUser.name, activeUser.id);
      }
      setLoadedComms(prev => {
        const idx = prev.findIndex(c => c.id === payload.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = payload;
          return updated;
        }
        return [payload, ...prev];
      });
      setIsCommModalOpen(false);
      setActiveComm(null);
    } catch (err) {
      console.error('Failed to save communication in orders form:', err);
    }
  };

  const handleTriggerDelete = (id: string) => {
    const toDelete = loadedComms.find(c => c.id === id) || activeComm;
    setCommToDelete(toDelete || null);
    setIsCommModalOpen(false);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!commToDelete) return;
    try {
      if (onDeleteCommunication) {
        await onDeleteCommunication(commToDelete.id);
      } else {
        await deleteCommunication(commToDelete.id, activeUser.name);
      }
      setLoadedComms(prev => prev.filter(c => c.id !== commToDelete.id));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to delete communication in orders form:', err);
    } finally {
      setIsDeleteModalOpen(false);
      setCommToDelete(null);
      setActiveComm(null);
    }
  };

  const commColumns: ColumnConfig<Communication>[] = [
    {
      header: 'შეხსენების დრო',
      key: 'reminder_time',
      className: 'whitespace-nowrap',
      render: (comm) => {
        if (!comm.reminder_time) return <span className="text-gray-400">-</span>;
        return (
          <span className="font-mono text-xs text-gray-800">
            {comm.has_time ? formatDateTime(comm.reminder_time) : formatDate(comm.reminder_time)}
          </span>
        );
      }
    },
    {
      header: 'ტიპი',
      key: 'type',
      className: 'whitespace-nowrap',
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
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${statusClass}`}>
            {t(label)}
          </span>
        );
      }
    },
    {
      header: 'კომენტარი',
      key: 'comment',
      className: 'whitespace-normal min-w-[140px] max-w-[260px] break-words',
      render: (comm) => (
        <div className="whitespace-normal break-words min-w-[140px] max-w-[260px] line-clamp-2 text-left leading-normal text-xs text-gray-700" title={comm.comment}>
          {comm.comment || '-'}
        </div>
      )
    },
    {
      header: 'შექმნა',
      key: 'created_by',
      className: 'whitespace-nowrap',
      render: (comm) => {
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
          '-';

        return (
          <span className="font-medium text-slate-700 text-xs truncate max-w-[120px] block" title={authorName}>
            {authorName}
          </span>
        );
      }
    },
    {
      header: 'შეიქმნა',
      key: 'created_at',
      className: 'whitespace-nowrap',
      render: (comm) => {
        const timestamp = comm.created_at || comm.date_time;
        if (!timestamp) return <span className="text-gray-400">-</span>;
        return (
          <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
            {formatDateTime(timestamp)}
          </span>
        );
      }
    }
  ];

  return (
    <div 
      className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs w-full max-w-full overflow-hidden animate-in fade-in slide-in-from-right-3 duration-200 text-left"
      id={panelId || "order-supplier-communications-panel"}
    >
      {/* Header matching Supplier Comments style and size */}
      <div className="border-b border-gray-100 pb-2 mb-3 flex items-center justify-between">
        <span className="text-xs font-black uppercase text-gray-400 tracking-wider block font-sans">
          {title || t("Communications")}
        </span>
        {totalCount > 0 && (
          <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            {totalCount}
          </span>
        )}
      </div>

      <div className="pt-1">
        <StandardTable
          data={loadedComms}
          columns={commColumns}
          emptyMessage={t("No previous interactions logged for this supplier.")}
          hidePagination={true}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          tableScrollClassName="max-h-[178px] overflow-y-auto"
          onScroll={handleTableScroll}
          rowClassName={(comm) => {
            const isSelected = selectedCommId && comm.id === selectedCommId;
            return isSelected ? 'bg-emerald-50/70 hover:bg-emerald-100/70' : 'hover:bg-slate-50';
          }}
          onRowClick={(comm) => {
            if (selectedCommId && comm.id === selectedCommId) {
              return;
            }
            setActiveComm(comm);
            setIsCommModalOpen(true);
          }}
        />
      </div>

      {/* Regular Communication Modal - exact same modal as suppliersform > communications */}
      <VendorCommunicationModal
        isOpen={isCommModalOpen}
        onClose={() => {
          setIsCommModalOpen(false);
          setActiveComm(null);
        }}
        activeComm={activeComm}
        currentUser={activeUser}
        users={users}
        tempContacts={vendorContacts}
        editingVendor={resolvedVendor}
        onSaveCommunication={handleSaveCommunication}
        onDeleteCommunication={handleTriggerDelete}
      />

      {/* Confirmation modal on delete */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCommToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title={t("Delete Communication?")}
        message={t("Are you sure you want to delete this communication record?")}
      />
    </div>
  );
}
