import React from 'react';
import { Vendor, Warehouse, User, City, District } from '../../types';
import { t } from '../../utils/lang';
import { WorkingHoursInput } from './WorkingHoursInput';
import { FormInput, FormSelect } from '../FormInput';
import DynamicCustomFields from '../DynamicCustomFields';

interface VendorFormFieldsProps {
  editingVendor: Vendor;
  setEditingVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  currentUser: User;
}

export default function VendorFormFields({
  editingVendor,
  setEditingVendor,
  fieldErrors,
  setFieldErrors,
  warehouses,
  users,
  cities,
  districts,
  currentUser
}: VendorFormFieldsProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5 text-left">
      <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">{t("Core Parameters")}</span>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("Trade/Commercial Name *")}
          type="text"
          value={editingVendor.trade_name}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, trade_name: e.target.value } : null);
            if (fieldErrors.trade_name) setFieldErrors(prev => ({ ...prev, trade_name: '' }));
          }}
          error={fieldErrors.trade_name}
        />

        <FormInput
          label={t("Legal/Registered Name (Company Name) *")}
          type="text"
          value={editingVendor.company_name}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, company_name: e.target.value } : null);
            if (fieldErrors.company_name) setFieldErrors(prev => ({ ...prev, company_name: '' }));
          }}
          error={fieldErrors.company_name}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("Identification Code *")}
          type="text"
          fontClass="font-mono"
          value={editingVendor.id_code}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, id_code: e.target.value } : null);
            if (fieldErrors.id_code) setFieldErrors(prev => ({ ...prev, id_code: '' }));
          }}
          error={fieldErrors.id_code}
        />

        <FormInput
          label={t("Code *")}
          type="text"
          fontClass="font-mono"
          value={editingVendor.company_code || ''}
          onChange={(e) => setEditingVendor(prev => prev ? { ...prev, company_code: e.target.value } : null)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("Base Price per Litre (₾) *")}
          type="number"
          step="0.01"
          fontClass="font-mono"
          value={editingVendor.price_per_liter || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, price_per_liter: parseFloat(e.target.value) || 0 } : null);
            if (fieldErrors.price_per_liter) setFieldErrors(prev => ({ ...prev, price_per_liter: '' }));
          }}
          error={fieldErrors.price_per_liter}
        />

        <FormSelect
          label={t("Assigned Base Warehouse *")}
          value={editingVendor.warehouse_id || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, warehouse_id: e.target.value } : null);
            if (fieldErrors.warehouse_id) setFieldErrors(prev => ({ ...prev, warehouse_id: '' }));
          }}
          error={fieldErrors.warehouse_id}
        >
          <option value="" hidden></option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </FormSelect>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("IBAN / Bank Account *")}
          type="text"
          fontClass="font-mono"
          value={editingVendor.bank_account}
          maxLength={22}
          onChange={(e) => {
            let clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            let res = '';
            for(let i=0; i<clean.length && i<22; i++) {
              const c = clean[i];
              if (i < 2) {
                if (/[A-Z]/.test(c)) res += c;
              } else if (i < 4) {
                if (/[0-9]/.test(c)) res += c;
              } else if (i < 6) {
                if (/[A-Z]/.test(c)) res += c;
              } else {
                if (/[0-9]/.test(c)) res += c;
              }
            }
            setEditingVendor(prev => prev ? { ...prev, bank_account: res } : null);
            if (fieldErrors.bank_account) setFieldErrors(prev => ({ ...prev, bank_account: '' }));
          }}
          error={fieldErrors.bank_account}
        />

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect
          label={t("City *")}
          value={editingVendor.city || ''}
          onChange={(e) => {
            const val = e.target.value;
            const cObj = cities.find(x => x.name === val);
            const filtered = districts.filter(d => !cObj || d.city_id === cObj.id);
            setEditingVendor(prev => prev ? {
              ...prev,
              city: val,
              district: filtered[0]?.name || ''
            } : null);
            if (fieldErrors.city) setFieldErrors(prev => ({ ...prev, city: '' }));
          }}
          error={fieldErrors.city}
        >
          <option value="" hidden></option>
          {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </FormSelect>

        <FormSelect
          label={t("District *")}
          value={editingVendor.district || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, district: e.target.value } : null);
            if (fieldErrors.district) setFieldErrors(prev => ({ ...prev, district: '' }));
          }}
          error={fieldErrors.district}
        >
          <option value="" hidden></option>
          {districts
            .filter(d => {
              const cObj = cities.find(x => x.name === editingVendor.city);
              return !cObj || d.city_id === cObj.id;
            })
            .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
          }
        </FormSelect>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("Exact Address (Details, Floor, Entry) *")}
          type="text"
          value={editingVendor.address}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, address: e.target.value } : null);
            if (fieldErrors.address) setFieldErrors(prev => ({ ...prev, address: '' }));
          }}
          error={fieldErrors.address}
        />

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

      {/* Dynamic Custom Fields from Columns Manager */}
      <DynamicCustomFields
        storageKey="suppliers_columns_managed"
        data={editingVendor}
        onChange={(updated) => setEditingVendor(updated)}
      />
    </div>
  );
}
