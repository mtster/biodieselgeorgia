import React, { useState } from 'react';
import { Communication, Vendor, User } from '../../types';
import { Plus, Trash2, X, Check, Edit3 } from 'lucide-react';
import { LANG, t } from '../../utils/lang';
import PeriodFilter from '../PeriodFilter';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import { StandardTable, ColumnConfig } from '../StandardTable';
import ColumnsManagerModal, { ManagedColumn } from '../ColumnsManagerModal';
import FormModal from '../FormModal';
import { FormInput, FormSelect } from '../FormInput';

const defaultCommunicationsColumns: ManagedColumn[] = [
  { id: 'date_time', label: 'Date & Time', visible: true },
  { id: 'type', label: 'Type', visible: true },
  { id: 'vendor_name', label: 'Supplier / Subject', visible: true },
  { id: 'user_name', label: 'Operator / User', visible: true },
  { id: 'comment', label: 'Interaction Comment', visible: true },
  { id: 'responsible_user_id', label: 'Responsible User', visible: true },
  { id: 'task_status', label: 'Task Status', visible: true },
  { id: 'reminder_time', label: 'Reminder Time', visible: true }
];


interface Props {
  communications: Communication[];
  suppliers: Vendor[];
  employees: User[];
  currentEmployee: User;
  onSave: (comm: Communication) => void;
  onDelete: (id: string) => void;
}

