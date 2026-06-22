import React, { useState, useRef } from 'react';
import { t } from '../../utils/lang';
import { User, UserRole, Warehouse } from '../../types';
import { Plus, Search, Trash2, Edit2, ShieldAlert, X } from 'lucide-react';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import DeleteButton from '../DeleteButton';

import UserForm from '../users/UserForm';

interface Props {
  users: User[];
  currentUser: User;
  warehouses: Warehouse[];
  onSave: (user: User) => void;
  onDelete: (id: string, name: string) => void;
}

export default function UsersView({ users, currentUser, warehouses, onSave, onDelete }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // States
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  
  // Action triggers for child forms
  const formRef = useRef<{ save: () => void; fillDummy: () => void }>(null);

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
      role: '' as any, // Default to empty
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

  const headerActions = editingUser ? (
    <>
      {!isNew && editingUser && editingUser.id !== currentUser.id && (
        <DeleteButton
          onClick={() => {
            askDelete(editingUser.id, editingUser.name);
            setEditingUser(null);
          }}
          label="Delete"
        />
      )}
      <button 
        onClick={() => {
          formRef.current?.fillDummy();
        }}
        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-700 transition cursor-pointer select-none"
      >
        {t("Fill Dummy")}
      </button>
      <button 
        onClick={() => {
          formRef.current?.save();
        }}
        className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
      >
        {t("Save")}
      </button>
    </>
  ) : undefined;

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER */}
      <PageHeader 
        title={t("Users")}
        onBack={editingUser ? () => setEditingUser(null) : undefined}
        backButtonId="user-form-back-arrow"
        actions={headerActions}
      />

      {/* 2. FORM OR GRID VIEW */}
      {editingUser ? (
        <UserForm
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          isNew={isNew}
          currentUser={currentUser}
          warehouses={warehouses}
          onSave={handleSaveFromForm}
          onCancel={() => setEditingUser(null)}
          formRef={formRef}
        />
      ) : (
        <div className="space-y-6">

          {/* List display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 text-left w-full select-none">
            {filtered.map((usr) => (
              <div 
                key={usr.id}
                onClick={() => startEdit(usr)}
                className="bg-white border border-gray-200 hover:border-emerald-500 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 transition cursor-pointer"
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
                        {usr.role === 'admin' ? t('Administrator') :
                         usr.role === 'manager' ? t('Manager') :
                         usr.role === 'warehouse_manager' ? t('Warehouse Manager') :
                         usr.role === 'assistant' ? t('Assistant') :
                         usr.role === 'driver' ? t('Driver') :
                         usr.role === 'vendor' ? t('Supplier (Vendor)') : t('Unknown')}
                      </span>
                    </div>
                    {currentUser.role === 'admin' && (
                      <div className="flex gap-1 select-none" onClick={(e) => e.stopPropagation()}>
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
                    <p><strong>{t("Personal ID")}:</strong> <span className="font-mono">{usr.personal_id}</span></p>
                    <p><strong>{t("Email")}:</strong> <span className="font-mono">{usr.email}</span></p>
                    <p><strong>{t("Phone")}:</strong> <span className="font-mono text-emerald-900 font-bold">{usr.phone}</span></p>
                  </div>
                </div>

                {/* Privileges indicators */}
                <div className="pt-2.5 border-t border-gray-100 space-y-1">
                  <span className="text-[9px] font-black text-gray-400 uppercase block tracking-wider">{t("Privileges")}</span>
                  <div className="flex flex-wrap gap-1">
                    {usr.privileges?.includes('All') ? (
                      <span className="text-[9px] bg-slate-50 text-emerald-800 border-emerald-100 px-1.5 py-0.5 rounded-md font-mono border font-bold">
                        {t("All")}
                      </span>
                    ) : (
                      usr.privileges?.map((p) => (
                        <span key={p} className="text-[9px] bg-slate-50 text-gray-650 px-1.5 py-0.5 rounded-md font-mono border font-medium">
                          {t(p)}
                        </span>
                      ))
                    )}
                    {(!usr.privileges || usr.privileges.length === 0) && (
                      <span className="text-[9px] text-gray-400 italic">{t("No custom privileges")}</span>
                    )}
                  </div>
                </div>

              </div>
            ))}

            {/* Plus-Signed Add New User Window Card */}
            {currentUser.role === 'admin' && (
              <button
                onClick={startNew}
                type="button"
                className="bg-amber-50/10 border-2 border-dashed border-amber-500/20 hover:border-emerald-600/50 hover:bg-emerald-50/5 p-5 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-800 group-hover:text-white transition-all">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-black text-gray-500 group-hover:text-emerald-850 transition-colors mt-2">
                  {t("Add New User")}
                </span>
              </button>
            )}
            
          </div>
        </div>
      )}

      {/* SYSTEM CUSTOM DELETE CONFIRMATION MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmId}
        onClose={() => {
          setDeleteConfirmId(null);
          setDeleteConfirmName(null);
        }}
        onConfirm={confirmDelete}
        title={t("Remove User?")}
        message={
          <span>
            {t("Are you sure you want to completely delete user account profile for")} <strong>"{deleteConfirmName}"</strong>? {t("This is a permanent administrative soft-deletion.")}
          </span>
        }
      />

    </div>
  );
}
