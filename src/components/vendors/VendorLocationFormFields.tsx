import React from 'react';
import { Vendor, City, District, Direction } from '../../types';
import { t } from '../../utils/lang';
import { FormInput, FormSelect } from '../FormInput';

interface Props {
  editingVendor: Vendor;
  setEditingVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  cities: City[];
  districts: District[];
  directions: Direction[];
}

export default function VendorLocationFormFields({
  editingVendor,
  setEditingVendor,
  fieldErrors,
  setFieldErrors,
  cities,
  districts,
  directions
}: Props) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5 text-left">
      <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
        {t("Location Parameters")}
      </span>

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
          label={t("mimartuleba *")}
          value={editingVendor.direction_id || ''}
          onChange={(e) => {
            setEditingVendor(prev => prev ? { ...prev, direction_id: e.target.value } : null);
            if (fieldErrors.direction_id) setFieldErrors(prev => ({ ...prev, direction_id: '' }));
          }}
          error={fieldErrors.direction_id}
        >
          <option value="" hidden></option>
          {directions.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </FormSelect>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label={t("overdue_threshold_days")}
          type="text"
          placeholder="მაგ: 14"
          value={editingVendor.overdue_threshold_days !== undefined && editingVendor.overdue_threshold_days !== null ? String(editingVendor.overdue_threshold_days) : ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') {
              setEditingVendor(prev => prev ? { ...prev, overdue_threshold_days: null } : null);
            } else {
              const parsed = parseInt(val, 10);
              if (!isNaN(parsed)) {
                setEditingVendor(prev => prev ? { ...prev, overdue_threshold_days: parsed } : null);
              }
            }
          }}
        />
      </div>
    </div>
  );
}
