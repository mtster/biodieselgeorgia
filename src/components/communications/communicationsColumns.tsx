import React from 'react';
import { Check } from 'lucide-react';
import { Communication, Vendor, User } from '../../types';
import { ColumnConfig } from '../StandardTable';
import { t } from '../../utils/lang';

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

  const columnMap: Record<string, ColumnConfig<Communication>> = {
    date_time: {
      header: t('Date & Time'),
      key: 'date_time',
      render: (comm) => new Date(comm.date_time).toLocaleString('en-US')
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
      header: t('Supplier / Subject'),
      key: 'vendor_name',
      render: (comm) => {
        const suppObj = suppliers.find(s => s.id === comm.vendor_id);
        return suppObj ? suppObj.trade_name : (comm.vendor_name || t('Supplier'));
      }
    },
    company_name: {
      header: t('Company Name'),
      key: 'company_name',
      render: (comm) => {
        const suppObj = suppliers.find(s => s.id === comm.vendor_id);
        return suppObj ? suppObj.company_name : '-';
      }
    },
    id_code: {
      header: t('Identification Code'),
      key: 'id_code',
      render: (comm) => {
        const suppObj = suppliers.find(s => s.id === comm.vendor_id);
        return suppObj ? suppObj.id_code : '-';
      }
    },
    user_name: {
      header: t('Operator / User'),
      key: 'user_name',
      render: (comm) => {
        const empObj = employees.find(e => e.id === comm.user_id);
        return empObj ? empObj.name : (comm.user_name || t('Manager'));
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
        if (comm.type !== 'task' || !comm.responsible_user_id) return <span className="text-gray-400">-</span>;
        const emp = employees.find(e => e.id === comm.responsible_user_id);
        return emp ? <span className="font-medium text-blue-600">{emp.name}</span> : <span className="text-gray-400">-</span>;
      }
    },
    task_status: {
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
          pending: 'bg-rose-50 text-rose-850 border-rose-100',
          in_progress: 'bg-indigo-50 text-indigo-850 border-indigo-100',
          completed: 'bg-emerald-50 text-emerald-850 border-emerald-100'
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase ${styleMap[comm.task_status] || 'bg-slate-50 text-slate-700'}`}>
            {labelMap[comm.task_status] || comm.task_status}
          </span>
        );
      }
    },
    reminder_time: {
      header: t('Reminder Time'),
      key: 'reminder_time',
      render: (comm) => comm.reminder_time ? new Date(comm.reminder_time).toLocaleString('en-US') : '-'
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
        <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (selectedComms.includes(comm.id)) {
                setSelectedComms(selectedComms.filter(id => id !== comm.id));
              } else {
                setSelectedComms([...selectedComms, comm.id]);
              }
            }}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto cursor-pointer ${
              isChecked
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {isChecked && <Check size={11} strokeWidth={3.5} />}
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
