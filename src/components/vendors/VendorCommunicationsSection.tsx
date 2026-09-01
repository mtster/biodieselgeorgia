import React, { useState } from 'react';
import { Communication, Vendor, User } from '../../types';
import { t, formatDateTime } from '../../utils/lang';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { MessageSquare, Edit3, Trash2 } from 'lucide-react';
import AddButton from '../AddButton';

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
      header: t('Responsible'),
      key: 'responsible_user_id',
      render: (comm) => {
        if (comm.type !== 'task') return <span className="text-gray-400">-</span>;
        const emp = users.find(u => u.id === comm.responsible_user_id);
        return emp ? <span className="font-medium text-blue-600">{emp.name}</span> : <span className="text-gray-400">-</span>;
      }
    },
    {
      header: t('Task Status'),
      key: 'task_status',
      render: (comm) => {
        if (comm.type !== 'task' || !comm.task_status) return <span className="text-gray-400">-</span>;
        const labelMap: Record<string, string> = {
          pending: t('Pending'),
          in_progress: t('In Progress'),
          completed: t('Completed'),
        };
        const styleMap: Record<string, string> = {
          pending: 'bg-rose-50 text-rose-800 border-rose-100',
          in_progress: 'bg-indigo-50 text-indigo-850 border-indigo-100',
          completed: 'bg-emerald-50 text-emerald-850 border-emerald-100'
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase ${styleMap[comm.task_status] || 'bg-slate-50 text-slate-700'}`}>
            {labelMap[comm.task_status] || comm.task_status}
          </span>
        );
      }
    }
  ];

  const cleanVendorId = String(editingVendor.id || '').trim().toLowerCase();
  const filteredComms = communications.filter(c => {
    if (c.is_deleted) return false;
    if (c.vendor_id === editingVendor.id) return true;
    if (cleanVendorId && String(c.vendor_id || '').trim().toLowerCase() === cleanVendorId) return true;
    return false;
  });

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
          data={filteredComms}
          columns={commColumns}
          onRowClick={(comm) => {
            onEditComm(comm);
          }}
          emptyMessage={t("No previous interactions logged for this supplier.")}
          hidePagination={true}
        />
      </div>
    </div>
  );
}
