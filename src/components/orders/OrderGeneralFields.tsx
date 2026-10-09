import React from 'react';
import { Order, Vendor, Warehouse, VendorContact } from '../../types';
import SupplierAutocomplete from './SupplierAutocomplete';
import { FormInput, FormSelect } from '../FormInput';
import { t, formatPhone } from '../../utils/lang';

interface OrderGeneralFieldsProps {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  suppliers: Vendor[];
  warehouses: Warehouse[];
  fetchedContacts: VendorContact[];
  vendorSearch: string;
  setVendorSearch: (v: string) => void;
  showVendorSuggestions: boolean;
  setShowVendorSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
}

export const OrderGeneralFields: React.FC<OrderGeneralFieldsProps> = ({
  editingOrder,
  setEditingOrder,
  fieldErrors,
  setFieldErrors,
  suppliers,
  warehouses,
  fetchedContacts,
  vendorSearch,
  setVendorSearch,
  showVendorSuggestions,
  setShowVendorSuggestions
}) => {
  const cleanVendorId = String(editingOrder.vendor_id || '').trim().toLowerCase();
  const selectedSupplier = suppliers.find(s => s.id === editingOrder.vendor_id || (s.id && String(s.id).trim().toLowerCase() === cleanVendorId));
  const contactsList = (fetchedContacts && fetchedContacts.length > 0)
    ? fetchedContacts
    : (selectedSupplier ? (selectedSupplier.contacts || []) : []);

  return (
    <>
      <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
        <span className="text-xs font-black uppercase text-gray-400 tracking-wider block font-sans">
          {t("Core Transaction Details")}
        </span>
      </div>
      
      {/* Supplier Autocomplete Input - Notch styling */}
      <SupplierAutocomplete 
        vendorSearch={vendorSearch}
        setVendorSearch={setVendorSearch}
        showVendorSuggestions={showVendorSuggestions}
        setShowVendorSuggestions={setShowVendorSuggestions}
        setEditingOrder={setEditingOrder}
        fieldErrors={fieldErrors}
        setFieldErrors={setFieldErrors}
        suppliers={suppliers}
        selectedVendorId={editingOrder.vendor_id}
      />
      
      {/* Destination storage dropdown */}
      <FormSelect
        label={`${t("Warehouse")} *`}
        value={editingOrder.warehouse_id || ''}
        onChange={(e) => {
          setEditingOrder(prev => prev ? { ...prev, warehouse_id: e.target.value } : null);
          if (fieldErrors.warehouse_id) setFieldErrors(prev => ({ ...prev, warehouse_id: '' }));
        }}
        error={fieldErrors.warehouse_id}
      >
        <option value="" disabled></option>
        {warehouses.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </FormSelect>

      {/* Contact Dropdown */}
      <div className="space-y-3">
        <FormSelect
          label={`${t("Contact")} *`}
          value={editingOrder.contact_id || ''}
          onChange={(e) => {
            const cid = e.target.value;
            setEditingOrder(prev => prev ? { 
              ...prev, 
              contact_id: cid
            } : null);
            if (fieldErrors.contact_id) setFieldErrors(prev => ({ ...prev, contact_id: '' }));
          }}
          error={fieldErrors.contact_id}
        >
          <option value="" disabled>{t("Select contact...")}</option>
          {contactsList.map(c => {
            const posStr = c.position ? ` - ${t(c.position)}` : '';
            const phoneStr = c.phone ? ` (${formatPhone(c.phone)})` : '';
            return (
              <option key={c.id} value={c.id}>
                {c.name}{posStr}{phoneStr}
              </option>
            );
          })}
        </FormSelect>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Document ID */}
        <FormInput
          label={t("Document Dispatch ID")}
          type="text"
          fontClass="font-mono font-bold"
          value={editingOrder.doc_number || ''}
          onChange={(e) => {
            setEditingOrder(prev => prev ? { ...prev, doc_number: e.target.value } : null);
            if (fieldErrors.doc_number) setFieldErrors(prev => ({ ...prev, doc_number: '' }));
          }}
          error={fieldErrors.doc_number}
        />

        {/* Dispatch Date & Time */}
        <FormInput
          label={t("Order Dispatch Date")}
          type="datetime-local"
          fontClass="font-mono"
          value={
            editingOrder.order_date
              ? (() => {
                  const od = editingOrder.order_date;
                  if (typeof od === 'string' && !od.includes('Z') && !od.includes('+') && !/-\d\d:\d\d$/.test(od)) {
                    return od.includes('T') ? od.substring(0, 16) : `${od.substring(0, 10)}T00:00`;
                  }
                  const d = new Date(od);
                  if (isNaN(d.getTime())) return '';
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  const h = String(d.getHours()).padStart(2, '0');
                  const min = String(d.getMinutes()).padStart(2, '0');
                  return `${y}-${m}-${day}T${h}:${min}`;
                })()
              : ''
          }
          onChange={(e) => {
            const val = e.target.value;
            setEditingOrder(prev => prev ? { ...prev, order_date: val } : null);
          }}
        />
      </div>

      {/* Row 1: Planned (Gegmiuri) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormInput
          label={t("Planned QTY (L)")}
          type="number"
          fontClass="font-mono"
          value={editingOrder.qty_requested === undefined || editingOrder.qty_requested === null ? '' : editingOrder.qty_requested}
          onChange={(e) => {
            const val = e.target.value;
            setEditingOrder(prev => prev ? { ...prev, qty_requested: val === '' ? undefined as any : parseFloat(val) } : null);
          }}
        />

        <FormInput
          label={`${t("Tanks Pickup")} *`}
          type="number"
          fontClass="font-mono"
          value={editingOrder.tanks_to_bring === undefined || editingOrder.tanks_to_bring === null ? '' : editingOrder.tanks_to_bring}
          onChange={(e) => {
            const val = e.target.value;
            setEditingOrder(prev => prev ? { ...prev, tanks_to_bring: val === '' ? undefined as any : parseInt(val, 10) } : null);
            if (fieldErrors.tanks_to_bring) setFieldErrors(prev => ({ ...prev, tanks_to_bring: '' }));
          }}
          error={fieldErrors.tanks_to_bring}
        />

        <FormInput
          label={`${t("Tanks Dropoff")} *`}
          type="number"
          fontClass="font-mono"
          value={editingOrder.tanks_to_leave === undefined || editingOrder.tanks_to_leave === null ? '' : editingOrder.tanks_to_leave}
          onChange={(e) => {
            const val = e.target.value;
            setEditingOrder(prev => prev ? { ...prev, tanks_to_leave: val === '' ? undefined as any : parseInt(val, 10) } : null);
            if (fieldErrors.tanks_to_leave) setFieldErrors(prev => ({ ...prev, tanks_to_leave: '' }));
          }}
          error={fieldErrors.tanks_to_leave}
        />
      </div>
    </>
  );
};
