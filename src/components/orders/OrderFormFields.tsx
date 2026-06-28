import React from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../../types';
import { ShieldAlert } from 'lucide-react';
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Document ID */}
          <FormInput
            label={`${t("Document Dispatch ID")} *`}
            type="text"
            fontClass="font-mono font-bold"
            value={editingOrder.doc_number}
            onChange={(e) => {
              setEditingOrder(prev => prev ? { ...prev, doc_number: e.target.value } : null);
              if (fieldErrors.doc_number) setFieldErrors(prev => ({ ...prev, doc_number: '' }));
            }}
            error={fieldErrors.doc_number}
          />

          {/* Dispatch Date */}
          <FormInput
            label={`${t("Order Dispatch Date")} *`}
            type="date"
            fontClass="font-mono"
            value={editingOrder.order_date}
            onChange={(e) => setEditingOrder(prev => prev ? { ...prev, order_date: e.target.value } : null)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Planned Volume */}
          <FormInput
            label={t("Planned QTY (L)")}
            type="number"
            fontClass="font-mono"
            value={editingOrder.qty_requested || ''}
            onChange={(e) => setEditingOrder(prev => prev ? { ...prev, qty_requested: parseFloat(e.target.value) || 0 } : null)}
          />

          {/* Tanks dropoff */}
          <FormInput
            label={t("Tanks Dropoff")}
            type="number"
            fontClass="font-mono"
            value={editingOrder.tanks_to_leave}
            onChange={(e) => setEditingOrder(prev => prev ? { ...prev, tanks_to_leave: parseInt(e.target.value) || 0 } : null)}
          />

          {/* Tanks pickup */}
          <FormInput
            label={t("Tanks Pickup")}
            type="number"
            fontClass="font-mono"
            value={editingOrder.tanks_to_bring}
            onChange={(e) => setEditingOrder(prev => prev ? { ...prev, tanks_to_bring: parseInt(e.target.value) || 0 } : null)}
          />
        </div>

        {/* Status Selector */}
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

        {/* Fact & Volumetric Parameters (Always visible regardless of status) */}
        <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-3 duration-150">
          <span className="text-xs font-black uppercase text-emerald-850 tracking-wider block border-b border-gray-100 pb-2">
            {t("Factual Details")} {editingOrder.status === 'completed' && " *"}
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormInput
              label={`${t("Fact QTY (L)")}${editingOrder.status === 'completed' ? ' *' : ''}`}
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
              label={t("Fact Tank Dropoff")}
              type="number"
              fontClass="font-mono"
              value={editingOrder.fact_tank_dropoff === undefined || editingOrder.fact_tank_dropoff === null ? '' : editingOrder.fact_tank_dropoff}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, fact_tank_dropoff: e.target.value === '' ? undefined : parseInt(e.target.value, 10) } : null)}
            />

            <FormInput
              label={t("Fact Tank Pickup")}
              type="number"
              fontClass="font-mono"
              value={editingOrder.fact_tank_pickup === undefined || editingOrder.fact_tank_pickup === null ? '' : editingOrder.fact_tank_pickup}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, fact_tank_pickup: e.target.value === '' ? undefined : parseInt(e.target.value, 10) } : null)}
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <FormInput
              label={t("zednadebit raodenoba")}
              type="number"
              step="0.01"
              fontClass="font-mono"
              value={editingOrder.waybill_qty === undefined || editingOrder.waybill_qty === null ? '' : editingOrder.waybill_qty}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, waybill_qty: e.target.value === '' ? undefined : parseFloat(e.target.value) } : null)}
            />
          </div>
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
          label={`${t("Assigned Vehicle Plate Asset")} *`}
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
          label={`${t("Assigned Fleet Driver")} *`}
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
