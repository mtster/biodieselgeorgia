import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { Plus, Search, Trash2, Edit2, ShieldAlert, X } from 'lucide-react';
import UserDeleteModal from '../users/UserDeleteModal';

import UserForm from '../users/UserForm';

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
  
  // Action triggers for child forms
  const [formSubmitTrigger, setFormSubmitTrigger] = useState<(() => void) | null>(null);
  const [formDummyTrigger, setFormDummyTrigger] = useState<(() => void) | null>(null);

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  // Privileges choices
  const availablePrivileges = [
    'All', 
    'User Management', 
    'Orders', 
    'Assigned Tasks Only', 
    'Analytics',
    'Reports'
  ];

  const startNew = () => {
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
    let privileges = [...(usr.privileges || [])];
    
    // Normalize any old legacy privileges values
    privileges = privileges.map(p => {
      if (p === 'Manage') return 'Management';
      if (p === 'Order') return 'Orders';
      return p;
    });

    // If 'All' is present, explicitly expand it to all availablePrivileges for UX clarity and seamless handling
    if (privileges.includes('All')) {
      privileges = Array.from(new Set([...privileges, 'User Management', 'Orders', 'Assigned Tasks Only', 'Analytics', 'Reports']));
    }

    setEditingUser({
      ...usr,
      privileges
    });
    setIsNew(false);
  };

  const handleSaveFromForm = (payload: User) => {
    onSave(payload);
    setEditingUser(null);
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
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-4 bg-[#f8fafc]/95 backdrop-blur-md border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left shadow-xs mb-6">
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
                  onClick={() => {
                    if (formDummyTrigger) formDummyTrigger();
                  }}
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
                  onClick={() => {
                    if (formSubmitTrigger) formSubmitTrigger();
                  }}
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

      {/* 2. FORM OR GRID VIEW */}
      {editingUser ? (
        <UserForm
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          isNew={isNew}
          currentUser={currentUser}
          onSave={handleSaveFromForm}
          onCancel={() => setEditingUser(null)}
          onRegisterTriggers={(triggers) => {
            setFormSubmitTrigger(() => triggers.save);
            setFormDummyTrigger(() => triggers.fillDummy);
          }}
        />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 text-left w-full">
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
