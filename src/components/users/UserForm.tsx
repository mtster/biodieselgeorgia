import React, { useState, useEffect, useImperativeHandle } from 'react';
import { User, UserRole, Warehouse } from '../../types';
import { formatPhone, t } from '../../utils/lang';
import { FormInput, FormSelect } from '../FormInput';
import { Check } from 'lucide-react';

interface Props {
  editingUser: User;
  setEditingUser: React.Dispatch<React.SetStateAction<User | null>>;
  isNew: boolean;
  currentUser: User;
  warehouses: Warehouse[];
  suppliers?: any[];
  onSave: (user: User) => void;
  onCancel: () => void;
  formRef?: React.RefObject<{ save: () => void; fillDummy: () => void }>;
}

export const permissionPages = [
  { id: 'dashboard', label: 'Dashboard', viewOnly: true },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'communications', label: 'Communications' },
  { id: 'orders', label: 'Orders' },
  { id: 'reports', label: 'Reports', viewOnly: true },
  { id: 'users', label: 'Users' },
  { id: 'cities', label: 'Cities' },
  { id: 'directions', label: 'Directions' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'warehouses', label: 'Warehouses' },
  { id: 'history', label: 'Changes History', viewOnly: true }
];

export const defaultPermissions: Record<string, Record<string, string[]>> = {
  purchasing_head: {
    dashboard: ['view'],
    suppliers: ['view', 'add', 'modify', 'delete'],
    contacts: ['view', 'add', 'modify', 'delete'],
    communications: ['view', 'add', 'modify', 'delete'],
    orders: ['view', 'add', 'modify', 'delete'],
    reports: ['view'],
    users: ['view', 'add', 'modify', 'delete'],
    cities: ['view', 'add', 'modify', 'delete'],
    directions: ['view', 'add', 'modify', 'delete'],
    vehicles: ['view', 'add', 'modify', 'delete'],
    warehouses: ['view', 'add', 'modify', 'delete'],
    history: ['view']
  },
  manager: {
    dashboard: ['view'],
    suppliers: ['view', 'add', 'modify', 'delete'],
    contacts: ['view', 'add', 'modify', 'delete'],
    communications: ['view', 'add', 'modify', 'delete'],
    orders: ['view', 'add', 'modify', 'delete'],
    reports: ['view'],
    users: ['view', 'add', 'modify', 'delete'],
    cities: ['view', 'add', 'modify', 'delete'],
    directions: ['view', 'add', 'modify', 'delete'],
    vehicles: ['view', 'add', 'modify', 'delete'],
    warehouses: ['view', 'add', 'modify', 'delete'],
    history: ['view']
  },
  purchasing_manager: {
    dashboard: ['view'],
    suppliers: ['view', 'add', 'modify'],
    contacts: ['view', 'add', 'modify', 'delete'],
    communications: ['view', 'add', 'modify'],
    orders: ['view', 'add', 'modify', 'delete'],
    reports: ['view'],
    users: ['view', 'add', 'modify'],
    cities: ['view', 'add', 'modify', 'delete'],
    directions: ['view', 'add', 'modify', 'delete'],
    vehicles: ['view', 'add', 'modify', 'delete'],
    warehouses: ['view', 'add', 'modify', 'delete'],
    history: ['view']
  },
  operator: {
    dashboard: ['view'],
    suppliers: ['view'],
    contacts: ['view', 'add', 'modify'],
    communications: ['view', 'add', 'modify'],
    orders: ['view', 'add', 'modify'],
    reports: [],
    users: ['view'],
    cities: ['view'],
    directions: ['view'],
    vehicles: ['view'],
    warehouses: ['view'],
    history: ['view']
  }
};

