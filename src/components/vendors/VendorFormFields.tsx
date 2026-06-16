import React from 'react';
import { Vendor, Warehouse, User, City, District } from '../../types';
import { WorkingHoursInput } from './WorkingHoursInput';

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
    <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
      <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Core Supplier Parameters</span>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.trade_name ? 'text-red-500' : 'text-gray-400'}`}>
            Trade/Commercial Name *
          </span>
          <input 
            type="text"
            value={editingVendor.trade_name}
            onChange={(e) => {
              setEditingVendor(prev => prev ? { ...prev, trade_name: e.target.value } : null);
              if (fieldErrors.trade_name) setFieldErrors(prev => ({ ...prev, trade_name: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans transition-all ${
              fieldErrors.trade_name 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          />
          {fieldErrors.trade_name && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.trade_name}
            </p>
          )}
        </div>

        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
            Legal/Registered Name (Company Name)
          </span>
          <input 
            type="text"
            value={editingVendor.company_name}
            onChange={(e) => setEditingVendor(prev => prev ? { ...prev, company_name: e.target.value } : null)}
            className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.id_code ? 'text-red-500' : 'text-gray-400'}`}>
            Identification Code *
          </span>
          <input 
            type="text"
            value={editingVendor.id_code}
            onChange={(e) => {
              setEditingVendor(prev => prev ? { ...prev, id_code: e.target.value } : null);
              if (fieldErrors.id_code) setFieldErrors(prev => ({ ...prev, id_code: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-mono transition-all ${
              fieldErrors.id_code 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-955' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          />
          {fieldErrors.id_code && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.id_code}
            </p>
          )}
        </div>

        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
            Code Assigned by Us *
          </span>
          <input 
            type="text"
            value={editingVendor.company_code || ''}
            onChange={(e) => setEditingVendor(prev => prev ? { ...prev, company_code: e.target.value } : null)}
            className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
            Base Price per Liter (₾) *
          </span>
          <input 
            type="number"
            step="0.01"
            value={editingVendor.price_per_liter || ''}
            onChange={(e) => setEditingVendor(prev => prev ? { ...prev, price_per_liter: parseFloat(e.target.value) || 0 } : null)}
            className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
          />
        </div>

        <div className="relative">
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.warehouse_id ? 'text-red-500' : 'text-gray-400'}`}>
            Assigned Base Warehouse *
          </span>
          <select
            value={editingVendor.warehouse_id || ''}
            onChange={(e) => {
              setEditingVendor(prev => prev ? { ...prev, warehouse_id: e.target.value } : null);
              if (fieldErrors.warehouse_id) setFieldErrors(prev => ({ ...prev, warehouse_id: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
              fieldErrors.warehouse_id 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          >
            <option value="" hidden></option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {fieldErrors.warehouse_id && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.warehouse_id}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
            IBAN / Bank Account
          </span>
          <input 
            type="text"
            value={editingVendor.bank_account}
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
            maxLength={22}
            className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
          />
        </div>

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
        <div className="relative">
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.city ? 'text-red-500' : 'text-gray-400'}`}>
            City *
          </span>
          <select
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
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
              fieldErrors.city 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          >
            <option value="" hidden></option>
            {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          {fieldErrors.city && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.city}
            </p>
          )}
        </div>

        <div className="relative">
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.district ? 'text-red-500' : 'text-gray-400'}`}>
            District *
          </span>
          <select
            value={editingVendor.district || ''}
            onChange={(e) => {
              setEditingVendor(prev => prev ? { ...prev, district: e.target.value } : null);
              if (fieldErrors.district) setFieldErrors(prev => ({ ...prev, district: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
              fieldErrors.district 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          >
            <option value="" hidden></option>
            {districts
              .filter(d => {
                const cObj = cities.find(x => x.name === editingVendor.city);
                return !cObj || d.city_id === cObj.id;
              })
              .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
            }
          </select>
          {fieldErrors.district && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.district}
            </p>
          )}
        </div>
      </div>

      <div className="relative">
        <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
          Exact Address (Details, Floor, Entry)
        </span>
        <input 
          type="text"
          value={editingVendor.address}
          onChange={(e) => setEditingVendor(prev => prev ? { ...prev, address: e.target.value } : null)}
          className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.manager_id ? 'text-red-500' : 'text-gray-400'}`}>
            Acquisition Manager *
          </span>
          <select
            value={editingVendor.manager_id || ''}
            onChange={(e) => {
              setEditingVendor(prev => prev ? { ...prev, manager_id: e.target.value } : null);
              if (fieldErrors.manager_id) setFieldErrors(prev => ({ ...prev, manager_id: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
              fieldErrors.manager_id 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
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
          </select>
          {fieldErrors.manager_id && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.manager_id}
            </p>
          )}
        </div>

        <div className="relative">
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.operator_id ? 'text-red-500' : 'text-gray-400'}`}>
            Systems Dispatcher *
          </span>
          <select
            value={editingVendor.operator_id || ''}
            onChange={(e) => {
              setEditingVendor(prev => prev ? { ...prev, operator_id: e.target.value } : null);
              if (fieldErrors.operator_id) setFieldErrors(prev => ({ ...prev, operator_id: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
              fieldErrors.operator_id 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
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
          </select>
          {fieldErrors.operator_id && (
            <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.operator_id}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
