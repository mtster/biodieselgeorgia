import React, { useState } from 'react';
import { Employee, EmployeeRole } from '../types';
import { Plus, Search, Trash2, Edit2, ShieldAlert, Key, ToggleLeft, UserCheck, X, Check } from 'lucide-react';

interface Props {
  employees: Employee[];
  currentEmployee: Employee;
  onSave: (emp: Employee) => void;
  onDelete: (id: string, name: string) => void;
}

export default function EmployeesView({ employees, currentEmployee, onSave, onDelete }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // States
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Privileges preselected choices helper
  const availablePrivileges = ['ყველაფერი', 'ზეთის_მართვა', 'შეკვეთები', 'ფინანსური_ნახვა', 'მხოლოდ_ჩემი_დავალებები', 'ლოგისტიკა'];

  const startNew = () => {
    const defaultEmp: Employee = {
      id: '',
      name: '',
      personal_id: '',
      email: '',
      password: '',
      phone: '',
      role: 'driver',
      privileges: ['მხოლოდ_ჩემი_დავალებები'],
      created_at: new Date().toISOString()
    };
    setEditingEmp(defaultEmp);
    setIsNew(true);
  };

  const startEdit = (emp: Employee) => {
    setEditingEmp(JSON.parse(JSON.stringify(emp)));
    setIsNew(false);
  };

  const togglePrivilege = (priv: string) => {
    if (!editingEmp) return;
    const isChecked = editingEmp.privileges.includes(priv);
    let updated: string[];
    if (isChecked) {
      updated = editingEmp.privileges.filter(p => p !== priv);
    } else {
      updated = [...editingEmp.privileges, priv];
    }
    setEditingEmp({
      ...editingEmp,
      privileges: updated
    });
  };

  const handleSaveAll = () => {
    if (!editingEmp) return;
    if (!editingEmp.name.trim() || !editingEmp.personal_id || !editingEmp.email) {
      alert('გთხოვთ შეავსოთ რეალური სახელი, პირადი ნომერი და ელ-ფოსტა');
      return;
    }
    onSave(editingEmp);
    setEditingEmp(null);
  };

  const filtered = employees.filter(emp => {
    return emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           emp.personal_id.includes(searchTerm);
  });

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">თანამშრომლები</h2>
          <p className="text-xs text-gray-500 mt-1">ბიოდიზელი ჯორჯიას პერსონალი, მძღოლები, მენეჯერები და მათი როლების პრივილეგიები.</p>
        </div>

        <div>
          <button 
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
          >
            <Plus size={15} />
            ახალი თანამშრომელი
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
          placeholder="ძიება სახელით, პირადი ნომრით ან ელ-ფოსტით..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200/80 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((emp) => (
          <div 
            key={emp.id}
            className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-200 transition"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-800">{emp.name}</h3>
                  <span className={`text-[9px] font-bold tracking-widest uppercase font-mono px-2 py-0.5 rounded ${
                    emp.role === 'admin' ? 'bg-red-50 text-red-700' :
                    emp.role === 'manager' ? 'bg-indigo-50 text-indigo-700' :
                    emp.role === 'driver' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {emp.role === 'admin' ? 'ადმინისტრატორი' :
                     emp.role === 'manager' ? 'მენეჯერი' :
                     emp.role === 'driver' ? 'მძღოლი' :
                     'თანმხლები პირი'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => startEdit(emp)}
                    className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-gray-50 rounded"
                  >
                    <Edit2 size={13} />
                  </button>
                  {emp.id !== currentEmployee.id && (
                    <button 
                      onClick={() => onDelete(emp.id, emp.name)}
                      className="p-1 text-gray-400 hover:text-red-630 hover:bg-gray-50 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="text-[11px] text-gray-500 space-y-1 pt-1 font-sans">
                <p><strong>პირადი ნომერი:</strong> <span className="font-mono">{emp.personal_id}</span></p>
                <p><strong>ელ. ფოსტა:</strong> <span className="font-mono">{emp.email}</span></p>
                <p><strong>ტელეფონი:</strong> <span className="font-mono text-emerald-950 font-bold">{emp.phone}</span></p>
              </div>
            </div>

            {/* Privileges render short */}
            <div className="pt-2.5 border-t border-gray-100 space-y-1">
              <span className="text-[9px] font-black text-gray-400 uppercase block tracking-wider">მისამართი / პრივილეგიები</span>
              <div className="flex flex-wrap gap-1">
                {emp.privileges?.map((p) => (
                  <span key={p} className="text-[9px] bg-slate-100 text-gray-650 px-1.5 py-0.5 rounded-md font-mono">
                    {p}
                  </span>
                ))}
                {(!emp.privileges || emp.privileges.length === 0) && (
                  <span className="text-[9px] text-gray-400 italic">პრივილეგიები არ აქვს</span>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* FORM DIALOG */}
      {editingEmp && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl border border-gray-150">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-extrabold text-gray-800 text-sm">
                {isNew ? 'ახალი თანამშრომლის რეგისტრაცია' : `თანამშრომლის რედაქტირება: ${editingEmp.name}`}
              </h3>
              <button onClick={() => setEditingEmp(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">სახელი და გვარი *</label>
                <input 
                  type="text"
                  value={editingEmp.name}
                  onChange={(e) => setEditingEmp({...editingEmp, name: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">პირადი ნომერი *</label>
                <input 
                  type="text"
                  maxLength={11}
                  value={editingEmp.personal_id}
                  onChange={(e) => setEditingEmp({...editingEmp, personal_id: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">ელექტრონული ფოსტა *</label>
                <input 
                  type="email"
                  value={editingEmp.email}
                  onChange={(e) => setEditingEmp({...editingEmp, email: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">პაროლი</label>
                <input 
                  type="text"
                  placeholder="******"
                  value={editingEmp.password || ''}
                  onChange={(e) => setEditingEmp({...editingEmp, password: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">ტელეფონი *</label>
                <input 
                  type="text"
                  value={editingEmp.phone}
                  onChange={(e) => setEditingEmp({...editingEmp, phone: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">როლი / თანამდებობა *</label>
                <select
                  value={editingEmp.role}
                  onChange={(e) => setEditingEmp({...editingEmp, role: e.target.value as EmployeeRole})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="admin">ადმინისტრატორი</option>
                  <option value="manager">მენეჯერი</option>
                  <option value="driver">მძღოლი</option>
                  <option value="companion">თანმხლები პირი</option>
                </select>
              </div>

              {/* Privileges checklist */}
              <div className="col-span-1 sm:col-span-2 space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 block pb-1 border-b">ოპერაციების პრივილეგიები</label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {availablePrivileges.map((p) => {
                    const checked = editingEmp.privileges.includes(p);
                    return (
                      <label key={p} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50">
                        <input 
                          type="checkbox" 
                          checked={checked}
                          onChange={() => togglePrivilege(p)}
                          className="rounded border-gray-300 text-emerald-800 focus:ring-emerald-500"
                        />
                        <span className="text-gray-700 font-mono">{p}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button 
                onClick={() => setEditingEmp(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
              >
                გაუქმება
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-4 py-2 bg-emerald-850 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition"
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
