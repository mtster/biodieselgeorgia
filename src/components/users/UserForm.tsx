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

export const availablePrivileges = [
  'Dashboard',
  'Suppliers',
  'Communications',
  'Orders',
  'Reports',
  'Users',
  'Cities',
  'Vehicles',
  'Warehouses',
  'Changes History'
];

const editPermissionPages = [
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'communications', label: 'Communications' },
  { id: 'orders', label: 'Orders' },
  { id: 'cities', label: 'Cities' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'warehouses', label: 'Warehouses' },
  { id: 'users', label: 'Users' }
];

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
    if (editingUser && !editingUser.edit_permissions) {
      const defaultEditPerms: Record<string, { add: boolean, edit: boolean, delete: boolean }> = {};
      editPermissionPages.forEach(p => {
        defaultEditPerms[p.id] = { add: false, edit: false, delete: false };
      });
      if (editingUser.privileges?.includes('Reports')) {
        const reportRows = ['report_suppliers', 'report_regions', 'report_managers', 'report_turnover', 'report_last_deliveries'];
        reportRows.forEach(id => {
          defaultEditPerms[id] = { add: true, edit: true, delete: true };
        });
      }
      setEditingUser({
        ...editingUser,
        edit_permissions: defaultEditPerms
      });
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

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;

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

  useImperativeHandle(formRef, () => ({
    save: handleSaveAll,
    fillDummy: fillDummyUser
  }));

  const privilegeToPageMap: Record<string, string> = {
    'Suppliers': 'suppliers',
    'Communications': 'communications',
    'Orders': 'orders',
    'Users': 'users',
    'Cities': 'cities',
    'Vehicles': 'vehicles',
    'Warehouses': 'warehouses'
  };

  const togglePrivilege = (priv: string) => {
    if (!editingUser) return;
    const isChecked = editingUser.privileges.includes(priv);
    let updatedPrivs: string[];

    if (isChecked) {
      updatedPrivs = editingUser.privileges.filter(p => p !== priv);
    } else {
      updatedPrivs = [...editingUser.privileges, priv];
    }

    const updated = {
      ...editingUser,
      privileges: updatedPrivs
    };

    // Sync to edit permissions
    const currentPerms = updated.edit_permissions || {};
    const newPerms = { ...currentPerms };
    const pageId = privilegeToPageMap[priv];

    if (pageId) {
      newPerms[pageId] = { 
        add: !isChecked, 
        edit: !isChecked, 
        delete: !isChecked 
      };
    }

    if (priv === 'Reports') {
      const reportRows = ['report_suppliers', 'report_regions', 'report_managers', 'report_turnover', 'report_last_deliveries'];
      reportRows.forEach(id => {
        newPerms[id] = {
          add: !isChecked,
          edit: !isChecked,
          delete: !isChecked
        };
      });
    }

    updated.edit_permissions = newPerms;
    setEditingUser(updated);
  };

  const toggleEditPermission = (pageId: string, type: 'add' | 'edit' | 'delete') => {
    if (!editingUser) return;
    const currentPerms = editingUser.edit_permissions || {};
    const pagePerms = currentPerms[pageId] || { add: false, edit: false, delete: false };
    const updatedPage = { ...pagePerms, [type]: !pagePerms[type] };
    const updatedAll = { ...currentPerms, [pageId]: updatedPage };
    
    let updated = {
      ...editingUser,
      edit_permissions: updatedAll
    };
    
    // Sync to menu privileges
    const privName = Object.keys(privilegeToPageMap).find(key => privilegeToPageMap[key] === pageId);
    if (privName) {
      const isAnyChecked = updatedPage.add || updatedPage.edit || updatedPage.delete;
      if (isAnyChecked && !updated.privileges.includes(privName)) {
        updated.privileges = [...updated.privileges, privName];
      } else if (!isAnyChecked && updated.privileges.includes(privName)) {
        updated.privileges = updated.privileges.filter(p => p !== privName);
      }
    }

    setEditingUser(updated);
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

    if (editingUser.role === 'vendor' && !editingUser.vendor_id) {
      errs.vendor_id = 'Please select a Supplier.';
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
    let finalPrivileges = editingUser.privileges;
    if (finalPrivileges.length === 0) {
      if (editingUser.role === 'admin') {
        finalPrivileges = ['Dashboard', 'Suppliers', 'Communications', 'Orders', 'Reports', 'Users', 'Cities', 'Vehicles', 'Changes History'];
      } else if (editingUser.role === 'manager') {
        finalPrivileges = ['Dashboard', 'Suppliers', 'Communications', 'Orders', 'Reports', 'Cities', 'Vehicles'];
      } else if (editingUser.role === 'driver') {
        finalPrivileges = ['Dashboard', 'Orders'];
      } else if (editingUser.role === 'vendor') {
        finalPrivileges = ['Dashboard', 'Orders'];
      }
    }

    onSave({
      ...editingUser,
      privileges: finalPrivileges
    });
  };

  const fillDummyUser = () => {
    if (!editingUser) return;
    setEditingUser({
        ...editingUser,
        name: 'Dummy User ' + Math.floor(Math.random() * 1055),
        personal_id: Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join(''),
        email: `dummy${Math.floor(Math.random() * 1000)}@example.com`,
        password: 'password123',
        phone: '555-0000',
    });
  };

  if (!editingUser) return null;

  return (
    <div className="animate-in fade-in duration-200 max-w-2xl text-left" id="users-form-panel">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
        <span className="text-xs font-black uppercase text-gray-400 tracking-wider block pb-2">{t("Profile Information")}</span>
        
        <FormInput
          label={t("Full Name *")}
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
          label={t("Personal ID (11 digits) *")}
          type="text"
          id="user-personal-id"
          maxLength={11}
          fontClass="font-mono"
          value={editingUser.personal_id}
          onChange={(e) => {
            setEditingUser({...editingUser, personal_id: e.target.value.replace(/\D/g, '')});
            if (fieldErrors.personal_id) setFieldErrors(prev => ({ ...prev, personal_id: '' }));
          }}
          error={fieldErrors.personal_id}
        />

        <FormInput
          label={t("Email Address *")}
          type="email"
          id="user-email-address"
          fontClass="font-mono"
          value={editingUser.email}
          disabled={!isNew && currentUser.role !== 'admin'}
          onChange={(e) => {
            setEditingUser({...editingUser, email: e.target.value});
            if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
          }}
          error={fieldErrors.email}
        />

        <FormInput
          label={isNew ? t('Password *') : t('Change Password (Optional)')}
          type="password"
          id="user-password"
          fontClass="font-mono"
          value={editingUser.password || ''}
          onChange={(e) => {
            setEditingUser({...editingUser, password: e.target.value});
            if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
          }}
          error={fieldErrors.password}
        />

        <FormInput
          label={t("Phone *")}
          type="text"
          id="user-phone-number"
          fontClass="font-mono"
          value={editingUser.phone}
          onFocus={(e) => { 
            if (!editingUser.phone) setEditingUser({...editingUser, phone: '+995 '});
          }}
          onChange={handlePhoneChange}
          onKeyDown={handlePhoneKeyDown}
          error={fieldErrors.phone}
        />

         <FormSelect
          label={t("Role / Designation *")}
          value={editingUser.role || ''}
          onChange={(e) => {
            const role = e.target.value as any;
            let autoPrivileges = editingUser.privileges || [];
            let autoEditPerms = { ...(editingUser.edit_permissions || {}) };
            
            if (role === 'admin') {
              autoPrivileges = [...availablePrivileges];
              availablePrivileges.forEach(priv => {
                const pageId = privilegeToPageMap[priv];
                if (pageId) {
                  autoEditPerms[pageId] = { add: true, edit: true, delete: true };
                }
              });
              const reportRows = ['report_suppliers', 'report_regions', 'report_managers', 'report_turnover', 'report_last_deliveries'];
              reportRows.forEach(id => {
                autoEditPerms[id] = { add: true, edit: true, delete: true };
              });
            } else if (role === 'manager') {
              autoPrivileges = ['Dashboard', 'Suppliers', 'Communications', 'Orders', 'Reports', 'Cities', 'Vehicles', 'Warehouses'];
              autoPrivileges.forEach(priv => {
                const pageId = privilegeToPageMap[priv];
                if (pageId) {
                  autoEditPerms[pageId] = { add: true, edit: true, delete: true };
                }
              });
              const reportRows = ['report_suppliers', 'report_regions', 'report_managers', 'report_turnover', 'report_last_deliveries'];
              reportRows.forEach(id => {
                autoEditPerms[id] = { add: true, edit: true, delete: true };
              });
            } else if (role === 'driver') {
              autoPrivileges = ['Dashboard', 'Orders'];
            } else if (role === 'vendor') {
              autoPrivileges = ['Dashboard', 'Orders'];
            } else if (role === 'warehouse_manager') {
              // Ensure Dashboard, Vehicles, and Warehouses
              autoPrivileges = Array.from(new Set([...autoPrivileges, 'Dashboard', 'Vehicles', 'Warehouses']));
              autoEditPerms['vehicles'] = { add: true, edit: true, delete: true };
              autoEditPerms['warehouses'] = { add: true, edit: true, delete: true };
            } else if (role === 'assistant') {
              // Ensure Dashboard, Vehicles, and Warehouses
              autoPrivileges = Array.from(new Set([...autoPrivileges, 'Dashboard', 'Vehicles', 'Warehouses']));
              autoEditPerms['vehicles'] = { add: false, edit: true, delete: false };
              autoEditPerms['warehouses'] = { add: false, edit: true, delete: false };
            }

            setEditingUser({
              ...editingUser, 
              role: role,
              privileges: autoPrivileges,
              edit_permissions: autoEditPerms
            });
            if (fieldErrors.role) setFieldErrors(prev => ({ ...prev, role: '' }));
          }}
          error={fieldErrors.role}
        >
          <option value="" hidden></option>
          <option value="admin">{t("Administrator (Admin)")}</option>
          <option value="manager">{t("Manager")}</option>
          <option value="warehouse_manager">{t("Warehouse Manager")}</option>
          <option value="assistant">{t("Assistant")}</option>
          <option value="driver">{t("Driver")}</option>
          <option value="vendor">{t("Supplier (Vendor)")}</option>
        </FormSelect>

        <FormSelect
          label={t("Status *")}
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

        <FormSelect
          label={t("Assigned Warehouse (Optional)")}
          value={editingUser.warehouse_id || ''}
          onChange={(e) => {
            setEditingUser({
              ...editingUser,
              warehouse_id: e.target.value || undefined
            });
          }}
        >
          <option value="">{t("Select a Warehouse")}</option>
          {warehouses.map(wh => (
            <option key={wh.id} value={wh.id}>{wh.name}</option>
          ))}
        </FormSelect>

        {editingUser.role === 'vendor' && (
          <FormSelect
            label={t("Assigned Supplier *")}
            value={editingUser.vendor_id || ''}
            onChange={(e) => {
              setEditingUser({
                ...editingUser,
                vendor_id: e.target.value || undefined
              });
              if (fieldErrors.vendor_id) setFieldErrors(prev => ({ ...prev, vendor_id: '' }));
            }}
            error={fieldErrors.vendor_id}
          >
            <option value="">{t("Select a Supplier")}</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.trade_name || s.company_name}</option>
            ))}
          </FormSelect>
        )}

        {/* Menu Permissions card with beautiful iOS slider toggles */}
        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest font-sans">{t("Menu Permissions")}</h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 select-none">
            {availablePrivileges.map((privilege) => {
              const isChecked = editingUser.privileges.includes(privilege);
              return (
                <div key={privilege} className="flex items-center justify-between py-1 border-b border-gray-100 sm:odd:pr-2">
                  <span className="text-xs font-bold text-slate-700 font-sans">{t(privilege)}</span>
                  
                  <button
                    type="button"
                    onClick={() => togglePrivilege(privilege)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
                      isChecked ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-155 ease-in-out ${
                        isChecked ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Permissions Card */}
        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest font-sans">{t("Edit Permissions")}</h4>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden bg-white select-none shadow-xs">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 border-b border-gray-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <div className="col-span-6 text-left">{t("Modules / Pages")}</div>
              <div className="col-span-2 text-center">{t("Add")}</div>
              <div className="col-span-2 text-center">{t("Edit")}</div>
              <div className="col-span-2 text-center">{t("Delete")}</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100 font-sans">
              {(() => {
                const visiblePages = [...editPermissionPages];
                if (editingUser.privileges?.includes('Reports')) {
                  visiblePages.push(
                    { id: 'report_suppliers', label: 'Delivered Orders by Suppliers' },
                    { id: 'report_regions', label: 'Delivered Orders by Regions' },
                    { id: 'report_managers', label: 'Delivered Orders by Managers' },
                    { id: 'report_turnover', label: 'Tanks Turnover by Suppliers' },
                    { id: 'report_last_deliveries', label: 'Last Deliveries Tracker' }
                  );
                }
                return visiblePages;
              })().map((page) => {
                const perms = (editingUser.edit_permissions || {})[page.id] || { add: false, edit: false, delete: false };
                return (
                  <div key={page.id} className="grid grid-cols-12 px-4 py-2.5 items-center">
                    <span className="col-span-6 text-xs font-bold text-gray-700 font-sans">{t(page.label)}</span>
                    
                    {/* Add Checkbox */}
                    <div className="col-span-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => toggleEditPermission(page.id, 'add')}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                          perms.add
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {perms.add && <Check size={11} strokeWidth={3.5} />}
                      </button>
                    </div>

                    {/* Edit Checkbox */}
                    <div className="col-span-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => toggleEditPermission(page.id, 'edit')}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                          perms.edit
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {perms.edit && <Check size={11} strokeWidth={3.5} />}
                      </button>
                    </div>

                    {/* Delete Checkbox */}
                    <div className="col-span-2 flex justify-center">
                      <button
                        type="button"
                        onClick={() => toggleEditPermission(page.id, 'delete')}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${
                          perms.delete
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        {perms.delete && <Check size={11} strokeWidth={3.5} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
