import React from 'react';
import { Vendor, User } from '../../types';
import { t } from '../../utils/lang';
import { WorkingHoursInput } from './WorkingHoursInput';
import { FormSelect } from '../FormInput';

interface Props {
  editingVendor: Vendor;
  setEditingVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  users: User[];
  currentUser: User;
}

export default function VendorManagementFormFields({
  editingVendor,
  setEditingVendor,
  fieldErrors,
  setFieldErrors,
  users,
  currentUser
}: Props) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5 text-left">
      <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
        {t("Management & Operations")}
      </span>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
            {t("Working Hours *")}
          </span>
          <WorkingHoursInput
            value={editingVendor.working_hours || ''}
            onChange={(val) => {
              setEditingVendor(prev => prev ? { ...prev, working_hours: val } : null);
              if (fieldErrors.working_hours) setFieldErrors(prev => ({ ...prev, working_hours: '' }));
            }}
          />
          {fieldErrors.working_hours && <p className="text-[10px] text-red-600 mt-1">{fieldErrors.working_hours}</p>}
        </div>

        <FormSelect
          label={t("Supplier / Vendor Status *")}
          value={editingVendor.status || 'Active'}
          onChange={(e) => {
            const val = e.target.value as any;
            setEditingVendor(prev => prev ? { ...prev, status: val } : null);
          }}
        >
          <option value="Active">{t("Active")}</option>
          <option value="Under Negotiation">{t("Under Negotiation")}</option>
          <option value="Cancelled">{t("Cancelled")}</option>
        </FormSelect>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect
          label={t("Sales Manager *")}
          value={editingVendor.manager_id || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, manager_id: e.target.value } : null);
            if (fieldErrors.manager_id) setFieldErrors(prev => ({ ...prev, manager_id: '' }));
          }}
          error={fieldErrors.manager_id}
        >
          <option value="" hidden></option>
          {users.filter(u => u.role === 'manager' || u.role === 'admin').map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
          {editingVendor.manager_id && !users.filter(u => u.role === 'manager' || u.role === 'admin').some(u => u.id === editingVendor.manager_id) && (() => {
            const assignedUser = users.find(u => u.id === editingVendor.manager_id);
            return assignedUser ? (
              <option key={assignedUser.id} value={assignedUser.id}>{assignedUser.name} ({assignedUser.role || 'Ad hoc'})</option>
            ) : null;
          })()}
          {users.filter(u => u.role === 'manager' || u.role === 'admin').length === 0 && !editingVendor.manager_id && (
            <option value={currentUser.id}>{currentUser.name} (Ad hoc)</option>
          )}
        </FormSelect>

        <FormSelect
          label={t("Operation Manager *")}
          value={editingVendor.operator_id || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, operator_id: e.target.value } : null);
            if (fieldErrors.operator_id) setFieldErrors(prev => ({ ...prev, operator_id: '' }));
          }}
          error={fieldErrors.operator_id}
        >
          <option value="" hidden></option>
          {users.map(e => (
            <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
          ))}
          {editingVendor.operator_id && !users.some(u => u.id === editingVendor.operator_id) && (() => {
            const assignedUser = users.find(u => u.id === editingVendor.operator_id);
            return assignedUser ? (
              <option key={assignedUser.id} value={assignedUser.id}>{assignedUser.name} ({assignedUser.role || 'Ad hoc'})</option>
            ) : null;
          })()}
        </FormSelect>
      </div>
    </div>
  );
}
