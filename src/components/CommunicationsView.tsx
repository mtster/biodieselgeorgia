import React, { useState } from 'react';
import { Communication, Vendor, User } from '../types';
import { Plus, Search, HelpCircle, Calendar, MessageSquare, Trash2, X, Check } from 'lucide-react';
import { LANG } from '../utils/lang';

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
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 transition shadow-inner text-left cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <Calendar size={14} className="text-emerald-755" />
          {formattedDisplay}
        </span>
        <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full hover:bg-emerald-100 transition">Select</span>
      </button>

      {/* iOS styled Bottom-Sheet dropdown */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center z-55 p-4 transition-opacity">
          <div className="absolute inset-0" onClick={() => setIsOpen(false)}></div>

          <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative z-10 border border-gray-150 text-gray-800 transform scale-100 transition-all">
            
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
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-150 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
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
  
  // States
  const [editingComm, setEditingComm] = useState<Communication | null>(null);
  const [isNew, setIsNew] = useState(false);

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

  const filtered = communications.filter(comm => {
    const suppObj = suppliers.find(s => s.id === comm.vendor_id);
    const sName = suppObj ? suppObj.trade_name : '';
    return sName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           comm.comment.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6" id="communications-view-panel">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">Communications Log</h2>
          <p className="text-xs text-gray-500 mt-1 pb-1">Manage supplier interactions, comments, updates, and reminders.</p>
        </div>

        <div>
          <button 
            id="btn-add-comm"
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition cursor-pointer"
          >
            <Plus size={15} />
            New Log Entry
          </button>
        </div>
      </div>

      {/* Filter box */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex items-center relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
          <Search size={15} />
        </span>
        <input 
          id="input-comm-search"
          type="text"
          placeholder="Search communications logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Grid of logs */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase font-mono bg-gray-50">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Supplier / Subject</th>
                <th className="py-3 px-4">Operator / User</th>
                <th className="py-3 px-4">Interaction Comment</th>
                <th className="py-3 px-4">Reminder Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((comm) => {
                const suppObj = suppliers.find(s => s.id === comm.vendor_id);
                return (
                  <tr key={comm.id} className="hover:bg-slate-50/20">
                    <td className="py-3.5 px-4 font-mono">
                      {new Date(comm.date_time).toLocaleString('en-US')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        comm.type === 'action' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
                      }`}>
                        {comm.type === 'action' ? 'Action' : 'Reminder'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-800">
                      {suppObj ? suppObj.trade_name : (comm.vendor_name || 'Supplier')}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 font-sans">
                      {comm.user_name || 'Manager'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                      {comm.comment}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-400">
                      {comm.reminder_time ? new Date(comm.reminder_time).toLocaleString('en-US') : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button 
                        onClick={() => onDelete(comm.id)}
                        className="text-gray-450 hover:text-red-600 p-1.5 bg-gray-50 rounded select-none cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-xs">
            No communication records found.
          </div>
        )}
      </div>

      {/* FORM DIALOG */}
      {editingComm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-gray-150">
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
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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

              <div>
                <label className="text-[10px] font-semibold text-gray-455 block mb-1">Supplier Object *</label>
                <select
                  value={editingComm.vendor_id}
                  onChange={(e) => setEditingComm({...editingComm, vendor_id: e.target.value})}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.trade_name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-455 block mb-1">Comment *</label>
                <textarea 
                  rows={4}
                  placeholder="e.g. Phone call completed, promised dispatch on Monday..."
                  value={editingComm.comment}
                  onChange={(e) => setEditingComm({...editingComm, comment: e.target.value})}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                ></textarea>
              </div>

            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2.5 font-sans">
              <button 
                onClick={() => setEditingComm(null)}
                className="px-4 py-1.5 bg-gray-100 text-gray-750 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
              >
                Save
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
