import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Plus, Search, Trash2, Edit2, ShieldAlert, X } from 'lucide-react';
import UserDeleteModal from './users/UserDeleteModal';

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  // Privileges choices
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
    setFieldErrors({});
    const defaultUser: User = {
      id: '',
      name: '',
      personal_id: '',
      email: '',
      password: '',
      phone: '',
      role: 'manager', // Default to manager
      privileges: [],
      created_at: new Date().toISOString()
    };
    setEditingUser(defaultUser);
    setIsNew(true);
  };

  const startEdit = (usr: User) => {
    setFieldErrors({});
    let privileges = [...(usr.privileges || [])];
    
    // Normalize any old legacy privileges values
    privileges = privileges.map(p => {
      if (p === 'Manage') return 'Management';
      if (p === 'Order') return 'Orders';
      return p;
    });

    // If 'All' is present, explicitly expand it to all availablePrivileges for UX clarity and seamless handling
    if (privileges.includes('All')) {
      privileges = Array.from(new Set([...privileges, ...availablePrivileges]));
    }

    setEditingUser({
      ...usr,
      privileges
    });
    setIsNew(false);
  };

  const togglePrivilege = (priv: string) => {
    if (!editingUser) return;
    const hasAll = editingUser.privileges.includes('All');
    const isChecked = priv === 'All' ? hasAll : (hasAll || editingUser.privileges.includes(priv));
    let updated: string[];

    if (priv === 'All') {
      if (hasAll) {
        updated = [];
      } else {
        updated = [...availablePrivileges];
      }
    } else {
      if (isChecked) {
        // If "All" was checked, we remove "All" and also filter out the targeted privilege
        updated = editingUser.privileges.filter(p => p !== priv && p !== 'All');
      } else {
        // Checking this privilege
        const temp = [...editingUser.privileges.filter(p => p !== 'All'), priv];
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
    const errs: Record<string, string> = {};

    if (!editingUser.name.trim()) {
      errs.name = 'Full Name is required.';
    }
    if (!editingUser.personal_id || editingUser.personal_id.length !== 11) {
      errs.personal_id = 'Personal ID must be exactly 11 digits.';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!editingUser.email.trim() || !emailRegex.test(editingUser.email.trim())) {
      errs.email = 'Please provide a valid email address.';
    }

    if (!editingUser.phone.trim()) {
      errs.phone = 'Phone number is required.';
    }

    if (!editingUser.role) {
      errs.role = 'Please select a system Role / Designation.';
    }

    if (isNew && (!editingUser.password || editingUser.password.length < 6)) {
      errs.password = 'Password for new user must be at least 6 characters.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});

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

  const fillDummyUser = () => {
    if (!editingUser) return;
    setEditingUser({
        ...editingUser,
        name: 'Dummy User ' + Math.floor(Math.random() * 1000),
        personal_id: Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join(''),
        email: `dummy${Math.floor(Math.random() * 1000)}@example.com`,
        password: 'password123',
        phone: '555-0000',
    });
  };

  const filtered = users.filter(usr => {
    return usr.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           usr.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
           usr.personal_id.includes(searchTerm);
  });

  const askDelete = (id: string, name: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId, deleteConfirmName || '');
    }
    setDeleteConfirmId(null);
    setDeleteConfirmName(null);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER */}
      <div className="-mt-4 -mx-4 md:-mt-6 md:-mx-6 mb-6">
        <div className="sticky -top-4 md:-top-6 z-20 bg-[#f8fafc]/95 backdrop-blur-md py-4 px-4 md:px-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left shadow-xs">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Users</h2>
            <p className="text-xs text-gray-550 mt-1 font-sans">
              {editingUser 
                ? (isNew ? 'Creating a new user' : `Editing: ${editingUser.name}`)
                : 'Biodiesel Georgia staff, managers, drivers, suppliers, and their operations privileges.'
              }
            </p>
          </div>

          <div className="flex items-center gap-3">
            {editingUser ? (
              <>
                <button 
                  onClick={fillDummyUser}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-700 transition cursor-pointer select-none"
                >
                  Fill Dummy
                </button>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 font-bold rounded-xl text-xs text-gray-700 transition cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveAll}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
                >
                  Save
                </button>
              </>
            ) : (
              currentUser.role === 'admin' && (
                <button 
                  id="btn-add-new-user"
                  onClick={startNew}
                  className="flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 active:bg-emerald-950 transition-all duration-150 cursor-pointer shadow-sm select-none"
                >
                  <Plus size={15} />
                  New User
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 2. FORM OR GRID VIEW */}
      {editingUser ? (
        <div className="animate-in fade-in duration-200 max-w-2xl text-left" id="users-form-panel">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
            <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Profile Information</span>
            
            {/* Full Name notch input */}
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.name ? 'text-red-500' : 'text-gray-400'}`}>
                Full Name *
              </span>
              <input 
                type="text"
                id="user-full-name"
                value={editingUser.name}
                onChange={(e) => {
                  setEditingUser({...editingUser, name: e.target.value});
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs rounded-xl focus:outline-none focus:ring-1 font-sans transition-all ${
                  fieldErrors.name 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              />
              {fieldErrors.name && (
                <p className="text-[10px] text-red-650 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Personal ID notch input */}
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.personal_id ? 'text-red-500' : 'text-gray-400'}`}>
                Personal ID (11 digits) *
              </span>
              <input 
                type="text"
                id="user-personal-id"
                maxLength={11}
                value={editingUser.personal_id}
                onChange={(e) => {
                  setEditingUser({...editingUser, personal_id: e.target.value.replace(/\D/g, '')});
                  if (fieldErrors.personal_id) setFieldErrors(prev => ({ ...prev, personal_id: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs rounded-xl focus:outline-none focus:ring-1 font-mono transition-all ${
                  fieldErrors.personal_id 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-950' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              />
              {fieldErrors.personal_id && (
                <p className="text-[10px] text-red-650 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.personal_id}
                </p>
              )}
            </div>

            {/* Email Address notch input */}
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.email ? 'text-red-500' : 'text-gray-400'}`}>
                Email Address *
              </span>
              <input 
                type="email"
                id="user-email-address"
                value={editingUser.email}
                disabled={!isNew && currentUser.role !== 'admin'}
                onChange={(e) => {
                  setEditingUser({...editingUser, email: e.target.value});
                  if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs rounded-xl focus:outline-none focus:ring-1 font-mono transition-all disabled:opacity-65 ${
                  fieldErrors.email 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-950' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-[10px] text-red-650 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password notch input */}
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.password ? 'text-red-500' : 'text-gray-400'}`}>
                {isNew ? 'Password *' : 'Change Password (Optional)'}
              </span>
              <input 
                type="password"
                id="user-password"
                value={editingUser.password || ''}
                onChange={(e) => {
                  setEditingUser({...editingUser, password: e.target.value});
                  if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs rounded-xl focus:outline-none focus:ring-1 font-mono transition-all ${
                  fieldErrors.password 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-950' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              />
              {fieldErrors.password && (
                <p className="text-[10px] text-red-650 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Phone notch input */}
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.phone ? 'text-red-500' : 'text-gray-400'}`}>
                Phone *
              </span>
              <input 
                type="text"
                id="user-phone-number"
                value={editingUser.phone}
                onChange={(e) => {
                  setEditingUser({...editingUser, phone: e.target.value});
                  if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs rounded-xl focus:outline-none focus:ring-1 font-mono transition-all ${
                  fieldErrors.phone 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-950' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              />
              {fieldErrors.phone && (
                <p className="text-[10px] text-red-650 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.phone}
                </p>
              )}
            </div>

            {/* Designation dropdown styled like notch */}
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.role ? 'text-red-500' : 'text-gray-400'}`}>
                Role / Designation *
              </span>
              <select
                value={editingUser.role || 'manager'}
                onChange={(e) => {
                  setEditingUser({...editingUser, role: e.target.value as UserRole});
                  if (fieldErrors.role) setFieldErrors(prev => ({ ...prev, role: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
                  fieldErrors.role 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              >
                <option value="admin">Administrator (Admin)</option>
                <option value="manager">Manager</option>
                <option value="driver">Driver</option>
                <option value="vendor">Supplier (Vendor)</option>
              </select>
              {fieldErrors.role && (
                <p className="text-[10px] text-red-650 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.role}
                </p>
              )}
            </div>

            {/* Privileges card with beautiful iOS slider toggles using green color */}
            <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
              <div>
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">Operation Privileges</h4>
                <p className="text-[10px] text-gray-450 mt-0.5 leading-tight font-sans">Toggle permission states. Toggle "All" to select every core standard functionality.</p>
              </div>
              
              <div className="space-y-3 select-none">
                {availablePrivileges.map((privilege) => {
                  const hasAll = editingUser.privileges.includes('All');
                  const isChecked = privilege === 'All' ? hasAll : (hasAll || editingUser.privileges.includes(privilege));
                  return (
                    <div key={privilege} className="flex items-center justify-between py-1 border-b border-gray-200/50 last:border-0">
                      <span className="text-xs font-bold text-slate-700 font-sans">{privilege}</span>
                      
                      {/* Vibrant Green iOS Style Toggle */}
                      <button
                        type="button"
                        onClick={() => togglePrivilege(privilege)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
                          isChecked ? 'bg-emerald-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-150 ease-in-out ${
                            isChecked ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4 select-none text-left">
            <div className="flex-1 relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                <Search size={15} />
              </span>
              <input 
                type="text"
                placeholder="Search by name, ID, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none transition-all font-sans"
              />
            </div>
          </div>

          {/* List display */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left max-w-5xl">
            {filtered.map((usr) => (
              <div 
                key={usr.id}
                className="bg-white border border-gray-155 border-gray-100 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-250 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-black text-gray-805 text-gray-800">{usr.name}</h3>
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
                          className="p-1.5 text-gray-400 hover:text-emerald-750 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                        {usr.id !== currentUser.id && (
                          <button 
                            onClick={() => askDelete(usr.id, usr.name)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-gray-50 rounded-lg transition cursor-pointer"
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

                {/* Privileges indicators */}
                <div className="pt-2.5 border-t border-gray-100 space-y-1">
                  <span className="text-[9px] font-black text-gray-400 uppercase block tracking-wider">Privileges</span>
                  <div className="flex flex-wrap gap-1">
                    {usr.privileges?.includes('All') ? (
                      <span className="text-[9px] bg-slate-50 text-emerald-800 border-emerald-100 px-1.5 py-0.5 rounded-md font-mono border font-bold">
                        All
                      </span>
                    ) : (
                      usr.privileges?.map((p) => (
                        <span key={p} className="text-[9px] bg-slate-50 text-gray-650 px-1.5 py-0.5 rounded-md font-mono border font-medium">
                          {p}
                        </span>
                      ))
                    )}
                    {(!usr.privileges || usr.privileges.length === 0) && (
                      <span className="text-[9px] text-gray-400 italic">No custom privileges</span>
                    )}
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* SYSTEM CUSTOM DELETE CONFIRMATION MODAL */}
      <UserDeleteModal
        isOpen={!!deleteConfirmId}
        userName={deleteConfirmName}
        onCancel={() => {
          setDeleteConfirmId(null);
          setDeleteConfirmName(null);
        }}
        onConfirm={confirmDelete}
      />

    </div>
  );
}
