import React from 'react';
import { Order, OrderStatus } from '../../types';
import { FormInput, FormSelect } from '../FormInput';
import { t, formatOrderCompletionTime } from '../../utils/lang';

interface OrderFulfillmentFieldsProps {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const OrderFulfillmentFields: React.FC<OrderFulfillmentFieldsProps> = ({
  editingOrder,
  setEditingOrder,
  fieldErrors,
  setFieldErrors
}) => {
  return (
    <div className="space-y-4 animate-in slide-in-from-top-3 duration-150">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormInput
          label={t("Fact QTY (L)")}
          type="number"
          step="0.01"
          fontClass="font-mono"
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

      {/* Status Selector and Auto Completion Time */}
      <div className={`grid ${editingOrder.status === 'completed' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
        <FormSelect
          label={`${t("Fulfillment Status")} *`}
          value={editingOrder.status || 'registered'}
          className="bg-emerald-50 text-emerald-800 font-bold"
          onChange={(e) => {
            const statusVal = e.target.value as OrderStatus;
            setEditingOrder(prev => {
              if (!prev) return null;
              const isCompletedNow = statusVal === 'completed';
              const nowIso = new Date().toISOString();
              return {
                ...prev,
                status: statusVal,
                pickup_date_time: isCompletedNow ? (prev.pickup_date_time || nowIso) : undefined,
                completed_at: isCompletedNow ? (prev.completed_at || nowIso) : null
              };
            });
          }}
        >
          <option value="registered">{t("Registered")}</option>
          <option value="driver_assigned">{t("Driver Assigned")}</option>
          <option value="completed">{t("Completed")}</option>
          <option value="uncompleted">{t("uncompleted")}</option>
          <option value="cancelled">{t("cancelled")}</option>
        </FormSelect>

        {editingOrder.status === 'completed' && (
          <FormInput
            label="დასრულების დრო"
            type="text"
            readOnly
            disabled
            fontClass="font-mono"
            value={formatOrderCompletionTime(editingOrder.completed_at || new Date().toISOString())}
            className="bg-gray-50 text-gray-700 cursor-not-allowed select-none"
          />
        )}
      </div>
    </div>
  );
};
