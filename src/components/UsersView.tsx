import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Plus, Search, Trash2, Edit2, ShieldAlert, Key, ToggleLeft, UserCheck, X, Check } from 'lucide-react';

interface Props {
  users: User[];
  currentUser: User;
  onSave: (user: User) => void;
  onDelete: (id: string, name: string) => void;
}

export default function UsersView({ users, currentUser, onSave, onDelete }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // States
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Privileges choices
  const availablePrivileges = [
    'ყველაფერი', 
    'მართვა', 
    'შეკვეთა', 
    'რეპორტები', 
    'ლოგისტიკა',
    'მხოლოდ_ჩემი_დავალებები',
    'ანალიტიკა',
    'ცნობარები'
  ];

  const startNew = () => {
    const defaultUser: User = {
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
    setEditingUser(defaultUser);
    setIsNew(true);
  };

  const startEdit = (usr: User) => {
    setEditingUser(JSON.parse(JSON.stringify(usr)));
    setIsNew(false);
  };

  const togglePrivilege = (priv: string) => {
    if (!editingUser) return;
    const isChecked = editingUser.privileges.includes(priv);
    let updated: string[];
    if (isChecked) {
      updated = editingUser.privileges.filter(p => p !== priv);
    } else {
      updated = [...editingUser.privileges, priv];
    }
    setEditingUser({
      ...editingUser,
      privileges: updated
    });
  };

  const handleSaveAll = () => {
    if (!editingUser) return;
    if (!editingUser.name.trim() || !editingUser.personal_id || !editingUser.email) {
      alert('გთხოვთ შეავსოთ რეალური სახელი, პირადი ნომერი და ელ-ფოსტა');
      return;
    }
    // Set typical privileges based on role if left empty
    if (editingUser.privileges.length === 0) {
      if (editingUser.role === 'admin') {
        editingUser.privileges = ['ყველაფერი', 'მართვა', 'შეკვეთა', 'რეპორტები', 'ანალიტიკა', 'ცნობარები'];
      } else if (editingUser.role === 'manager') {
        editingUser.privileges = ['მართვა', 'შეკვეთა', 'რეპორტები', 'ანალიტიკა'];
      } else if (editingUser.role === 'driver') {
        editingUser.privileges = ['ლოგისტიკა', 'მხოლოდ_ჩემი_დავალებები'];
      } else if (editingUser.role === 'vendor') {
        editingUser.privileges = ['მხოლოდ_ჩემი_დავალებები'];
      }
    }
    onSave(editingUser);
    setEditingUser(null);
  };

  const filtered = users.filter(usr => {
    return usr.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           usr.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           usr.personal_id.includes(searchTerm);
  });

  return (
    <div className="space-y-6" id="users-view-panel">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">სისტემის მომხმარებლები (მომავალი)</h2>
          <p className="text-xs text-gray-500 mt-1">
            ბიოდიზელი ჯორჯიას პერსონალი, მენეჯერები, მძღოლები, სავაჭრო პარტნიორები (Vendors) და მათი ოპერაციების პრივილეგიები.
          </p>
        </div>

        {currentUser.role === 'admin' && (
          <div>
            <button 
              id="btn-add-new-user"
              onClick={startNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition cursor-pointer shadow-sm"
            >
              <Plus size={15} />
              ახალი მომხმარებელი
            </button>
          </div>
        )}
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
          className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200/85 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((usr) => (
          <div 
            key={usr.id}
            className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-200 transition"
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-800">{usr.name}</h3>
                  <span className={`text-[9px] font-bold tracking-widest uppercase font-mono px-2 py-0.5 mt-1 inline-block rounded ${
                    usr.role === 'admin' ? 'bg-red-50 text-red-700' :
                    usr.role === 'manager' ? 'bg-indigo-50 text-indigo-700' :
                    usr.role === 'driver' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {usr.role === 'admin' ? 'ადმინისტრატორი' :
                     usr.role === 'manager' ? 'მენეჯერი' :
                     usr.role === 'driver' ? 'მძღოლი' :
                     'მომწოდებელი (Vendor)'}
                  </span>
                </div>
                {currentUser.role === 'admin' && (
                  <div className="flex gap-1">
                    <button 
                      onClick={() => startEdit(usr)}
                      className="p-1 text-gray-400 hover:text-emerald-700 hover:bg-gray-50 rounded"
                    >
                      <Edit2 size={13} />
                    </button>
                    {usr.id !== currentUser.id && (
                      <button 
                        onClick={() => onDelete(usr.id, usr.name)}
                        className="p-1 text-gray-400 hover:text-red-630 hover:bg-gray-50 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="text-[11px] text-gray-500 space-y-1 pt-1 font-sans">
                <p><strong>პირადი ნომერი:</strong> <span className="font-mono">{usr.personal_id}</span></p>
                <p><strong>ელ. ფოსტა:</strong> <span className="font-mono">{usr.email}</span></p>
                <p><strong>ტელეფონი:</strong> <span className="font-mono text-emerald-950 font-bold">{usr.phone}</span></p>
              </div>
            </div>

            {/* Privileges render short */}
            <div className="pt-2.5 border-t border-gray-100 space-y-1">
              <span className="text-[9px] font-black text-gray-400 uppercase block tracking-wider">პრივილეგიები</span>
              <div className="flex flex-wrap gap-1">
                {usr.privileges?.map((p) => (
                  <span key={p} className="text-[9px] bg-slate-100 text-gray-650 px-1.5 py-0.5 rounded-md font-mono">
                    {p}
                  </span>
                ))}
                {(!usr.privileges || usr.privileges.length === 0) && (
                  <span className="text-[9px] text-gray-400 italic">პრივილეგიები არ აქვს</span>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* FORM DIALOG */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-xl border border-gray-150">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-extrabold text-gray-800 text-sm">
                {isNew ? 'ახალი მომხმარებლის რეგისტრაცია' : `მომხმარებლის რედაქტირება: ${editingUser.name}`}
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">სახელი და გვარი *</label>
                <input 
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">პირადი ნომერი *</label>
                <input 
                  type="text"
                  maxLength={11}
                  value={editingUser.personal_id}
                  onChange={(e) => setEditingUser({...editingUser, personal_id: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">ელექტრონული ფოსტა *</label>
                <input 
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">პაროლი</label>
                <input 
                  type="password"
                  placeholder="******"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">ტელეფონი *</label>
                <input 
                  type="text"
                  value={editingUser.phone}
                  onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">როლი / თანამდებობა *</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="admin">ადმინისტრატორი (Admin)</option>
                  <option value="manager">მენეჯერი (Manager)</option>
                  <option value="driver">მძღოლი (Driver)</option>
                  <option value="vendor">მომწოდებელი (Vendor)</option>
                </select>
              </div>

              {/* Privileges checklist */}
              <div className="col-span-1 sm:col-span-2 space-y-1.5 align-left">
                <label className="text-[11px] font-bold text-gray-400 block pb-1 border-b">ოპერაციების პრივილეგიები</label>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {availablePrivileges.map((p) => {
                    const checked = editingUser.privileges.includes(p);
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
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold leading-none cursor-pointer"
              >
                გაუქმება
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition leading-none cursor-pointer"
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
