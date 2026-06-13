import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Plus, Search, Trash2, Edit2, ShieldAlert, Key, UserCheck, X, Check } from 'lucide-react';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Privileges choices (matching seed roles or custom privileges)
  const availablePrivileges = [
    'All', 
    'Management', 
    'Orders', 
    'Reports', 
    'Logistics',
    'My Tasks Only',
    'Analytics',
    'Lookups'
  ];

  const startNew = () => {
    setErrorMessage(null);
    const defaultUser: User = {
      id: '',
      name: '',
      personal_id: '',
      email: '',
      password: '',
      phone: '',
      role: '' as any, // force empty so they choose role
      privileges: [],
      created_at: new Date().toISOString()
    };
    setEditingUser(defaultUser);
    setIsNew(true);
    // Smooth scroll to form
    setTimeout(() => {
      document.getElementById('user-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const startEdit = (usr: User) => {
    setErrorMessage(null);
    setEditingUser(JSON.parse(JSON.stringify(usr)));
    setIsNew(false);
    setTimeout(() => {
      document.getElementById('user-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const togglePrivilege = (priv: string) => {
    if (!editingUser) return;
    const isChecked = editingUser.privileges.includes(priv);
    let updated: string[];

    if (priv === 'All') {
      if (isChecked) {
        updated = [];
      } else {
        updated = [...availablePrivileges];
      }
    } else {
      if (isChecked) {
        updated = editingUser.privileges.filter(p => p !== priv && p !== 'All');
      } else {
        const temp = [...editingUser.privileges, priv];
        const hasAllOthers = availablePrivileges.filter(p => p !== 'All').every(p => temp.includes(p));
        if (hasAllOthers) {
          updated = [...availablePrivileges];
        } else {
          updated = temp;
        }
      }
    }

    setEditingUser({
      ...editingUser,
      privileges: updated
    });
  };

  const handleSaveAll = () => {
    if (!editingUser) return;
    setErrorMessage(null);

    if (!editingUser.name.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!editingUser.personal_id || editingUser.personal_id.length !== 11) {
      setErrorMessage('Personal ID must be exactly 11 digits.');
      return;
    }
    
    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editingUser.email.trim() || !emailRegex.test(editingUser.email.trim())) {
      setErrorMessage('Please provide a valid email address (e.g. name@domain.com).');
      return;
    }

    if (!editingUser.phone.trim()) {
      setErrorMessage('Phone number is required.');
      return;
    }

    // Role selection confirmation
    if (!editingUser.role) {
      setErrorMessage('Please select a system Role / Designation.');
      return;
    }

    // Set typical privileges based on role if left empty
    if (editingUser.privileges.length === 0) {
      if (editingUser.role === 'admin') {
        editingUser.privileges = ['All', 'Management', 'Orders', 'Reports', 'Analytics', 'Lookups'];
      } else if (editingUser.role === 'manager') {
        editingUser.privileges = ['Management', 'Orders', 'Reports', 'Analytics'];
      } else if (editingUser.role === 'driver') {
        editingUser.privileges = ['Logistics', 'My Tasks Only'];
      } else if (editingUser.role === 'vendor') {
        editingUser.privileges = ['My Tasks Only'];
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
          <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">System Users</h2>
          <p className="text-xs text-gray-550 mt-1">
            Biodiesel Georgia staff, managers, drivers, suppliers, and their operations privileges.
          </p>
        </div>

        {currentUser.role === 'admin' && (
          <div>
            <button 
              id="btn-add-new-user"
              onClick={startNew}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition-all cursor-pointer shadow-sm select-none"
            >
              <Plus size={15} />
              New User
            </button>
          </div>
        )}
      </div>

      {/* ON-SCREEN EDIT FORM */}
      {editingUser && (
        <div id="user-form-anchor" className="bg-white border rounded-2xl p-6 shadow-xs space-y-5 animate-in fade-in duration-200 border-emerald-300">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">
                {isNew ? '✨ Create New User Profile' : `✏️ Edit User Profile: ${editingUser.name}`}
              </h3>
              <p className="text-[11px] text-gray-405">All fields marked with an asterisk (*) are required</p>
            </div>
            <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 p-1 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer">
              <X size={16} />
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-sans font-medium">
              <ShieldAlert size={14} className="text-red-650" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Input card section */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-gray-550 block mb-1">Full Name *</label>
                <input 
                  type="text"
                  placeholder="e.g. Giorgi Margvelashvili"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-550 block mb-1">Personal ID (11 digits) *</label>
                <input 
                  type="text"
                  maxLength={11}
                  placeholder="e.g. 01019022334"
                  value={editingUser.personal_id}
                  onChange={(e) => setEditingUser({...editingUser, personal_id: e.target.value.replace(/\D/g, '')})}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-555 block mb-1">Email Address *</label>
                <input 
                  type="email"
                  placeholder="e.g. giorgi@biodiesel.ge"
                  value={editingUser.email}
                  disabled={!isNew && currentUser.role !== 'admin'}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-65"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-555 block mb-1">{isNew ? 'Password *' : 'Change Password'}</label>
                <input 
                  type="password"
                  placeholder={isNew ? 'e.g. Georgia2026!' : 'Enter new password if updating...'}
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-555 block mb-1">Phone *</label>
                <input 
                  type="text"
                  placeholder="e.g. 599112233"
                  value={editingUser.phone}
                  onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-555 block mb-1">Role / Designation *</label>
                <select
                  value={editingUser.role || ''}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans cursor-pointer"
                >
                  <option value="" disabled>--- CHOOSE ROLE ---</option>
                  <option value="admin">Administrator (Admin)</option>
                  <option value="manager">Manager</option>
                  <option value="driver">Driver</option>
                  <option value="vendor">Supplier (Vendor)</option>
                </select>
              </div>
            </div>

            {/* iOS Toggles Privileges card section */}
            <div className="bg-slate-50 rounded-2xl p-4.5 border border-slate-100 flex flex-col justify-between">
              <div>
                <div className="pb-2 border-b border-slate-200 mb-3">
                  <span className="text-[11px] font-black tracking-wider text-slate-550 uppercase block">Operation Privileges</span>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-sans">Toggle permission states. Toggling "All" automatically selects every standard privilege.</p>
                </div>
                
                <div className="space-y-2.5 select-none">
                  {availablePrivileges.map((p) => {
                    const checked = editingUser.privileges.includes(p);
                    return (
                      <div key={p} className="flex items-center justify-between py-0.5">
                        <span className="text-xs font-bold text-slate-700 font-sans">{p}</span>
                        
                        {/* iOS style rounded slider switch toggler */}
                        <button
                          type="button"
                          onClick={() => togglePrivilege(p)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            checked ? 'bg-emerald-800' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                              checked ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-end gap-3">
                <button 
                  onClick={() => setEditingUser(null)}
                  className="px-4.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 hover:text-gray-800 rounded-xl text-xs font-bold leading-none cursor-pointer transition select-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveAll}
                  className="px-5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-black shadow-xs hover:bg-emerald-900 transition leading-none cursor-pointer select-none"
                >
                  Save User
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Filter box */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4.5 shadow-xs flex items-center relative">
        <span className="absolute inset-y-0 left-0 pl-4.5 flex items-center text-gray-400">
          <Search size={15} />
        </span>
        <input 
          type="text"
          placeholder="Search by name, ID, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200/85 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((usr) => (
          <div 
            key={usr.id}
            className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-250 transition"
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
                    {usr.role === 'admin' ? 'Administrator' :
                     usr.role === 'manager' ? 'Manager' :
                     usr.role === 'driver' ? 'Driver' :
                     usr.role === 'vendor' ? 'Supplier (Vendor)' : 'Unknown'}
                  </span>
                </div>
                {currentUser.role === 'admin' && (
                  <div className="flex gap-1 select-none">
                    <button 
                      onClick={() => startEdit(usr)}
                      className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                    >
                      <Edit2 size={13} />
                    </button>
                    {usr.id !== currentUser.id && (
                      <button 
                        onClick={() => onDelete(usr.id, usr.name)}
                        className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="text-[11px] text-gray-500 space-y-1 pt-1 font-sans">
                <p><strong>Personal ID:</strong> <span className="font-mono">{usr.personal_id}</span></p>
                <p><strong>Email:</strong> <span className="font-mono">{usr.email}</span></p>
                <p><strong>Phone:</strong> <span className="font-mono text-emerald-900 font-bold">{usr.phone}</span></p>
              </div>
            </div>

            {/* Privileges render short */}
            <div className="pt-2.5 border-t border-gray-100 space-y-1">
              <span className="text-[9px] font-black text-gray-400 uppercase block tracking-wider">Privileges</span>
              <div className="flex flex-wrap gap-1">
                {usr.privileges?.map((p) => (
                  <span key={p} className="text-[9px] bg-slate-100 text-gray-650 px-1.5 py-0.5 rounded-md font-mono font-medium">
                    {p}
                  </span>
                ))}
                {(!usr.privileges || usr.privileges.length === 0) && (
                  <span className="text-[9px] text-gray-400 italic">No custom privileges</span>
                )}
              </div>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
