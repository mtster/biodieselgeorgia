import React from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../../types';
import { ShieldAlert, Phone } from 'lucide-react';
import SupplierAutocomplete from './SupplierAutocomplete';
import { FormInput, FormSelect } from '../FormInput';
import FulfillmentDateTimePicker from './FulfillmentDateTimePicker';
import DynamicCustomFields from '../DynamicCustomFields';
import { t } from '../../utils/lang';

interface OrderFormFieldsProps {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  vendorSearch: string;
  setVendorSearch: (v: string) => void;
  showVendorSuggestions: boolean;
  setShowVendorSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function OrderFormFields({
  editingOrder,
  setEditingOrder,
  fieldErrors,
  setFieldErrors,
  suppliers,
  warehouses,
  employees,
  trucks,
  vendorSearch,
  setVendorSearch,
  showVendorSuggestions,
  setShowVendorSuggestions
}: OrderFormFieldsProps) {

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
        <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">{t("Core Transaction Details")}</span>
        
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
        />
        
        {/* Destination storage dropdown */}
        <FormSelect
          label={`${t("Warehouse")} *`}
          value={editingOrder.warehouse_id}
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

        {/* Contact Dropdown & Contact Card details */}
        {(() => {
          const selectedSupplier = suppliers.find(s => s.id === editingOrder.vendor_id);
          const contactsList = selectedSupplier ? (selectedSupplier.contacts || []) : [];
          const selectedContact = contactsList.find(c => c.id === editingOrder.contact_id);

          return (
            <div className="space-y-3">
              <FormSelect
                label={`${t("Contact")} *`}
                value={editingOrder.contact_id || ''}
                onChange={(e) => {
                  const cid = e.target.value;
                  const cont = contactsList.find(c => c.id === cid);
                  setEditingOrder(prev => prev ? { 
                    ...prev, 
                    contact_id: cid,
                    contact_name: cont?.name || '',
                    contact_phone: cont?.phone || ''
                  } : null);
                  if (fieldErrors.contact_id) setFieldErrors(prev => ({ ...prev, contact_id: '' }));
                }}
                error={fieldErrors.contact_id}
              >
                <option value="" disabled>{t("Select contact...")}</option>
                {contactsList.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} - {t(c.position)} ({c.phone})
                  </option>
                ))}
              </FormSelect>
            </div>
          );
        })()}

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

          {/* Dispatch Date using software native date picker */}
          <FormInput
            label={t("Order Dispatch Date")}
            type="date"
            fontClass="font-mono font-bold"
            value={editingOrder.order_date ? editingOrder.order_date.substring(0, 10) : ''}
            onChange={(e) => {
              const val = e.target.value; // YYYY-MM-DD
              setEditingOrder(prev => prev ? { ...prev, order_date: val } : null);
            }}
          />
        </div>

        {/* Row 1: Planned (Gegmiuri) - wamogeba then datoveba */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Planned Volume */}
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

          {/* Tanks Pickup */}
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

          {/* Tanks Dropoff */}
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

        {/* Row 2: Factual (Faqtobrivi) - non-mandatory, wamogeba then datoveba */}
        <div className="space-y-4 animate-in slide-in-from-top-3 duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput
              label={t("Fact QTY (L)")}
              type="number"
              step="0.01"
              fontClass="font-mono font-bold"
              value={editingOrder.fact_qty === undefined || editingOrder.fact_qty === null ? '' : editingOrder.fact_qty}
              onChange={(e) => {
                setEditingOrder(prev => prev ? { ...prev, fact_qty: e.target.value === '' ? undefined : parseFloat(e.target.value) } : null);
                if (fieldErrors.fact_qty) setFieldErrors(prev => ({ ...prev, fact_qty: '' }));
              }}
              error={fieldErrors.fact_qty}
            />

            <FormInput
              label={t("Fact Tank Pickup")}
              type="number"
              fontClass="font-mono"
              value={editingOrder.fact_tank_pickup === undefined || editingOrder.fact_tank_pickup === null ? '' : editingOrder.fact_tank_pickup}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, fact_tank_pickup: e.target.value === '' ? undefined : parseInt(e.target.value, 10) } : null)}
            />

            <FormInput
              label={t("Fact Tank Dropoff")}
              type="number"
              fontClass="font-mono"
              value={editingOrder.fact_tank_dropoff === undefined || editingOrder.fact_tank_dropoff === null ? '' : editingOrder.fact_tank_dropoff}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, fact_tank_dropoff: e.target.value === '' ? undefined : parseInt(e.target.value, 10) } : null)}
            />
          </div>

          <div>
            <FormInput
              label={t("zednadebit raodenoba")}
              type="number"
              step="0.01"
              fontClass="font-mono"
              value={editingOrder.waybill_qty === undefined || editingOrder.waybill_qty === null ? '' : editingOrder.waybill_qty}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, waybill_qty: e.target.value === '' ? undefined : parseFloat(e.target.value) } : null)}
            />
          </div>

          {/* Status Selector moved below zednadebit raodenoba */}
          <FormSelect
            label={`${t("Fulfillment Status")} *`}
            value={editingOrder.status}
            className="bg-emerald-50 text-emerald-800 font-bold"
            onChange={(e) => {
              const statusVal = e.target.value as OrderStatus;
              setEditingOrder(prev => prev ? {
                ...prev,
                status: statusVal,
                pickup_date_time: statusVal === 'completed' ? new Date().toISOString() : undefined
              } : null);
            }}
          >
            <option value="registered">{t("Registered")}</option>
            <option value="driver_assigned">{t("Driver Assigned")}</option>
            <option value="picked_up">{t("Picked Up")}</option>
            <option value="completed">{t("Completed")}</option>
            <option value="cancelled">{t("Cancelled")}</option>
          </FormSelect>
        </div>

        {/* Dynamic Custom Fields from Columns Manager */}
        <DynamicCustomFields
          storageKey="orders_columns_managed"
          data={editingOrder}
          onChange={(updated) => setEditingOrder(updated)}
        />

        {/* Handover comments */}
        <FormInput
          label={t("Handover Comments / Navigation Note on Location")}
          type="text"
          value={editingOrder.note || ''}
          onChange={(e) => setEditingOrder(prev => prev ? { ...prev, note: e.target.value } : null)}
        />
      </div>

      {/* Crew and Fleet Dispatch Assignments */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5 pb-16">
        <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">{t("Operations Vehicle Crew")}</span>
        
        {/* Truck asset */}
        <FormSelect
          label={t("Assigned Vehicle Plate Asset")}
          value={editingOrder.truck_plate}
          onChange={(e) => {
            const plate = e.target.value;
            const truck = trucks.find(t => t.plate_number === plate);
            setEditingOrder(prev => {
              if (!prev) return null;
              return {
                ...prev,
                truck_plate: plate,
                ...(truck ? {
                  driver_id: truck.driver_id || prev.driver_id,
                  companion_id: truck.companion_id || prev.companion_id
                } : {})
              };
            });
            if (fieldErrors.truck_plate) setFieldErrors(prev => ({ ...prev, truck_plate: '' }));
            if (truck && truck.driver_id) {
              if (fieldErrors.driver_id) setFieldErrors(prev => ({ ...prev, driver_id: '' }));
            }
          }}
          error={fieldErrors.truck_plate}
        >
          <option value="" disabled></option>
          {trucks.map(t => (
            <option key={t.plate_number} value={t.plate_number}>{t.plate_number} ({t.model})</option>
          ))}
        </FormSelect>

        {/* Driver select */}
        <FormSelect
          label={t("Assigned Fleet Driver")}
          value={editingOrder.driver_id}
          onChange={(e) => {
            setEditingOrder(prev => prev ? { ...prev, driver_id: e.target.value } : null);
            if (fieldErrors.driver_id) setFieldErrors(prev => ({ ...prev, driver_id: '' }));
          }}
          error={fieldErrors.driver_id}
        >
          <option value="" disabled></option>
          {employees.filter(e => e.role === 'driver').map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </FormSelect>

        {/* Co-Driver helper select */}
        <FormSelect
          label={t("Assistant")}
          value={editingOrder.companion_id}
          onChange={(e) => setEditingOrder(prev => prev ? { ...prev, companion_id: e.target.value } : null)}
        >
          <option value=""></option>
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
          ))}
        </FormSelect>
      </div>
    </div>
  );
}
