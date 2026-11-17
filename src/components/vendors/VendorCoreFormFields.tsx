import React, { useState, useEffect } from 'react';
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
  const [priceInput, setPriceInput] = useState<string>(() => {
    const val = editingVendor.price_per_liter;
    return val !== undefined && val !== null && val !== 0 ? String(val) : '';
  });

  useEffect(() => {
    const numVal = Number(editingVendor.price_per_liter || 0);
    const parsedLocal = parseFloat(priceInput);
    const localNum = isNaN(parsedLocal) ? 0 : parsedLocal;
    if (localNum !== numVal) {
      setPriceInput(numVal === 0 ? '' : String(numVal));
    }
  }, [editingVendor.id, editingVendor.price_per_liter]);
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
          label="კოდი * (უნიკალური)"
          type="text"
          fontClass="font-mono"
          value={editingVendor.company_code || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, company_code: e.target.value } : null);
            if (fieldErrors.company_code) setFieldErrors(prev => ({ ...prev, company_code: '' }));
          }}
          error={fieldErrors.company_code}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("Base Price per Litre (₾)")}
          type="text"
          inputMode="decimal"
          fontClass="font-mono"
          value={priceInput}
          onChange={(e) => {
            const normalized = e.target.value.replace(',', '.');
            if (normalized === '' || /^\d*\.?\d*$/.test(normalized)) {
              setPriceInput(normalized);
              const parsed = parseFloat(normalized);
              setEditingVendor(prev => prev ? { ...prev, price_per_liter: isNaN(parsed) ? 0 : parsed } : null);
              if (fieldErrors.price_per_liter) setFieldErrors(prev => ({ ...prev, price_per_liter: '' }));
            }
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

        <FormInput
          label={t("Email")}
          type="email"
          value={editingVendor.email || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, email: e.target.value } : null);
            if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
          }}
          error={fieldErrors.email}
        />
      </div>
    </div>
  );
}
