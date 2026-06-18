import React, { useState } from 'react';
import { Communication, Vendor, User } from '../../types';
import { Plus, Trash2, X, Calendar, Check, Edit3 } from 'lucide-react';
import { LANG } from '../../utils/lang';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import { StandardTable, ColumnConfig } from '../StandardTable';
import ColumnsManagerModal, { ManagedColumn } from '../ColumnsManagerModal';

const defaultCommunicationsColumns: ManagedColumn[] = [
  { id: 'date_time', label: 'Date & Time', visible: true },
  { id: 'type', label: 'Type', visible: true },
  { id: 'vendor_name', label: 'Supplier / Subject', visible: true },
  { id: 'user_name', label: 'Operator / User', visible: true },
  { id: 'comment', label: 'Interaction Comment', visible: true },
  { id: 'reminder_time', label: 'Reminder Time', visible: true }
];

// Integrated Premium iOS-Style Wheel/Grid DateTime Selector
function IosDateTimePicker({ 
  value, 
  onChange, 
  label 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse current value
  const dateObj = value ? new Date(value) : new Date();
  
  // States of picker
  const [year, setYear] = useState(isNaN(dateObj.getTime()) ? new Date().getFullYear() : dateObj.getFullYear());
  const [month, setMonth] = useState(isNaN(dateObj.getTime()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1); // 1-12
  const [day, setDay] = useState(isNaN(dateObj.getTime()) ? new Date().getDate() : dateObj.getDate());
  const [hour, setHour] = useState(isNaN(dateObj.getTime()) ? 12 : dateObj.getHours());
  const [minute, setMinute] = useState(isNaN(dateObj.getTime()) ? 0 : dateObj.getMinutes());

  // Re-sync on value change
  React.useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setYear(d.getFullYear());
        setMonth(d.getMonth() + 1);
        setDay(d.getDate());
        setHour(d.getHours());
        setMinute(d.getMinutes());
      }
    }
  }, [value, isOpen]);

  // Formatter for english display month name
  const monthsEN = [
    LANG.months.jan || 'Jan', LANG.months.feb || 'Feb', LANG.months.mar || 'Mar', LANG.months.apr || 'Apr', 
    LANG.months.may || 'May', LANG.months.jun || 'Jun', LANG.months.jul || 'Jul', LANG.months.aug || 'Aug', 
    LANG.months.sep || 'Sep', LANG.months.oct || 'Oct', LANG.months.nov || 'Nov', LANG.months.dec || 'Dec'
  ];

  const formattedDisplay = `${day} ${monthsEN[month - 1] || monthsEN[0]} ${year}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const handleApply = () => {
    const yStr = String(year);
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const hStr = String(hour).padStart(2, '0');
    const minStr = String(minute).padStart(2, '0');
    
    onChange(`${yStr}-${mStr}-${dStr}T${hStr}:${minStr}`);
    setIsOpen(false);
  };

  const years = [2025, 2026, 2027, 2028];
  const daysInMonth = new Date(year, month, 0).getDate() || 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="space-y-1 select-none">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{label}</label>
      
      {/* Trigger Button with styled calendar icon */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-55 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 transition shadow-inner text-left cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Calendar size={14} className="text-emerald-755" />
          {formattedDisplay}
        </span>
        <span className="text-[10px] text-emerald-800 font-bold bg-emerald-55 px-2.5 py-0.5 rounded-full hover:bg-emerald-100 transition">Select</span>
      </button>

      {/* iOS styled Bottom-Sheet dropdown */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-55 p-4 transition-opacity">
          <div className="absolute inset-x-0 inset-y-0" onClick={() => setIsOpen(false)}></div>

          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative z-10 border border-gray-200 text-gray-800 transform scale-100 transition-all text-left">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-650 p-1 rounded"
              >
                <X size={15} />
              </button>
            </div>

            {/* Wheels Container */}
            <div className="grid grid-cols-5 gap-1 bg-gray-50 p-3 rounded-2xl border border-gray-100">
              {/* Day */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase mb-1">Day</span>
                <select
                  value={day}
                  onChange={(e) => setDay(parseInt(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs py-1.5 font-bold text-center focus:outline-none"
                >
                  {days.map(d => <option key={d} value={d}>{String(d).padStart(2, '0')}</option>)}
                </select>
              </div>

              {/* Month */}
              <div className="flex flex-col items-center col-span-2">
                <span className="text-[9px] text-gray-400 font-bold uppercase mb-1">Month</span>
                <select
                  value={month}
                  onChange={(e) => {
                    const m = parseInt(e.target.value);
                    setMonth(m);
                    const maxDays = new Date(year, m, 0).getDate() || 31;
                    if (day > maxDays) setDay(maxDays);
                  }}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs py-1.5 font-bold text-center focus:outline-none"
                >
                  {monthsEN.map((mName, idx) => (
                    <option key={idx} value={idx + 1}>{mName}</option>
                  ))}
                </select>
              </div>

              {/* Hour */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase mb-1">Hour</span>
                <select
                  value={hour}
                  onChange={(e) => setHour(parseInt(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs py-1.5 font-bold text-center focus:outline-none"
                >
                  {hours.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                </select>
              </div>

              {/* Minute */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] text-gray-400 font-bold uppercase mb-1">Min</span>
                <select
                  value={minute}
                  onChange={(e) => setMinute(parseInt(e.target.value))}
                  className="w-full bg-white border border-gray-200 rounded-lg text-xs py-1.5 font-bold text-center focus:outline-none"
                >
                  {minutes.map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                </select>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="flex-1 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Confirm
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

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
      alert('Please enter a comment');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === editingComm.vendor_id);
    const employeeObj = employees.find(e => e.id === editingComm.user_id);
    const defaultContactId = supplierObj?.contacts?.[0]?.id || '';
    const defaultContactName = supplierObj?.contacts?.[0]?.name || '';

    const final: Communication = {
      ...editingComm,
      vendor_name: supplierObj?.trade_name || '',
      user_name: employeeObj?.name || currentEmployee.name,
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
      header: 'Date & Time',
      key: 'date_time',
      render: (comm) => new Date(comm.date_time).toLocaleString('en-US')
    },
    type: {
      header: 'Type',
      key: 'type',
      render: (comm) => comm.type === 'action' ? 'Action' : 'Reminder'
    },
    vendor_name: {
      header: 'Supplier / Subject',
      key: 'vendor_name',
      render: (comm) => {
        const suppObj = suppliers.find(s => s.id === comm.vendor_id);
        return suppObj ? suppObj.trade_name : (comm.vendor_name || 'Supplier');
      }
    },
    user_name: {
      header: 'Operator / User',
      key: 'user_name',
      render: (comm) => {
        const empObj = employees.find(e => e.id === comm.user_id);
        return empObj ? empObj.name : (comm.user_name || 'Manager');
      }
    },
    comment: {
      header: 'Interaction Comment',
      key: 'comment',
      render: (comm) => comm.comment
    },
    reminder_time: {
      header: 'Reminder Time',
      key: 'reminder_time',
      render: (comm) => comm.reminder_time ? new Date(comm.reminder_time).toLocaleString('en-US') : '-'
    }
  };

  const columns: ColumnConfig<Communication>[] = [];

  // Prepend select checkboxes column
  columns.push({
    header: 'Sel',
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
          header: col.label,
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
          <option value="" disabled hidden>Actions</option>
          <option value="delete" disabled={selectedComms.length === 0}>
            Delete {selectedComms.length > 0 ? `(${selectedComms.length})` : ''}
          </option>
          <option value="col_manager">Columns Manager</option>
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
        New Communication
      </button>
    </>
  );

  return (
    <div className="space-y-6 text-left" id="communications-view-panel">
      
      {/* Header */}
      <PageHeader 
        title="Communications" 
        actions={headerActions}
      />

      {/* Filters Container */}
      <div className="flex flex-col md:flex-row items-center gap-4 w-full">
        {/* Start Date */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            Start Date
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="block w-full py-2 pl-3 pr-3 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans h-[38px]"
          />
        </div>

        {/* End Date */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            End Date
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="block w-full py-2 pl-3 pr-3 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans h-[38px]"
          />
        </div>

        {/* Type Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            Type
          </span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="block w-full py-2 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans h-[38px]"
          >
            <option value="">All Types</option>
            <option value="action">Action</option>
            <option value="reminder">Reminder</option>
          </select>
        </div>

        {/* User Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            User
          </span>
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="block w-full py-2 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans h-[38px]"
          >
            <option value="">All Users</option>
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
            searchPlaceholder="Search communications logs..."
          />
        </div>
      </div>

      {/* Table of logs */}
      <StandardTable
        data={filtered}
        columns={columns}
        onRowClick={startEdit}
        emptyMessage="No communication records found."
      />

      {/* FORM DIALOG */}
      {editingComm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-gray-200 text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-extrabold text-sm text-gray-800">New Communication Record</h3>
              <button onClick={() => setEditingComm(null)} className="text-gray-400 hover:text-gray-650 cursor-pointer">
                <X size={17} />
              </button>
            </div>

            <div className="space-y-3.5">
              
              <IosDateTimePicker
                label="Date & Time *"
                value={editingComm.date_time}
                onChange={(val) => setEditingComm({...editingComm, date_time: val})}
              />

              <div>
                <label className="text-[10px] font-semibold text-gray-455 block mb-1">Interaction Type</label>
                <select
                  value={editingComm.type}
                  onChange={(e) => setEditingComm({...editingComm, type: e.target.value as any})}
                  className="w-full px-3 py-1.5 bg-gray-55 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="action">Action</option>
                  <option value="reminder">Reminder</option>
                </select>
              </div>

              {editingComm.type === 'reminder' && (
                <IosDateTimePicker
                  label="Reminder Due Time"
                  value={editingComm.reminder_time || new Date().toISOString().substring(0, 16)}
                  onChange={(val) => setEditingComm({...editingComm, reminder_time: val})}
                />
              )}

              {/* Dynamic Autocomplete Search Selector for Supplier */}
              <div className="relative">
                <label className="text-[10px] font-semibold text-gray-455 block mb-1">Supplier Object *</label>
                <input
                  type="text"
                  placeholder="Type to search supplier..."
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setShowVendorSuggestions(true);
                    if (e.target.value === '') {
                      setEditingComm(prev => prev ? { ...prev, vendor_id: '' } : null);
                    }
                  }}
                  onFocus={() => setShowVendorSuggestions(true)}
                  className="w-full px-3.5 py-2 bg-gray-55 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-600 font-sans"
                />
                {showVendorSuggestions && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowVendorSuggestions(false)} 
                    />
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
                      {suppliers.filter(s => {
                        const searchStr = vendorSearch.toLowerCase();
                        return s.trade_name.toLowerCase().includes(searchStr) || 
                               s.company_name.toLowerCase().includes(searchStr) || 
                               s.id_code.toLowerCase().includes(searchStr);
                      }).length === 0 && (
                        <div className="px-3.5 py-3 text-xs text-gray-400 italic">No suppliers found matching "{vendorSearch}"</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-455 block mb-1">Comment *</label>
                <textarea 
                  rows={4}
                  placeholder="e.g. Phone call completed, promised dispatch on Monday..."
                  value={editingComm.comment}
                  onChange={(e) => setEditingComm({...editingComm, comment: e.target.value})}
                  className="w-full p-2.5 bg-gray-55 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-600"
                ></textarea>
              </div>

            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-between font-sans">
              <div>
                {!isNew && (
                  <button
                    type="button"
                    onClick={() => {
                      if (editingComm) {
                        setDeleteConfirmId(editingComm.id);
                        setEditingComm(null);
                      }
                    }}
                    className="px-3.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold cursor-pointer transition shadow-2xs"
                  >
                    Delete Log
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <button 
                  type="button"
                  onClick={() => setEditingComm(null)}
                  className="px-4 py-1.5 bg-gray-100 text-gray-750 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSaveAll}
                  className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                >
                  Save
                </button>
              </div>
            </div>

          </div>
        </div>
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
        title="Delete Log Entry"
        message="Are you sure you want to delete this communication log entry? This operation is permanent."
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border shadow-lg p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto animate-pulse">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">Confirm Bulk Logs Deleted</h4>
              <p className="text-[11.5px] text-gray-455 mt-2 font-sans leading-normal">
                Are you sure you want to permanently delete <strong>{selectedComms.length} selected communication entries</strong>? This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 font-sans pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 border hover:bg-slate-50 text-xs font-bold text-gray-600 rounded-xl cursor-pointer"
              >
                No, Keep Them
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteExecute}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-black text-white rounded-xl cursor-pointer"
              >
                Yes, Delete
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
