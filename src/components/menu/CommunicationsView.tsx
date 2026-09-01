import React, { useState } from 'react';
import { Communication, Vendor, User } from '../../types';
import { Plus, Trash2 } from 'lucide-react';
import { t } from '../../utils/lang';
import PeriodFilter from '../PeriodFilter';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import { StandardTable } from '../StandardTable';
import ColumnsManagerModal, { ManagedColumn } from '../ColumnsManagerModal';
import CommunicationFormModal from './CommunicationFormModal';
import { getCommunicationsColumns } from '../communications/communicationsColumns';
import { usePaginatedCommunications } from '../../hooks/usePaginatedModuleQuery';
import { useDebounce, useDebouncedSearch } from '../../hooks/useDebounce';

const defaultCommunicationsColumns: ManagedColumn[] = [
  { id: 'date_time', label: 'Date & Time', visible: true },
  { id: 'type', label: 'Type', visible: true },
  { id: 'vendor_name', label: 'Supplier', visible: true },
  { id: 'company_name', label: 'Company Name', visible: true },
  { id: 'id_code', label: 'Identification Code', visible: true },
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
  onNavigateToOrdersWithVendor?: (vendorId: string) => void;
}

export default function CommunicationsView({ 
  communications, suppliers, employees, currentEmployee, onSave, onDelete, onNavigateToOrdersWithVendor 
}: Props) {

  const canAdd = currentEmployee?.role === 'admin' || currentEmployee?.permissions?.['communications']?.includes('add');
  const canModify = currentEmployee?.role === 'admin' || currentEmployee?.permissions?.['communications']?.includes('modify');
  const canDelete = currentEmployee?.role === 'admin' || currentEmployee?.permissions?.['communications']?.includes('delete');

  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    triggerImmediateSearch
  } = useDebouncedSearch('', 350);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(endOfMonth.getDate())}`;
  });
  
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
  const [page, setPage] = useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, typeFilter, supplierFilter, userFilter, taskResponsibleFilter, taskStatusFilter, startDate, endDate]);

  const commFilters = {
    searchTerm: debouncedSearchTerm,
    type: typeFilter,
    vendorId: supplierFilter,
    userId: userFilter,
    taskResponsible: taskResponsibleFilter,
    taskStatus: taskStatusFilter,
    startDate,
    endDate
  };

  const { data: paginatedData, isLoading: isCommsLoading } = usePaginatedCommunications(page, commFilters, currentEmployee);

  const displayComms = paginatedData?.communications || [];
  const totalCommsCount = paginatedData?.totalCount || 0;

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
      user_id: currentEmployee?.id || employees[0]?.id || '',
      responsible_user_id: currentEmployee?.id || employees[0]?.id || '',
      vendor_id: '',
      vendor_contact_id: '',
      comment: '',
      is_completed: false,
      task_status: 'pending'
    };
    setEditingComm(defaultComm);
    setIsNew(true);
  };

  const startEdit = (comm: Communication) => {
    setEditingComm({ ...comm });
    setIsNew(false);
  };

  const handleBulkDeleteExecute = () => {
    selectedComms.forEach(id => {
      onDelete(id);
    });
    setSelectedComms([]);
    setShowBulkDeleteConfirm(false);
  };

  const handleSaveAll = (payload: Communication) => {
    if (!payload.comment.trim()) {
      alert(t('Please enter a comment'));
      return;
    }

    const supplierObj = suppliers.find(s => s.id === payload.vendor_id);
    const employeeObj = employees.find(e => e.id === payload.user_id);
    const responsibleObj = employees.find(e => e.id === payload.responsible_user_id);
    const defaultContactId = supplierObj?.contacts?.[0]?.id || '';
    const defaultContactName = supplierObj?.contacts?.[0]?.name || '';

    const final: Communication = {
      ...payload,
      vendor_name: supplierObj?.trade_name || '',
      user_name: employeeObj?.name || currentEmployee.name,
      responsible_user_name: responsibleObj?.name || '',
      vendor_contact_id: payload.vendor_contact_id || defaultContactId,
      vendor_contact_name: defaultContactName
    };

    onSave(final);
    setEditingComm(null);
  };

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

  const columns = getCommunicationsColumns({
    suppliers,
    employees,
    currentEmployee,
    selectedComms,
    setSelectedComms
  }, managedCols);

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
          className="px-3.5 py-2.5 pr-8 bg-slate-100/60 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-gray-200 cursor-pointer select-none focus:outline-none appearance-none font-sans"
        >
          <option value="" disabled hidden>{t("Actions")}</option>
          <option value="delete" disabled={!canDelete || selectedComms.length === 0}>
            {t("Delete")} {selectedComms.length > 0 ? `(${selectedComms.length})` : ''}
          </option>
          <option value="col_manager">{t("Columns Manager")}</option>
        </select>
        <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
          ▼
        </span>
      </div>

      {canAdd && (
        <button 
          id="btn-add-comm"
          onClick={startNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition cursor-pointer select-none"
        >
          <Plus size={15} />
          {t("New Communication")}
        </button>
      )}
    </>
  );

  const rowClassName = (comm: Communication) => {
    const isChecked = selectedComms.includes(comm.id);
    return isChecked ? 'bg-emerald-50/70 hover:bg-emerald-100/70' : 'hover:bg-slate-50';
  };

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
          <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
            ▼
          </span>
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
              <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
                ▼
              </span>
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
              <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
                ▼
              </span>
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
          <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
            ▼
          </span>
        </div>

        {/* Text Search */}
        <div className="flex-1 w-full">
          <CentralSearchBar 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSearchSubmit={triggerImmediateSearch}
            idPrefix="input-comm-search"
            searchPlaceholder={t("Search communications logs...")}
          />
        </div>
      </div>

      {/* Table of logs */}
      <StandardTable
        data={displayComms}
        columns={columns}
        onRowClick={startEdit}
        rowClassName={rowClassName}
        emptyMessage={t("No communication records found.")}
        serverTotalCount={totalCommsCount}
        page={page}
        onPageChange={setPage}
        isLoading={isCommsLoading}
      />

      <CommunicationFormModal
        isOpen={!!editingComm}
        onClose={() => setEditingComm(null)}
        editingComm={editingComm}
        isNew={isNew}
        employees={employees}
        suppliers={suppliers}
        canAddOrder={currentEmployee?.role === 'admin' || currentEmployee?.permissions?.['orders']?.includes('add')}
        onSave={handleSaveAll}
        onSaveAndOrder={(payload, vendorId) => {
          handleSaveAll(payload);
          if (onNavigateToOrdersWithVendor && vendorId) {
            onNavigateToOrdersWithVendor(vendorId);
          }
        }}
        onDelete={() => {
          if (editingComm) {
            setDeleteConfirmId(editingComm.id);
            setEditingComm(null);
          }
        }}
      />

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