export default function CommunicationsView({ 
  communications, suppliers, employees, currentEmployee, onSave, onDelete 
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Selection and Bulk Actions State
  const [selectedComms, setSelectedComms] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // State
  const [editingComm, setEditingComm] = useState<Communication | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filters State
  const [typeFilter, setTypeFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [taskResponsibleFilter, setTaskResponsibleFilter] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');

  // Auto-complete suppliers state in communications form modal
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

  // Columns Manager State
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [managedCols, setManagedCols] = useState<ManagedColumn[]>(() => {
    const loaded = localStorage.getItem('communications_columns_managed');
    return loaded ? JSON.parse(loaded) : defaultCommunicationsColumns;
  });

  const handleSaveColumns = (updated: ManagedColumn[]) => {
    setManagedCols(updated);
    localStorage.setItem('communications_columns_managed', JSON.stringify(updated));
  };

  const startNew = () => {
    const defaultComm: Communication = {
      id: '',
      date_time: new Date().toISOString().substring(0, 16),
      type: 'action',
      reminder_time: undefined,
      user_id: currentEmployee.id,
      vendor_id: suppliers[0]?.id || '',
      vendor_contact_id: '',
      comment: ''
    };
    setEditingComm(defaultComm);
    setIsNew(true);
    const suppObj = suppliers.find(s => s.id === defaultComm.vendor_id);
    setVendorSearch(suppObj ? suppObj.trade_name : '');
  };

  const startEdit = (comm: Communication) => {
    setEditingComm({ ...comm });
    setIsNew(false);
    const suppObj = suppliers.find(s => s.id === comm.vendor_id);
    setVendorSearch(suppObj ? suppObj.trade_name : '');
  };

  const handleBulkDeleteExecute = () => {
    selectedComms.forEach(id => {
      onDelete(id);
    });
    setSelectedComms([]);
    setShowBulkDeleteConfirm(false);
  };

  const handleSaveAll = () => {
    if (!editingComm) return;
    if (!editingComm.comment.trim()) {
      alert(t('Please enter a comment'));
      return;
    }

    const supplierObj = suppliers.find(s => s.id === editingComm.vendor_id);
    const employeeObj = employees.find(e => e.id === editingComm.user_id);
    const responsibleObj = employees.find(e => e.id === editingComm.responsible_user_id);
    const defaultContactId = supplierObj?.contacts?.[0]?.id || '';
    const defaultContactName = supplierObj?.contacts?.[0]?.name || '';

    const final: Communication = {
      ...editingComm,
      vendor_name: supplierObj?.trade_name || '',
      user_name: employeeObj?.name || currentEmployee.name,
      responsible_user_name: responsibleObj?.name || '',
      vendor_contact_id: editingComm.vendor_contact_id || defaultContactId,
      vendor_contact_name: defaultContactName
    };

    onSave(final);
    setEditingComm(null);
  };

  const uniqueSuppliers = Array.from(
    new Map(
      communications
        .map(c => {
          const supp = suppliers.find(s => s.id === c.vendor_id);
          if (!supp) return null;
          return [supp.id, { id: supp.id, trade_name: supp.trade_name }];
        })
        .filter((item): item is [string, { id: string; trade_name: string }] => item !== null)
    ).values()
  );

  const uniqueUsers = Array.from(
    new Map(
      employees
        .filter(emp => emp && !emp.is_deleted && emp.name)
        .map(emp => [emp.id, { id: emp.id, name: emp.name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = communications.filter(comm => {
    const suppObj = suppliers.find(s => s.id === comm.vendor_id);
    const sName = suppObj ? suppObj.trade_name : (comm.vendor_name || '');
    const matchesSearch = sName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          comm.comment.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (typeFilter && comm.type !== typeFilter) return false;

    if (typeFilter === 'task') {
      if (taskResponsibleFilter && comm.responsible_user_id !== taskResponsibleFilter) return false;
      if (taskStatusFilter && comm.task_status !== taskStatusFilter) return false;
    }
    
    if (supplierFilter) {
      const matchDb = comm.vendor_id === supplierFilter;
      const matchResolved = suppObj && suppObj.id === supplierFilter;
      if (!matchDb && !matchResolved) return false;
    }

    if (userFilter) {
      const matchDb = comm.user_id === userFilter;
      const empObj = employees.find(e => e.id === comm.user_id);
      const matchResolved = empObj && empObj.id === userFilter;
      if (!matchDb && !matchResolved) return false;
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const commDate = new Date(comm.date_time);
      if (commDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const commDate = new Date(comm.date_time);
      if (commDate > end) return false;
    }

    return true;
  });

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

  const headerActions = (
    <>
      <div className="relative">
        <select
          value=""
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'delete' && selectedComms.length > 0) {
              setShowBulkDeleteConfirm(true);
            } else if (val === 'col_manager') {
              setIsColModalOpen(true);
            }
            e.target.value = ''; // Reset select trigger
          }}
          className="px-3.5 py-2.5 pr-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-gray-200 cursor-pointer select-none focus:outline-none appearance-none font-sans"
        >
          <option value="" disabled hidden>{t("Actions")}</option>
          <option value="delete" disabled={selectedComms.length === 0}>
            {t("Delete")} {selectedComms.length > 0 ? `(${selectedComms.length})` : ''}
          </option>
          <option value="col_manager">{t("Columns Manager")}</option>
        </select>
        <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
          ▼
        </span>
      </div>

      <button 
        id="btn-add-comm"
        onClick={startNew}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition cursor-pointer select-none"
      >
        <Plus size={15} />
        {t("New Communication")}
      </button>
    </>
  );

  return (
    <div className="space-y-6 text-left" id="communications-view-panel">
      
      {/* Header */}
      <PageHeader 
        title={t("Communications")} 
        actions={headerActions}
      />

      {/* Filters Container */}
      <div className="flex flex-col md:flex-row items-center gap-4 w-full">
        <PeriodFilter 
          startDate={startDate} 
          setStartDate={setStartDate} 
          endDate={endDate} 
          setEndDate={setEndDate} 
        />

        {/* Type Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("Type")}
          </span>
          <select
            value={typeFilter}
            onChange={(e) => {
              const val = e.target.value;
              setTypeFilter(val);
              if (val !== 'task') {
                setTaskResponsibleFilter('');
                setTaskStatusFilter('');
              }
            }}
            className="block w-full py-2 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans h-[38px]"
          >
            <option value="">{t("All Types")}</option>
            <option value="action">{t("Action")}</option>
            <option value="reminder">{t("Reminder")}</option>
            <option value="task">{t("Task")}</option>
          </select>
        </div>

        {/* Task-specific Filters */}
        {typeFilter === 'task' && (
          <>
            {/* Responsible User Filter */}
            <div className="relative w-full md:w-auto min-w-[140px]">
              <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-[#3182ce] bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                {t("Responsible")}
              </span>
              <select
                value={taskResponsibleFilter}
                onChange={(e) => setTaskResponsibleFilter(e.target.value)}
                className="block w-full py-2 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-blue-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans h-[38px]"
              >
                <option value="">{t("All Responsible")}</option>
                {uniqueUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Task Status Filter */}
            <div className="relative w-full md:w-auto min-w-[145px]">
              <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-[#3182ce] bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                {t("Task Status")}
              </span>
              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="block w-full py-2 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-blue-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans h-[38px]"
              >
                <option value="">{t("All Statuses")}</option>
                <option value="pending">{t("Pending")}</option>
                <option value="in_progress">{t("In Progress")}</option>
                <option value="completed">{t("Completed")}</option>
              </select>
            </div>
          </>
        )}

        {/* User Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("User")}
          </span>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="block w-full py-2 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans h-[38px]"
          >
            <option value="">{t("All Users")}</option>
            {uniqueUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Text Search */}
        <div className="flex-1 w-full">
          <CentralSearchBar 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            idPrefix="input-comm-search"
            searchPlaceholder={t("Search communications logs...")}
          />
        </div>
      </div>

      {/* Table of logs */}
      <StandardTable
        data={filtered}
        columns={columns}
        onRowClick={startEdit}
        emptyMessage={t("No communication records found.")}
      />

      {/* FORM DIALOG */}
      {editingComm && (
        <FormModal
          isOpen={!!editingComm}
          onClose={() => setEditingComm(null)}
          title={isNew ? t('New Communication') : t('Edit Communication')}
          maxWidthClass="max-w-md"
          onCancel={() => setEditingComm(null)}
          onSave={handleSaveAll}
          saveLabel={isNew ? t('Add Communication') : t('Save Communication')}
          onDelete={!isNew ? () => {
            if (editingComm) {
              setDeleteConfirmId(editingComm.id);
              setEditingComm(null);
            }
          } : undefined}
          deleteLabel={t("Delete")}
        >
          <div className="space-y-4">
            <FormInput
              label={t("Date & Time *")}
              type="datetime-local"
              value={editingComm.date_time}
              onChange={(e) => setEditingComm({...editingComm, date_time: e.target.value})}
            />

            <FormSelect
              label={t("Interaction Type")}
              value={editingComm.type}
              onChange={(e) => {
                const nextType = e.target.value as any;
                setEditingComm({
                  ...editingComm,
                  type: nextType,
                  task_status: nextType === 'task' ? (editingComm.task_status || 'pending') : undefined,
                  responsible_user_id: nextType === 'task' ? (editingComm.responsible_user_id || employees[0]?.id || '') : undefined
                });
              }}
            >
              <option value="action">{t("Action")}</option>
              <option value="reminder">{t("Reminder")}</option>
              <option value="task">{t("Task")}</option>
            </FormSelect>

            <FormSelect
              label={t("User Rep *")}
              value={editingComm.user_id}
              onChange={(e) => setEditingComm({...editingComm, user_id: e.target.value})}
            >
              {employees.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </FormSelect>

            {editingComm.type === 'task' && (
              <div className="grid grid-cols-2 gap-3">
                <FormSelect
                  label={t("Responsible User *")}
                  value={editingComm.responsible_user_id || ''}
                  onChange={(e) => setEditingComm({...editingComm, responsible_user_id: e.target.value})}
                >
                  <option value="">{t("Select Employee")}</option>
                  {employees.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </FormSelect>

                <FormSelect
                  label={t("Task Status *")}
                  value={editingComm.task_status || 'pending'}
                  onChange={(e) => setEditingComm({...editingComm, task_status: e.target.value as any})}
                >
                  <option value="pending">{t("Pending")}</option>
                  <option value="in_progress">{t("In Progress")}</option>
                  <option value="completed">{t("Completed")}</option>
                </FormSelect>
              </div>
            )}

            {editingComm.type === 'reminder' && (
              <FormInput
                label={t("Reminder Due Time")}
                type="datetime-local"
                value={editingComm.reminder_time || ''}
                onChange={(e) => setEditingComm({...editingComm, reminder_time: e.target.value})}
              />
            )}

            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left text-gray-400">{t("Supplier *")}</span>
              <input
                type="text"
                placeholder={t("Type to search supplier...")}
                value={vendorSearch}
                onChange={(e) => {
                  setVendorSearch(e.target.value);
                  setShowVendorSuggestions(true);
                  if (e.target.value === '') {
                    setEditingComm(prev => prev ? { ...prev, vendor_id: '' } : null);
                  }
                }}
                onFocus={() => setShowVendorSuggestions(true)}
                className="block w-full px-3.5 py-4 md:py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900 font-sans"
              />
              {showVendorSuggestions && (
                <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50 divide-y divide-gray-50">
                  {suppliers
                    .filter(s => {
                      const searchStr = vendorSearch.toLowerCase();
                      return s.trade_name.toLowerCase().includes(searchStr) || 
                             s.company_name.toLowerCase().includes(searchStr) || 
                             s.id_code.toLowerCase().includes(searchStr);
                    })
                    .map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setEditingComm(prev => prev ? { ...prev, vendor_id: s.id } : null);
                          setVendorSearch(s.trade_name);
                           setShowVendorSuggestions(false);
                        }}
                        className="px-3.5 py-2 hover:bg-slate-50 cursor-pointer text-left transition duration-100"
                      >
                        <p className="text-xs font-bold text-gray-800">{s.trade_name}</p>
                        <p className="text-[9px] text-gray-400 font-mono mt-0.5">{s.company_name}</p>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left text-gray-400">{t("Comment *")}</span>
              <textarea 
                rows={4}
                placeholder={t("e.g. Phone call completed, promised dispatch on Monday...")}
                value={editingComm.comment}
                onChange={(e) => setEditingComm({...editingComm, comment: e.target.value})}
                className="block w-full px-3.5 py-4 md:py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900 font-sans"
              />
            </div>
          </div>
        </FormModal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal 
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) {
            onDelete(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        title={t("Delete Log Entry")}
        message={t("Are you sure you want to delete this communication log entry? This operation is permanent.")}
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border shadow-lg p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest leading-none">{t("Confirm Bulk Logs Deleted")}</h4>
              <p className="text-[11.5px] text-gray-455 mt-2 font-sans leading-normal">
                {t("Are you sure you want to permanently delete")} <strong>{selectedComms.length} {t("selected communication entries")}</strong>? {t("This cannot be undone.")}
              </p>
            </div>
            <div className="flex gap-2 font-sans pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 border hover:bg-slate-50 text-xs font-bold text-gray-600 rounded-xl cursor-pointer"
              >
                {t("No, Keep Them")}
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteExecute}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-bold text-white rounded-xl cursor-pointer"
              >
                {t("Yes, Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ColumnsManagerModal
        isOpen={isColModalOpen}
        onClose={() => setIsColModalOpen(false)}
        columns={managedCols}
        onSave={handleSaveColumns}
        storageKey="communications_columns_managed"
        defaultColumns={defaultCommunicationsColumns}
      />

    </div>
  );
}
