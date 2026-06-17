import React, { useState, useEffect, useImperativeHandle } from 'react';
import { User, UserRole } from '../../types';
import { formatPhone } from '../../utils/lang';
import { FormInput, FormSelect } from '../FormInput';

interface Props {
  editingUser: User;
  setEditingUser: React.Dispatch<React.SetStateAction<User | null>>;
  isNew: boolean;
  currentUser: User;
  onSave: (user: User) => void;
  onCancel: () => void;
  formRef?: React.RefObject<{ save: () => void; fillDummy: () => void }>;
}

export const availablePrivileges = [
  'All', 
  'User Management', 
  'Orders', 
  'Assigned Tasks Only', 
  'Analytics',
  'Reports'
];

export default function UserForm({
  editingUser,
  setEditingUser,
  isNew,
  currentUser,
  onSave,
  onCancel,
  formRef
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useImperativeHandle(formRef, () => ({
    save: handleSaveAll,
    fillDummy: fillDummyUser
  }));

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
        updated = editingUser.privileges.filter(p => p !== priv && p !== 'All');
      } else {
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
    let finalPrivileges = editingUser.privileges;
    if (finalPrivileges.length === 0) {
      if (editingUser.role === 'admin') {
        finalPrivileges = ['All', 'User Management', 'Orders', 'Reports', 'Analytics'];
      } else if (editingUser.role === 'manager') {
        finalPrivileges = ['User Management', 'Orders', 'Reports', 'Analytics'];
      } else if (editingUser.role === 'driver') {
        finalPrivileges = ['Assigned Tasks Only'];
      } else if (editingUser.role === 'vendor') {
        finalPrivileges = ['Assigned Tasks Only'];
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
        name: 'Dummy User ' + Math.floor(Math.random() * 1000),
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
        <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Profile Information</span>
        
        <FormInput
          label="Full Name *"
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
          label="Personal ID (11 digits) *"
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
          label="Email Address *"
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
          label={isNew ? 'Password *' : 'Change Password (Optional)'}
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
          label="Phone *"
          type="text"
          id="user-phone-number"
          fontClass="font-mono"
          value={editingUser.phone}
          onFocus={(e) => { 
            if (!editingUser.phone) setEditingUser({...editingUser, phone: '+995 '});
          }}
          onChange={(e) => {
            setEditingUser({...editingUser, phone: formatPhone(e.target.value)});
            if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));
          }}
          error={fieldErrors.phone}
        />

        <FormSelect
          label="Role / Designation *"
          value={editingUser.role || ''}
          onChange={(e) => {
            const role = e.target.value as any;
            let autoPrivileges = editingUser.privileges || [];
            
            if (role === 'admin') autoPrivileges = [...availablePrivileges];
            else if (role === 'manager') autoPrivileges = ['Orders', 'User Management', 'Reports', 'Analytics'];
            else if (role === 'driver') autoPrivileges = ['Assigned Tasks Only'];
            else if (role === 'vendor') autoPrivileges = ['Assigned Tasks Only'];

            setEditingUser({
              ...editingUser, 
              role: role,
              privileges: autoPrivileges
            });
            if (fieldErrors.role) setFieldErrors(prev => ({ ...prev, role: '' }));
          }}
          error={fieldErrors.role}
        >
          <option value="" hidden></option>
          <option value="admin">Administrator (Admin)</option>
          <option value="manager">Manager</option>
          <option value="driver">Driver</option>
          <option value="vendor">Supplier (Vendor)</option>
        </FormSelect>

        {/* Privileges card with beautiful iOS slider toggles using green color */}
        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wide">Operation Privileges</h4>
            <p className="text-[10px] text-gray-405 mt-0.5 leading-tight font-sans">Toggle permission states. Toggle "All" to select every core standard functionality.</p>
          </div>
          
          <div className="space-y-3 select-none">
            {availablePrivileges.map((privilege) => {
              const hasAll = editingUser.privileges.includes('All');
              const isChecked = privilege === 'All' ? hasAll : (hasAll || editingUser.privileges.includes(privilege));
              return (
                <div key={privilege} className="flex items-center justify-between py-1 border-b border-gray-200/50 last:border-0">
                  <span className="text-xs font-bold text-slate-700 font-sans">{privilege}</span>
                  
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
      </div>
    </div>
  );
}
