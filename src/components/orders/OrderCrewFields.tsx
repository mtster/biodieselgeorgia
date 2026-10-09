import React from 'react';
import { Order, Truck, User } from '../../types';
import { FormSelect } from '../FormInput';
import { t } from '../../utils/lang';

interface OrderCrewFieldsProps {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  trucks: Truck[];
  employees: User[];
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const OrderCrewFields: React.FC<OrderCrewFieldsProps> = ({
  editingOrder,
  setEditingOrder,
  trucks,
  employees,
  fieldErrors,
  setFieldErrors
}) => {
  const currentVehicleValue = editingOrder.vehicle_id || trucks.find(t => t.plate_number === editingOrder.truck_plate)?.id || '';

  const handleVehicleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
    if (!selectedVal) {
      // Cleared vehicle -> clear vehicle, plate, driver, assistant
      setEditingOrder(prev => {
        if (!prev) return null;
        return {
          ...prev,
          vehicle_id: '',
          truck_plate: '',
          driver_id: '',
          companion_id: ''
        };
      });
      return;
    }

    const truck = trucks.find(t => t.id === selectedVal || t.plate_number === selectedVal);
    setEditingOrder(prev => {
      if (!prev) return null;
      return {
        ...prev,
        vehicle_id: truck?.id || selectedVal,
        truck_plate: truck?.plate_number || '',
        // If the newly selected vehicle has driver assigned, fill it; otherwise explicitly clear it
        driver_id: (truck?.driver_id && String(truck.driver_id).trim()) || '',
        // If the newly selected vehicle has companion assigned, fill it; otherwise explicitly clear it
        companion_id: (truck?.companion_id && String(truck.companion_id).trim()) || ''
      };
    });

    if (fieldErrors.truck_plate) setFieldErrors(prev => ({ ...prev, truck_plate: '' }));
    if (fieldErrors.driver_id && truck?.driver_id) {
      setFieldErrors(prev => ({ ...prev, driver_id: '' }));
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
      <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
        {t("Operations Vehicle Crew")}
      </span>
      
      {/* Truck asset */}
      <FormSelect
        label={t("Assigned Vehicle Plate Asset")}
        value={currentVehicleValue}
        onChange={handleVehicleChange}
        error={fieldErrors.truck_plate}
      >
        <option value="">{t("Select Vehicle") || "აირჩიეთ ავტომობილი"}</option>
        {trucks.map(t => (
          <option key={t.id || t.plate_number} value={t.id || t.plate_number}>
            {t.plate_number} ({t.model})
          </option>
        ))}
      </FormSelect>

      {/* Driver select */}
      <FormSelect
        label={t("Assigned Fleet Driver")}
        value={editingOrder.driver_id || ''}
        onChange={(e) => {
          setEditingOrder(prev => prev ? { ...prev, driver_id: e.target.value } : null);
          if (fieldErrors.driver_id) setFieldErrors(prev => ({ ...prev, driver_id: '' }));
        }}
        error={fieldErrors.driver_id}
      >
        <option value="">{t("Select Driver") || "აირჩიეთ მძღოლი"}</option>
        {employees.filter(e => !e.is_deleted && !e.is_blocked && e.role === 'driver').map(e => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </FormSelect>

      {/* Co-Driver helper select */}
      <FormSelect
        label={t("Assistant")}
        value={editingOrder.companion_id || ''}
        onChange={(e) => setEditingOrder(prev => prev ? { ...prev, companion_id: e.target.value } : null)}
      >
        <option value="">{t("Select Assistant") || "აირჩიეთ დამხმარე"}</option>
        {employees.filter(e => !e.is_deleted && !e.is_blocked && (e.role === 'driver_assistant' || e.role === 'driver')).map(e => (
          <option key={e.id} value={e.id}>
            {e.name} ({t(e.role)})
          </option>
        ))}
      </FormSelect>
    </div>
  );
};
