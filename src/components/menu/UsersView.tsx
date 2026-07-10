import React, { useState, useRef, useEffect } from 'react';
import { t } from '../../utils/lang';
import { User, UserRole, Warehouse } from '../../types';
import { Plus, Search, Trash2, Edit2, ShieldAlert, X } from 'lucide-react';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import DeleteButton from '../DeleteButton';
import AddButton from '../AddButton';
import { StandardTable, ColumnConfig } from '../StandardTable';

import UserForm from '../users/UserForm';

interface Props {
  users: User[];
  currentUser: User;
  warehouses: Warehouse[];
  suppliers?: any[];
  onSave: (user: User) => void;
  onDelete: (id: string, name: string) => void;
}

export default function UsersView({ users, currentUser, warehouses, suppliers = [], onSave, onDelete }: Props) {
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

  const scrollMainToTop = () => {
    setTimeout(() => {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }, 0);
  };

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
    scrollMainToTop();
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
    scrollMainToTop();
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
  ) : (
    currentUser.role === 'admin' ? (
      <button
        onClick={startNew}
        className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 active:bg-emerald-950 transition-all duration-150 cursor-pointer shadow-sm select-none"
      >
        <Plus size={15} />
        {t("Add New User")}
      </button>
    ) : undefined
  );

  const userColumns: ColumnConfig<User>[] = [
    {
      header: t("სახელი"),
      key: 'name',
      className: 'max-w-[200px] truncate',
      render: (u) => (
        <div className="font-bold text-gray-900 truncate" title={u.name}>{u.name}</div>
      )
    },
    {
      header: t("Role"),
      key: 'role',
      className: 'max-w-[150px] truncate',
      render: (usr) => (
        <span className={`text-[9px] font-bold tracking-widest uppercase font-mono px-2 py-0.5 inline-block rounded truncate ${
          usr.role === 'admin' ? 'bg-red-50 text-red-700' :
          usr.role === 'manager' ? 'bg-indigo-50 text-indigo-700' :
          usr.role === 'driver' ? 'bg-emerald-50 text-emerald-700' :
          'bg-amber-50 text-amber-700'
        }`} title={usr.role}>
          {usr.role === 'admin' ? t('Admin') :
           usr.role === 'manager' ? t('Purchasing Group Leader') :
           usr.role === 'warehouse_manager' ? t('Logistics Manager') :
           usr.role === 'assistant' ? t('Purchasing Manager') :
           usr.role === 'driver' ? t('Logistics/Driver') :
           usr.role === 'vendor' ? t('Operator') : t('Unknown')}
        </span>
      )
    },
    {
      header: t("Personal ID"),
      key: 'personal_id',
      className: 'max-w-[120px] truncate',
      render: (u) => <span className="font-mono text-gray-500 text-xs truncate block" title={u.personal_id}>{u.personal_id}</span>
    },
    {
      header: t("Email"),
      key: 'email',
      className: 'max-w-[200px] truncate',
      render: (u) => <span className="font-mono text-gray-500 text-xs truncate block" title={u.email}>{u.email}</span>
    },
    {
      header: t("Phone"),
      key: 'phone',
      className: 'max-w-[120px] truncate',
      render: (u) => <span className="font-mono font-bold text-emerald-900 text-xs truncate block" title={u.phone}>{u.phone}</span>
    }
  ];

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
          suppliers={suppliers}
          onSave={handleSaveFromForm}
          onCancel={() => setEditingUser(null)}
          formRef={formRef}
        />
      ) : (
        <div className="space-y-6">

          {/* List display */}
          <StandardTable
            data={filtered}
            columns={userColumns}
            onRowClick={startEdit}
          />
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
