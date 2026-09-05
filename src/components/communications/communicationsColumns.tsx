import React from 'react';
import { Check } from 'lucide-react';
import { Communication, Vendor, User } from '../../types';
import { ColumnConfig } from '../StandardTable';
import { t, formatDateTime, formatDate } from '../../utils/lang';

interface ColumnOptions {
  suppliers: Vendor[];
  employees: User[];
  currentEmployee: User;
  selectedComms: string[];
  setSelectedComms: React.Dispatch<React.SetStateAction<string[]>>;
}

export function getCommunicationsColumns({
  suppliers,
  employees,
  currentEmployee,
  selectedComms,
  setSelectedComms
}: ColumnOptions, managedCols: { id: string; label: string; visible: boolean }[]): ColumnConfig<Communication>[] {

  const findSupplier = (vendorId?: string) => {
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    return suppliers.find(s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)) || null;
  };

  const columnMap: Record<string, ColumnConfig<Communication>> = {
    date_time: {
      header: t('Created'),
      key: 'date_time',
      render: (comm) => formatDateTime(comm.date_time)
    },
    type: {
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
            {label}
          </span>
        );
      }
    },
    vendor_name: {
      header: t('Supplier'),
      key: 'vendor_name',
      className: 'max-w-[180px] truncate',
      render: (comm) => {
        const suppObj = findSupplier(comm.vendor_id);
        const name = (suppObj?.trade_name || suppObj?.company_name) || comm.vendor_name || t('Supplier');
        return (
          <div className="max-w-[180px] truncate" title={name}>
            {name}
          </div>
        );
      }
    },
    company_name: {
      header: t('Company Name'),
      key: 'company_name',
      render: (comm) => {
        const suppObj = findSupplier(comm.vendor_id);
        return suppObj ? (suppObj.company_name || suppObj.trade_name || '-') : '-';
      }
    },
    id_code: {
      header: t('Identification Code'),
      key: 'id_code',
      render: (comm) => {
        const suppObj = findSupplier(comm.vendor_id);
        return suppObj ? suppObj.id_code : '-';
      }
    },
    user_name: {
      header: t('Operator / User'),
      key: 'user_name',
      render: (comm) => {
        const empObj = employees.find(e => 
          (comm.created_by && (e.id === comm.created_by || e.id?.toLowerCase() === comm.created_by?.toLowerCase() || e.email?.toLowerCase() === comm.created_by?.toLowerCase() || e.name?.toLowerCase() === comm.created_by?.toLowerCase())) ||
          (comm.user_id && (e.id === comm.user_id || e.id?.toLowerCase() === comm.user_id?.toLowerCase()))
        );
        return empObj ? empObj.name : (comm.user_name || (comm.created_by && !comm.created_by.includes('-') ? comm.created_by : '') || t('Operator'));
      }
    },
    comment: {
      header: t('Interaction Comment'),
      key: 'comment',
      render: (comm) => comm.comment
    },
    responsible_user_id: {
      header: t('Responsible User'),
      key: 'responsible_user_id',
      render: (comm) => {
        const respId = comm.responsible_user_id || comm.user_id;
        if (!respId) return <span className="text-gray-400">-</span>;
        const emp = employees.find(e => e.id === respId || e.id?.toLowerCase() === respId?.toLowerCase());
        return emp ? <span className="font-semibold text-gray-800">{emp.name}</span> : <span className="text-gray-400">-</span>;
      }
    },
    task_status: {
      header: t('Task Status'),
      key: 'task_status',
      render: (comm) => {
        const isCompleted = typeof comm.is_completed === 'boolean' 
          ? comm.is_completed 
          : comm.task_status === 'completed';

        if (comm.type !== 'task' && comm.is_completed === undefined && !comm.task_status) {
          return <span className="text-gray-400">-</span>;
        }

        if (isCompleted) {
          return (
            <span className="px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border-emerald-100">
              {t('Completed')}
            </span>
          );
        }

        return (
          <span className="px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase bg-blue-50 text-blue-800 border-blue-100">
            {t('Active')}
          </span>
        );
      }
    },
    reminder_time: {
      header: t('Reminder Time'),
      key: 'reminder_time',
      render: (comm) => {
        if (!comm.reminder_time) return <span className="text-gray-400">-</span>;
        return comm.has_time ? formatDateTime(comm.reminder_time) : formatDate(comm.reminder_time);
      }
    }
  };

  const columns: ColumnConfig<Communication>[] = [];

  // Prepend select checkboxes column
  columns.push({
    header: '',
    key: 'select',
    className: 'w-12 text-center',
    render: (comm) => {
      const isChecked = selectedComms.includes(comm.id);
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center w-full h-full bg-transparent">
          <button
            type="button"
            onClick={() => {
              if (selectedComms.includes(comm.id)) {
                setSelectedComms(selectedComms.filter(id => id !== comm.id));
              } else {
                setSelectedComms([...selectedComms, comm.id]);
              }
            }}
            className={`w-4 h-4 rounded border flex items-center justify-center p-0 shrink-0 mx-auto cursor-pointer ${
              isChecked
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            {isChecked && <Check size={11} strokeWidth={3.5} className="shrink-0 leading-none" />}
          </button>
        </div>
      );
    }
  });

  // Map configured visible columns
  managedCols.forEach((col) => {
    if (col.visible) {
      if (columnMap[col.id]) {
        columns.push(columnMap[col.id]);
      } else {
        columns.push({
          header: t(col.label),
          key: col.id,
          render: (item: any) => item[col.id] ?? '-'
        });
      }
    }
  });

  return columns;
}
