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
  };

  const startEdit = (usr: User) => {
    setErrorMessage(null);
    setEditingUser(JSON.parse(JSON.stringify(usr)));
    setIsNew(false);
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

  // architecture view replacement if form is visible
  if (editingUser) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200" id="users-form-panel">
        <div className="bg-white border rounded-2xl shadow-sm flex flex-col relative overflow-hidden max-w-2xl min-h-[500px]">
          
          {/* Sticky header containing Action with Cancel & Save */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100 py-3.5 px-6 flex justify-between items-center select-none">
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">
                {isNew ? '✨ Creating user' : `✏️ Editing: ${editingUser.name}`}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5 font-sans">
                {isNew ? 'Fill in user profile details to register them' : `Update user parameters and save changes`}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-white border border-gray-250 hover:bg-slate-50 font-bold rounded-xl text-xs text-gray-700 transition cursor-pointer select-none"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
              >
                Save
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-sans font-medium">
                <ShieldAlert size={14} className="text-red-650" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Relaxed Top-to-Bottom single column layout */}
            <div className="space-y-5 max-w-lg">
              
              {/* Full Name notch input */}
              <div className="relative">
                <input 
                  type="text"
                  id="user-full-name"
                  placeholder=" "
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans transition-all"
                />
                <label 
                  htmlFor="user-full-name" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                >
                  Full Name *
                </label>
              </div>

              {/* Personal ID notch input */}
              <div className="relative">
                <input 
                  type="text"
                  id="user-personal-id"
                  maxLength={11}
                  placeholder=" "
                  value={editingUser.personal_id}
                  onChange={(e) => setEditingUser({...editingUser, personal_id: e.target.value.replace(/\D/g, '')})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                />
                <label 
                  htmlFor="user-personal-id" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                >
                  Personal ID (11 digits) *
                </label>
              </div>

              {/* Email Address notch input */}
              <div className="relative">
                <input 
                  type="email"
                  id="user-email-address"
                  placeholder=" "
                  value={editingUser.email}
                  disabled={!isNew && currentUser.role !== 'admin'}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all disabled:opacity-65"
                />
                <label 
                  htmlFor="user-email-address" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                >
                  Email Address *
                </label>
              </div>

              {/* Password notch input */}
              <div className="relative">
                <input 
                  type="password"
                  id="user-password"
                  placeholder=" "
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                />
                <label 
                  htmlFor="user-password" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                >
                  {isNew ? 'Password *' : 'Change Password (Optional)'}
                </label>
              </div>

              {/* Phone notch input */}
              <div className="relative">
                <input 
                  type="text"
                  id="user-phone-number"
                  placeholder=" "
                  value={editingUser.phone}
                  onChange={(e) => setEditingUser({...editingUser, phone: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                />
                <label 
                  htmlFor="user-phone-number" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                >
                  Phone *
                </label>
              </div>

              {/* Designation dropdown styled like notch */}
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10">
                  Role / Designation *
                </span>
                <select
                  value={editingUser.role || ''}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserRole})}
                  className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                >
                  <option value="" disabled>--- SELECT ROLE ---</option>
                  <option value="admin">Administrator (Admin)</option>
                  <option value="manager">Manager</option>
                  <option value="driver">Driver</option>
                  <option value="vendor">Supplier (Vendor)</option>
                </select>
              </div>

              {/* Privileges with beautiful iOS slider toggles inside a nice layout card */}
              <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                <div>
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">Operation Privileges</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight font-sans">Toggle permission states. Toggle "All" to select every core standard functionality.</p>
                </div>
                
                <div className="space-y-3 select-none">
                  {availablePrivileges.map((privilege) => {
                    const isChecked = editingUser.privileges.includes(privilege);
                    return (
                      <div key={privilege} className="flex items-center justify-between py-1 border-b border-gray-100/50 last:border-0">
                        <span className="text-xs font-bold text-slate-700 font-sans">{privilege}</span>
                        
                        {/* Interactive iOS style Toggle button */}
                        <button
                          type="button"
                          onClick={() => togglePrivilege(privilege)}
                          className={`relative inline-flex h-5 w-9 shrinkage-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
                            isChecked ? 'bg-indigo-600' : 'bg-gray-250'
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

        </div>
      </div>
    );
  }

  // standard main view showing list/search if not editing/creating
  return (
    <div className="space-y-6" id="users-view-panel">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">System Users</h2>
          <p className="text-xs text-gray-550 mt-1 font-sans">
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

      {/* List Grid view */}
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
                <p><strong>Phone:</strong> <span className="font-mono text-emerald-950 font-bold">{usr.phone}</span></p>
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
