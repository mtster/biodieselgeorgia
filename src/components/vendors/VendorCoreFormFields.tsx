import React from 'react';
import { Vendor, Warehouse } from '../../types';
import { t } from '../../utils/lang';
import { FormInput, FormSelect } from '../FormInput';

interface Props {
  editingVendor: Vendor;
  setEditingVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  warehouses: Warehouse[];
}

export default function VendorCoreFormFields({
  editingVendor,
  setEditingVendor,
  fieldErrors,
  setFieldErrors,
  warehouses
}: Props) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5 text-left">
      <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
        {t("Core Parameters")}
      </span>
      
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
          label={t("Legal/Registered Name (Company Name)")}
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
          label={t("Identification Code")}
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
          label={t("Code")}
          type="text"
          fontClass="font-mono"
          value={editingVendor.company_code || ''}
          onChange={(e) => setEditingVendor(prev => prev ? { ...prev, company_code: e.target.value } : null)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("Base Price per Litre (₾)")}
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
          label={t("IBAN / Bank Account")}
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
      </div>
    </div>
  );
}
