import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { formatPhone } from '../../utils/lang';

interface Props {
  editingUser: User;
  setEditingUser: React.Dispatch<React.SetStateAction<User | null>>;
  isNew: boolean;
  currentUser: User;
  onSave: (user: User) => void;
  onCancel: () => void;
  onRegisterTriggers?: (triggers: { save: () => void; fillDummy: () => void }) => void;
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
  onRegisterTriggers
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (onRegisterTriggers) {
      onRegisterTriggers({
        save: handleSaveAll,
        fillDummy: fillDummyUser
      });
    }
  }, [editingUser, isNew, onRegisterTriggers]);

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
        finalPrivileges = ['All', 'Management', 'Orders', 'Reports', 'Analytics', 'Lookups'];
      } else if (editingUser.role === 'manager') {
        finalPrivileges = ['Management', 'Orders', 'Reports', 'Analytics'];
      } else if (editingUser.role === 'driver') {
        finalPrivileges = ['Logistics', 'My Tasks Only'];
      } else if (editingUser.role === 'vendor') {
        finalPrivileges = ['My Tasks Only'];
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
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans transition-all ${
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
              setEditingUser({...editingUser, personal_id: e.target.value.replace(/\\D/g, '')});
              if (fieldErrors.personal_id) setFieldErrors(prev => ({ ...prev, personal_id: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-mono transition-all ${
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
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-mono transition-all disabled:opacity-65 ${
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
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-mono transition-all ${
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
            onFocus={(e) => { 
              if (!editingUser.phone) setEditingUser({...editingUser, phone: '+995 '});
            }}
            onChange={(e) => {
              setEditingUser({...editingUser, phone: formatPhone(e.target.value)});
              if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-mono transition-all ${
              fieldErrors.phone 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-950' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          />
          {fieldErrors.phone && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
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
              const role = e.target.value as any;
              let autoPrivileges = editingUser.privileges || [];
              
              if (role === 'admin') autoPrivileges = [...availablePrivileges];
              else if (role === 'manager') autoPrivileges = ['Orders'];
              else if (role === 'driver') autoPrivileges = ['Assigned Tasks Only'];
              else if (role === 'vendor') autoPrivileges = ['Assigned Tasks Only'];

              setEditingUser({
                ...editingUser, 
                role: role,
                privileges: autoPrivileges
              });
              if (fieldErrors.role) setFieldErrors(prev => ({ ...prev, role: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
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
                <div key={privilege} className="flex items-center gap-3 py-1.5 last:border-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => togglePrivilege(privilege)}
                    className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500 focus:ring-2 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700 font-sans cursor-pointer select-none" onClick={() => togglePrivilege(privilege)}>{privilege}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
