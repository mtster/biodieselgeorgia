import React from 'react';
import { Vendor, Warehouse, User, City, District } from '../../types';
import { WorkingHoursInput } from './WorkingHoursInput';
import { FormInput, FormSelect } from '../FormInput';

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
      <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Core Supplier Parameters</span>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Trade/Commercial Name *"
          type="text"
          value={editingVendor.trade_name}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, trade_name: e.target.value } : null);
            if (fieldErrors.trade_name) setFieldErrors(prev => ({ ...prev, trade_name: '' }));
          }}
          error={fieldErrors.trade_name}
        />

        <FormInput
          label="Legal/Registered Name (Company Name)"
          type="text"
          value={editingVendor.company_name}
          onChange={(e) => setEditingVendor(prev => prev ? { ...prev, company_name: e.target.value } : null)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Identification Code *"
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
          label="Code Assigned by Us *"
          type="text"
          fontClass="font-mono"
          value={editingVendor.company_code || ''}
          onChange={(e) => setEditingVendor(prev => prev ? { ...prev, company_code: e.target.value } : null)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Base Price per Liter (₾) *"
          type="number"
          step="0.01"
          fontClass="font-mono"
          value={editingVendor.price_per_liter || ''}
          onChange={(e) => setEditingVendor(prev => prev ? { ...prev, price_per_liter: parseFloat(e.target.value) || 0 } : null)}
        />

        <FormSelect
          label="Assigned Base Warehouse *"
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
          label="IBAN / Bank Account"
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
          }}
        />

        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
            Working Hours *
          </span>
          <WorkingHoursInput
            value={editingVendor.working_hours || ''}
            onChange={(val) => setEditingVendor(prev => prev ? { ...prev, working_hours: val } : null)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect
          label="City *"
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
          label="District *"
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

      <FormInput
        label="Exact Address (Details, Floor, Entry)"
        type="text"
        value={editingVendor.address}
        onChange={(e) => setEditingVendor(prev => prev ? { ...prev, address: e.target.value } : null)}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect
          label="Acquisition Manager *"
          value={editingVendor.manager_id || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, manager_id: e.target.value } : null);
            if (fieldErrors.manager_id) setFieldErrors(prev => ({ ...prev, manager_id: '' }));
          }}
          error={fieldErrors.manager_id}
        >
          <option value="" hidden></option>
          {users.filter(u => u.role === 'manager').map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
          {editingVendor.manager_id && !users.filter(u => u.role === 'manager').some(u => u.id === editingVendor.manager_id) && (() => {
            const assignedUser = users.find(u => u.id === editingVendor.manager_id);
            return assignedUser ? (
              <option key={assignedUser.id} value={assignedUser.id}>{assignedUser.name} ({assignedUser.role || 'Ad hoc'})</option>
            ) : null;
          })()}
          {users.filter(u => u.role === 'manager').length === 0 && !editingVendor.manager_id && (
            <option value={currentUser.id}>{currentUser.name} (Ad hoc)</option>
          )}
        </FormSelect>

        <FormSelect
          label="Systems Dispatcher *"
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
