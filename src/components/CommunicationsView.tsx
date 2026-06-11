import React, { useState } from 'react';
import { Communication, Supplier, Employee } from '../types';
import { Plus, Search, HelpCircle, Calendar, MessageSquare, Trash2, X, Check } from 'lucide-react';

interface Props {
  communications: Communication[];
  suppliers: Supplier[];
  employees: Employee[];
  currentEmployee: Employee;
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
      employee_id: currentEmployee.id,
      supplier_id: suppliers[0]?.id || '',
      supplier_contact_id: '',
      comment: ''
    };
    setEditingComm(defaultComm);
    setIsNew(true);
  };

  const handleSaveAll = () => {
    if (!editingComm) return;
    if (!editingComm.comment.trim()) {
      alert('მიუთითეთ კომენტარი');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === editingComm.supplier_id);
    const employeeObj = employees.find(e => e.id === editingComm.employee_id);
    const defaultContactId = supplierObj?.contacts?.[0]?.id || '';
    const defaultContactName = supplierObj?.contacts?.[0]?.name || '';

    const final: Communication = {
      ...editingComm,
      supplier_name: supplierObj?.trade_name || '',
      employee_name: employeeObj?.name || currentEmployee.name,
      supplier_contact_id: editingComm.supplier_contact_id || defaultContactId,
      supplier_contact_name: defaultContactName
    };

    onSave(final);
    setEditingComm(null);
  };

  const filtered = communications.filter(comm => {
    const suppObj = suppliers.find(s => s.id === comm.supplier_id);
    const sName = suppObj ? suppObj.trade_name : '';
    return sName.toLowerCase().includes(searchTerm.toLowerCase()) || 
           comm.comment.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">კომუნიკაცია</h2>
          <p className="text-xs text-gray-500 mt-1">მომწოდებლებთან ურთიერთობის, კომენტარების და შეხსენებების ორგანიზება.</p>
        </div>

        <div>
          <button 
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
          >
            <Plus size={15} />
            ახალი კომუნიკაცია
          </button>
        </div>
      </div>

      {/* Filter box */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex items-center relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
          <Search size={15} />
        </span>
        <input 
          type="text"
          placeholder="მოძებნეთ კომუნიკაციის ჩანაწერებში..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200/80 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Grid of logs */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] text-gray-450 uppercase font-mono bg-gray-50">
                <th className="py-3 px-4">თარიღი და დრო</th>
                <th className="py-3 px-4">ტიპი</th>
                <th className="py-3 px-4">მომწოდებელი</th>
                <th className="py-3 px-4">თანამშრომელი</th>
                <th className="py-3 px-4">კომენტარი</th>
                <th className="py-3 px-4">შეხსენების დრო</th>
                <th className="py-3 px-4 text-right">ქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((comm) => {
                const suppObj = suppliers.find(s => s.id === comm.supplier_id);
                return (
                  <tr key={comm.id} className="hover:bg-slate-50/20">
                    <td className="py-3.5 px-4 font-mono">
                      {new Date(comm.date_time).toLocaleString('ka-GE')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        comm.type === 'action' ? 'bg-indigo-50 text-indigo-755 border border-indigo-100' : 'bg-orange-50 text-orange-755 border border-orange-100'
                      }`}>
                        {comm.type === 'action' ? 'მოქმედება' : 'შეხსენება'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-800">
                      {suppObj ? suppObj.trade_name : 'მომწოდებელი'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {comm.employee_name || 'მენეჯერი'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 font-medium">
                      {comm.comment}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-400">
                      {comm.reminder_time ? new Date(comm.reminder_time).toLocaleString('ka-GE') : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button 
                        onClick={() => onDelete(comm.id)}
                        className="text-gray-400 hover:text-red-630 p-1 bg-gray-50 rounded"
                        title="წაშლა"
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
          <div className="text-center py-12 text-xs text-gray-400">
            კომუნიკაციის ჩანაწერები არ მოიძებნა.
          </div>
        )}
      </div>

      {/* FORM DIALOG */}
      {editingComm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-gray-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-extrabold text-sm text-gray-850">კომუნიკაციის ახალი ჩანაწერი</h3>
              <button onClick={() => setEditingComm(null)} className="text-gray-400 hover:text-gray-600">
                <X size={17} />
              </button>
            </div>

            <div className="space-y-3.5">
              
              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">თარიღი და დრო *</label>
                <input 
                  type="datetime-local"
                  value={editingComm.date_time}
                  onChange={(e) => setEditingComm({...editingComm, date_time: e.target.value})}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">მოქმედების სახეობა</label>
                <select
                  value={editingComm.type}
                  onChange={(e) => setEditingComm({...editingComm, type: e.target.value as any})}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="action">მოქმედება</option>
                  <option value="reminder">შეხსენება (Reminder)</option>
                </select>
              </div>

              {editingComm.type === 'reminder' && (
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">შეხსენების საკონტროლო დრო</label>
                  <input 
                    type="datetime-local"
                    value={editingComm.reminder_time || ''}
                    onChange={(e) => setEditingComm({...editingComm, reminder_time: e.target.value})}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">მომწოდებელი ობიექტი *</label>
                <select
                  value={editingComm.supplier_id}
                  onChange={(e) => setEditingComm({...editingComm, supplier_id: e.target.value})}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.trade_name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-400 block mb-1">კომენტარი *</label>
                <textarea 
                  rows={4}
                  placeholder="განხორციელდა სატელეფონო საუბარი, შეგვპირდა ორშაბათისთვის..."
                  value={editingComm.comment}
                  onChange={(e) => setEditingComm({...editingComm, comment: e.target.value})}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                ></textarea>
              </div>

            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button 
                onClick={() => setEditingComm(null)}
                className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold"
              >
                გაუქმება
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-4 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-900 transition"
              >
                შენახვა
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
