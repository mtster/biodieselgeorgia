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

export function getGeorgianRoleName(role: string | undefined | null): string {
  if (!role) return '';
  const r = role.toLowerCase().trim();
  if (r === 'admin' || r === 'administrator' || r.includes('ადმინ')) {
    return 'ადმინი';
  }
  if (r === 'manager' || r === 'purchasing_group_leader' || r === 'purchasing_leader' || r.includes('ხელმძღვანელი')) {
    return 'შესყიდვების ჯგუფის ხელმძღვანელი';
  }
  if (r === 'assistant' || r === 'purchasing_manager' || r.includes('შესყიდვების მენეჯერი') || r.includes('შესყიდვების მენეჯ')) {
    return 'შესყიდვების მენეჯერი';
  }
  if (r === 'vendor' || r === 'operator' || r.includes('ოპერატორ')) {
    return 'ოპერატორი';
  }
  if (r === 'warehouse_manager' || r === 'logistics_manager' || r.includes('ლოჯისტიკის მენეჯერი')) {
    return 'ლოჯისტიკის მენეჯერი';
  }
  if (r === 'driver' || r === 'logistician_driver' || r.includes('მძღოლი') || r.includes('ლოჯისტი/მძღოლი')) {
    return 'ლოჯისტი/მძღოლი';
  }
  return role;
}

export default function VendorManagementFormFields({
  editingVendor,
  setEditingVendor,
  fieldErrors,
  setFieldErrors,
  users,
  currentUser
}: Props) {
  const isSalesManagerCandidate = (u: User) => {
    const geo = getGeorgianRoleName(u.role);
    return geo === 'ადმინი' || geo === 'შესყიდვების ჯგუფის ხელმძღვანელი' || geo === 'შესყიდვების მენეჯერი';
  };

  const salesManagerCandidates = users.filter(isSalesManagerCandidate);
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5 text-left">
      <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
        {t("Management & Operations")}
      </span>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
            {t("Working Hours")}
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
          label={t("Supplier / Vendor Status")}
          value={editingVendor.status || 'Active'}
          onChange={(e) => {
            const val = e.target.value as any;
            setEditingVendor(prev => prev ? { ...prev, status: val } : null);
          }}
        >
          <option value="Active">{t("Active")}</option>
          <option value="Under Negotiation">{t("Under Negotiation")}</option>
          <option value="Seasonal">{t("Seasonal")}</option>
          <option value="Closed">{t("Closed")}</option>
          <option value="Unclear">{t("Unclear")}</option>
        </FormSelect>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect
          label={t("Sales Manager")}
          value={editingVendor.manager_id || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, manager_id: e.target.value } : null);
            if (fieldErrors.manager_id) setFieldErrors(prev => ({ ...prev, manager_id: '' }));
          }}
          error={fieldErrors.manager_id}
        >
          <option value="" hidden></option>
          {salesManagerCandidates.map(e => {
            const roleGeo = getGeorgianRoleName(e.role);
            return (
              <option key={e.id} value={e.id}>{e.name} ({roleGeo})</option>
            );
          })}
          {editingVendor.manager_id && !salesManagerCandidates.some(u => u.id === editingVendor.manager_id) && (() => {
            const assignedUser = users.find(u => u.id === editingVendor.manager_id);
            return assignedUser ? (
              <option key={assignedUser.id} value={assignedUser.id}>{assignedUser.name} ({getGeorgianRoleName(assignedUser.role) || 'Ad hoc'})</option>
            ) : null;
          })()}
          {salesManagerCandidates.length === 0 && !editingVendor.manager_id && (
            <option value={currentUser.id}>{currentUser.name} (Ad hoc)</option>
          )}
        </FormSelect>

        <FormSelect
          label={t("Operation Manager")}
          value={editingVendor.operator_id || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, operator_id: e.target.value } : null);
            if (fieldErrors.operator_id) setFieldErrors(prev => ({ ...prev, operator_id: '' }));
          }}
          error={fieldErrors.operator_id}
        >
          <option value="" hidden></option>
          {users.map(e => {
            const roleGeo = getGeorgianRoleName(e.role);
            return (
              <option key={e.id} value={e.id}>{e.name} ({roleGeo})</option>
            );
          })}
          {editingVendor.operator_id && !users.some(u => u.id === editingVendor.operator_id) && (() => {
            const assignedUser = users.find(u => u.id === editingVendor.operator_id);
            return assignedUser ? (
              <option key={assignedUser.id} value={assignedUser.id}>{assignedUser.name} ({getGeorgianRoleName(assignedUser.role) || 'Ad hoc'})</option>
            ) : null;
          })()}
        </FormSelect>
      </div>

      {/* Automated / Scheduled Order Section */}
      <div className="border-t border-gray-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div 
          className="flex items-center justify-between bg-gray-50 px-3.5 py-4 md:py-3 border border-transparent rounded-xl cursor-pointer hover:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all"
          onClick={() => {
            const checked = !editingVendor.is_planned;
            setEditingVendor(prev => prev ? { 
              ...prev, 
              is_planned: checked,
              planned_weekday: checked ? (prev.planned_weekday || 'monday') : null 
            } : null);
          }}
        >
          <span className="text-xs font-bold uppercase text-gray-500 tracking-wider select-none">
            {t("gegmiuri")}
          </span>
          <div 
            className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${editingVendor.is_planned ? 'bg-emerald-600' : 'bg-gray-200'}`}
          >
            <div 
              className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${editingVendor.is_planned ? 'translate-x-3.5' : 'translate-x-0'}`} 
            />
          </div>
        </div>

        {editingVendor.is_planned && (
          <FormSelect
            label={t("Day of the week")}
            value={editingVendor.planned_weekday || 'monday'}
            onChange={(e) => {
              const val = e.target.value;
              setEditingVendor(prev => prev ? { ...prev, planned_weekday: val } : null);
            }}
          >
            <option value="monday">{t("monday")}</option>
            <option value="tuesday">{t("tuesday")}</option>
            <option value="wednesday">{t("wednesday")}</option>
            <option value="thursday">{t("thursday")}</option>
            <option value="friday">{t("friday")}</option>
            <option value="saturday">{t("saturday")}</option>
            <option value="sunday">{t("sunday")}</option>
          </FormSelect>
        )}
      </div>
    </div>
  );
}
