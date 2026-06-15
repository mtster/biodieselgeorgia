import React from 'react';
import { Vendor, Order } from '../../types';

interface Props {
  vendorSearch: string;
  setVendorSearch: React.Dispatch<React.SetStateAction<string>>;
  showVendorSuggestions: boolean;
  setShowVendorSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  suppliers: Vendor[];
}

export default function SupplierAutocomplete({
  vendorSearch,
  setVendorSearch,
  showVendorSuggestions,
  setShowVendorSuggestions,
  setEditingOrder,
  fieldErrors,
  setFieldErrors,
  suppliers
}: Props) {
  return (
    <div className="relative" id="vendor-autocomplete-container">
      <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.vendor_id ? 'text-red-500' : 'text-gray-400'}`}>
        Supplier / Vendor Restaurant *
      </span>
      <input
        type="text"
        placeholder=""
        value={vendorSearch}
        onChange={(e) => {
          setVendorSearch(e.target.value);
          setShowVendorSuggestions(true);
          if (e.target.value === '') {
            setEditingOrder(prev => prev ? { ...prev, vendor_id: '' } : null);
          }
          if (fieldErrors.vendor_id) setFieldErrors(prev => ({ ...prev, vendor_id: '' }));
        }}
        onFocus={() => setShowVendorSuggestions(true)}
        className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans relative ${
          fieldErrors.vendor_id 
            ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
            : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
        }`}
      />
      {fieldErrors.vendor_id && (
        <p className="text-[10px] text-red-650 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
          {fieldErrors.vendor_id}
        </p>
      )}
      
      {showVendorSuggestions && (
        <>
          <div 
            className="fixed inset-0 z-20" 
            onClick={() => setShowVendorSuggestions(false)} 
          />
          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-30 divide-y divide-gray-50">
            {suppliers
              .filter(s => {
                const searchStr = vendorSearch.toLowerCase();
                return s.trade_name.toLowerCase().includes(searchStr) || 
                       s.company_name.toLowerCase().includes(searchStr) || 
                       s.id_code.toLowerCase().includes(searchStr);
              })
              .map(s => (
                <div
                  key={s.id}
                  onClick={() => {
                    setEditingOrder(prev => prev ? { ...prev, vendor_id: s.id } : null);
                    setVendorSearch(s.trade_name);
                    setShowVendorSuggestions(false);
                  }}
                  className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer text-left transition duration-100"
                >
                  <p className="text-xs font-bold text-gray-800">{s.trade_name}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.company_name} (ID: {s.id_code})</p>
                </div>
              ))
            }
            {suppliers.filter(s => {
              const searchStr = vendorSearch.toLowerCase();
              return s.trade_name.toLowerCase().includes(searchStr) || 
                     s.company_name.toLowerCase().includes(searchStr) || 
                     s.id_code.toLowerCase().includes(searchStr);
            }).length === 0 && (
              <div className="px-3.5 py-3 text-xs text-gray-400 italic">No suppliers found matching "{vendorSearch}"</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