export default function UserForm({
  editingUser,
  setEditingUser,
  isNew,
  currentUser,
  warehouses,
  suppliers = [],
  onSave,
  onCancel,
  formRef
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingUser && !editingUser.permissions) {
      if (editingUser.role === 'admin') {
         // admin permissions are fully checked visually but we don't need to populate state unless we want to
      } else {
         const def = defaultPermissions[editingUser.role];
         if (def) {
           setEditingUser({ ...editingUser, permissions: JSON.parse(JSON.stringify(def)) });
         } else {
           setEditingUser({ ...editingUser, permissions: {} });
         }
      }
    }
  }, [editingUser, setEditingUser, isNew]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const val = input.value;
    const start = input.selectionStart || 0;

    const beforeCursor = val.slice(0, start);
    const digitsBefore = beforeCursor.replace(/[^0-9+]/g, '').length;

    const formatted = formatPhone(val);
    setEditingUser(prev => prev ? { ...prev, phone: formatted } : null);
    if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));

    setTimeout(() => {
      let newPos = 0;
      let digitCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ' ') {
          digitCount++;
        }
        if (digitCount === digitsBefore) {
          newPos = i + 1;
          break;
        }
      }
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const preventCursorBehindPlus = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.selectionStart !== null && input.selectionStart < 1) {
      input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;

      if (start === 1 && end === 1) {
        e.preventDefault();
        return;
      }

      if (start === end && start !== null && start > 0) {
        const val = input.value;
        const charToLeft = val[start - 1];

        if (charToLeft === ' ') {
          e.preventDefault();

          let deleteIdx = start - 1;
          while (deleteIdx >= 0 && val[deleteIdx] === ' ') {
            deleteIdx--;
          }

          if (deleteIdx >= 0) {
            const newVal = val.slice(0, deleteIdx) + val.slice(deleteIdx + 1);
            const formatted = formatPhone(newVal);

            const digitsBefore = val.slice(0, deleteIdx).replace(/[^0-9+]/g, '').length;
            setEditingUser(prev => prev ? { ...prev, phone: formatted } : null);
            if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));

            setTimeout(() => {
              let newPos = 0;
              let digitCount = 0;
              for (let i = 0; i < formatted.length; i++) {
                if (formatted[i] !== ' ') {
                  digitCount++;
                }
                if (digitCount === digitsBefore) {
                  newPos = i + 1;
                  break;
                }
              }
              input.setSelectionRange(newPos, newPos);
            }, 0);
          }
        }
      }
    }
  };

  const handleSaveAll = () => {
    if (!editingUser) return;
    const errs: Record<string, string> = {};

    if (!editingUser.name.trim()) {
      errs.name = t('Full Name is required.');
    }
    if (!editingUser.personal_id.trim()) {
      errs.personal_id = t('Personal ID is required.');
    } else if (editingUser.personal_id.trim().length !== 11) {
      errs.personal_id = t('Personal ID must be exactly 11 digits.');
    }

    if (!editingUser.email.trim()) {
      errs.email = t('Email is required.');
    }

    if (isNew && (!editingUser.password || editingUser.password.trim().length < 6)) {
      errs.password = t('Password must be at least 6 characters.');
    }

    if (!editingUser.phone.trim() || editingUser.phone.trim() === '+995') {
      errs.phone = t('Phone number is required.');
    }

    if (!editingUser.role) {
      errs.role = t('Please select a system Role / Designation.');
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      
      const firstErr = document.querySelector('[id^="user-"]');
      if (firstErr) {
        firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const finalUser = { ...editingUser };
    let finalEmail = finalUser.email.trim();
    if (finalEmail && !finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@biodiesel.ge`;
    }
    finalUser.email = finalEmail;

    if (finalUser.role === 'admin') {
      finalUser.permissions = undefined; 
    } else if (finalUser.role === 'logistics_manager' || finalUser.role === 'driver') {
      finalUser.permissions = undefined;
    }
    onSave(finalUser);
  };

  const fillDummyUser = () => {
    setEditingUser({
      id: '',
      name: 'Test Manager',
      personal_id: '01011011111',
      email: 'testmanager@biodiesel.ge',
      password: 'manager123',
      phone: '+995 555 11 22 33',
      role: 'purchasing_head',
      permissions: JSON.parse(JSON.stringify(defaultPermissions['purchasing_head'] || {})),
      is_deleted: false,
      is_blocked: false
    });
    setFieldErrors({});
  };

  useImperativeHandle(formRef, () => ({
    save: handleSaveAll,
    fillDummy: fillDummyUser
  }));

  const togglePermission = (pageId: string, type: 'view' | 'add' | 'modify' | 'delete') => {
    if (!editingUser || editingUser.role === 'admin') return;
    const currentPerms = editingUser.permissions || {};
    const pagePerms = currentPerms[pageId] || [];
    let updatedPagePerms = [...pagePerms];

    if (type === 'view') {
      if (updatedPagePerms.includes('view')) {
        // Unchecking view => immediately clear all other permissions
        updatedPagePerms = [];
      } else {
        updatedPagePerms.push('view');
      }
    } else {
      // Cannot toggle add/modify/delete if view is not checked
      if (!updatedPagePerms.includes('view')) return;

      if (updatedPagePerms.includes(type)) {
        updatedPagePerms = updatedPagePerms.filter(p => p !== type);
      } else {
        updatedPagePerms.push(type);
      }
    }

    setEditingUser({
      ...editingUser,
      permissions: {
        ...currentPerms,
        [pageId]: updatedPagePerms
      }
    });
  };

  if (!editingUser) return null;

  const isAdmin = editingUser.role === 'admin';
  const showPermissions = !['driver', 'logistics_manager'].includes(editingUser.role);

  return (
    <div className="animate-in fade-in duration-200 max-w-4xl space-y-6 text-left" id="users-form-panel">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
        <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
          {t("User Account Details")}
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label={t("Full Name") + " *"}
            type="text"
            id="user-full-name"
            value={editingUser.name}
            onChange={(e) => {
              setEditingUser({...editingUser, name: e.target.value});
              if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
            }}
            error={fieldErrors.name}
          />
          <FormInput
            label={t("Personal ID (11 digits)") + " *"}
            type="text"
            id="user-personal-id"
            fontClass="font-mono"
            maxLength={11}
            value={editingUser.personal_id}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
              setEditingUser({...editingUser, personal_id: val});
              if (fieldErrors.personal_id) setFieldErrors(prev => ({ ...prev, personal_id: '' }));
            }}
            error={fieldErrors.personal_id}
          />

          <FormInput
            label={t("Email Address") + " *"}
            type="email"
            id="user-email-address"
            value={editingUser.email}
            onChange={(e) => {
              setEditingUser({...editingUser, email: e.target.value});
              if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
            }}
            error={fieldErrors.email}
          />

          <FormInput
            label={isNew ? t("Password (min. 6 symbols)") + " *" : t("Change Password (Optional)")}
            type="password"
            id="user-password"
            value={editingUser.password || ''}
            onChange={(e) => {
              setEditingUser({...editingUser, password: e.target.value});
              if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
            }}
            error={fieldErrors.password}
          />

          <FormInput
            label={t("Phone") + " *"}
            type="text"
            id="user-phone-number"
            fontClass="font-mono"
            value={editingUser.phone}
            onFocus={(e) => { 
              if (!editingUser.phone) setEditingUser({...editingUser, phone: '+995 '});
            }}
            onSelect={preventCursorBehindPlus}
            onClick={preventCursorBehindPlus}
            onTouchEnd={preventCursorBehindPlus}
            onChange={handlePhoneChange}
            onKeyDown={handlePhoneKeyDown}
            error={fieldErrors.phone}
          />

          <FormSelect
            label={t("Role / Designation") + " *"}
            value={editingUser.role || ''}
            onChange={(e) => {
              const role = e.target.value as any;
              let perms = {};
              if (defaultPermissions[role]) {
                perms = JSON.parse(JSON.stringify(defaultPermissions[role]));
              }
              setEditingUser({
                ...editingUser, 
                role: role,
                permissions: perms
              });
              if (fieldErrors.role) setFieldErrors(prev => ({ ...prev, role: '' }));
            }}
            error={fieldErrors.role}
          >
            <option value="" hidden></option>
            <option value="admin">{t("Admin")}</option>
            <option value="purchasing_head">{t("Purchasing Group Leader")}</option>
            <option value="purchasing_manager">{t("Purchasing Manager")}</option>
            <option value="operator">{t("Operator")}</option>
            <option value="logistics_manager">{t("Logistics Manager")}</option>
            <option value="driver">{t("Logistics/Driver")}</option>
          </FormSelect>

          <FormSelect
            label={t("Status") + " *"}
            value={editingUser.is_blocked ? 'blocked' : 'active'}
            onChange={(e) => {
              const blockedState = e.target.value === 'blocked';
              setEditingUser({
                ...editingUser,
                is_blocked: blockedState
              });
            }}
          >
            <option value="active">{t("Active")}</option>
            <option value="blocked">{t("Blocked")}</option>
          </FormSelect>
        </div>
      </div>

      {showPermissions && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5 text-left">
          <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
            {t("Permissions")}
          </span>

          <div className="border border-gray-100 rounded-xl overflow-x-auto bg-white select-none shadow-xs">
            <div className="min-w-[600px]">
              {/* Table Header */}
              <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 border-b border-gray-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <div className="col-span-4 text-left">{t("Modules / Pages")}</div>
                <div className="col-span-2 text-center">{t("View")}</div>
                <div className="col-span-2 text-center">{t("Add")}</div>
                <div className="col-span-2 text-center">{t("Modify")}</div>
                <div className="col-span-2 text-center">{t("Delete")}</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-gray-100 font-sans">
                {permissionPages.map((page) => {
                  const perms = isAdmin 
                    ? ['view', 'add', 'modify', 'delete'] 
                    : ((editingUser.permissions || {})[page.id] || []);
                    
                  const isViewChecked = perms.includes('view');
                  const opacityClass = isAdmin ? 'opacity-50 pointer-events-none' : '';
                  const otherOpacityClass = (isAdmin || !isViewChecked) ? 'opacity-30 cursor-not-allowed bg-slate-100 border-gray-200' : 'cursor-pointer';

                  return (
                    <div key={page.id} className="grid grid-cols-12 px-4 py-2.5 items-center">
                      <span className="col-span-4 text-xs font-bold text-gray-700 font-sans truncate pr-2" title={t(page.label)}>{t(page.label)}</span>
                      
                      {/* View Checkbox */}
                      <div className="col-span-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => togglePermission(page.id, 'view')}
                          disabled={isAdmin}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${opacityClass} ${
                            perms.includes('view')
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {perms.includes('view') && <Check size={11} strokeWidth={3.5} />}
                        </button>
                      </div>

                      {/* Add Checkbox */}
                      <div className="col-span-2 flex justify-center">
                        {!page.viewOnly && (
                          <button
                            type="button"
                            onClick={() => togglePermission(page.id, 'add')}
                            disabled={isAdmin || !isViewChecked}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${otherOpacityClass} ${
                              perms.includes('add')
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            {perms.includes('add') && <Check size={11} strokeWidth={3.5} />}
                          </button>
                        )}
                      </div>

                      {/* Edit Checkbox */}
                      <div className="col-span-2 flex justify-center">
                        {!page.viewOnly && (
                          <button
                            type="button"
                            onClick={() => togglePermission(page.id, 'modify')}
                            disabled={isAdmin || !isViewChecked}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${otherOpacityClass} ${
                              perms.includes('modify')
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            {perms.includes('modify') && <Check size={11} strokeWidth={3.5} />}
                          </button>
                        )}
                      </div>

                      {/* Delete Checkbox */}
                      <div className="col-span-2 flex justify-center">
                        {!page.viewOnly && (
                          <button
                            type="button"
                            onClick={() => togglePermission(page.id, 'delete')}
                            disabled={isAdmin || !isViewChecked}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${otherOpacityClass} ${
                              perms.includes('delete')
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            {perms.includes('delete') && <Check size={11} strokeWidth={3.5} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

