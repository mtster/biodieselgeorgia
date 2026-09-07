import React, { useState, useEffect } from 'react';
import { Truck, User, Order, Vendor, Warehouse } from '../../types';
import { FormSelect } from '../FormInput';
import FormModal from '../FormModal';
import { t } from '../../utils/lang';

interface AssignDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (driverId: string, companionId: string, truckPlate: string) => void;
  orders: Order[];
  employees: User[];
  trucks: Truck[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
}

export default function AssignDriverModal({
  isOpen,
  onClose,
  onSave,
  orders,
  employees,
  trucks,
  suppliers,
  warehouses
}: AssignDriverModalProps) {
  const [selectedTruckPlate, setSelectedTruckPlate] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedCompanionId, setSelectedCompanionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Identify relevant warehouses for selected orders to prioritize drivers if needed
  const vendorIds = Array.from(new Set(orders.map(o => o.vendor_id)));
  const relevantWarehouseIds = Array.from(new Set(
    suppliers
      .filter(s => vendorIds.includes(s.id))
      .map(s => s.warehouse_id)
      .filter(Boolean) as string[]
  ));

  // Available drivers & companions
  const drivers = employees.filter(e => e.role === 'driver');
  const companions = employees;

  // Reset or prefill when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      // If all selected orders share the same vehicle/driver, prefill
      if (orders.length > 0) {
        const firstOrder = orders[0];
        const samePlate = orders.every(o => o.truck_plate === firstOrder.truck_plate) ? firstOrder.truck_plate : '';
        const sameDriver = orders.every(o => o.driver_id === firstOrder.driver_id) ? firstOrder.driver_id : '';
        const sameComp = orders.every(o => o.companion_id === firstOrder.companion_id) ? firstOrder.companion_id : '';

        setSelectedTruckPlate(samePlate || '');
        setSelectedDriverId(sameDriver || '');
        setSelectedCompanionId(sameComp || '');
      } else {
        setSelectedTruckPlate('');
        setSelectedDriverId('');
        setSelectedCompanionId('');
      }
    }
  }, [isOpen, orders]);

  // When vehicle is selected, autofill driver and companion from the vehicle
  const handleVehicleChange = (plate: string) => {
    setSelectedTruckPlate(plate);
    setErrorMessage('');
    if (!plate) return;

    const truck = trucks.find(t => t.plate_number === plate || t.id === plate);
    if (truck) {
      if (truck.driver_id) {
        setSelectedDriverId(truck.driver_id);
      }
      if (truck.companion_id) {
        setSelectedCompanionId(truck.companion_id);
      }
    }
  };

  const handleSave = () => {
    if (!selectedTruckPlate && !selectedDriverId) {
      setErrorMessage('გთხოვთ აირჩიოთ ტრანსპორტი ან მძღოლი');
      return;
    }

    onSave(selectedDriverId, selectedCompanionId, selectedTruckPlate);
    onClose();
  };

  if (!isOpen) return null;

  const countText = orders.length === 1 ? '1 შეკვეთა' : `${orders.length} შეკვეთა`;
  const modalTitle = `ეკიპაჟის მინიჭება (${countText})`;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidthClass="max-w-md"
      onCancel={onClose}
      cancelLabel="Cancel"
      onSave={handleSave}
      saveLabel="Assign"
    >
      <div className="space-y-4 pt-1">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl text-center">
            {errorMessage}
          </div>
        )}

        {/* 1. ტრანსპორტი (Vehicle) */}
        <FormSelect
          label={`${t("Vehicle")}`}
          value={selectedTruckPlate}
          onChange={(e) => handleVehicleChange(e.target.value)}
        >
          <option value="">{t("Select Vehicle")}</option>
          {trucks.map(truck => (
            <option key={truck.id || truck.plate_number} value={truck.plate_number}>
              {truck.plate_number} {truck.model ? `(${truck.model})` : ''}
            </option>
          ))}
        </FormSelect>

        {/* 2. მძღოლი (Driver) */}
        <FormSelect
          label={`${t("Driver")}`}
          value={selectedDriverId}
          onChange={(e) => {
            setSelectedDriverId(e.target.value);
            setErrorMessage('');
          }}
        >
          <option value="">{t("Select Driver")}</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </FormSelect>

        {/* 3. დამხმარე (Assistant / Companion) */}
        <FormSelect
          label={`${t("Assistant")}`}
          value={selectedCompanionId}
          onChange={(e) => setSelectedCompanionId(e.target.value)}
        >
          <option value="">{t("Select Assistant")}</option>
          {companions.map(c => {
            const translatedRole = c.role === 'admin' ? t('Admin') :
              (c.role === 'manager' || c.role === 'purchasing_head') ? t('Purchasing Group Leader') :
              c.role === 'logistics_manager' ? t('Logistics Manager') :
              c.role === 'purchasing_manager' ? t('Purchasing Manager') :
              c.role === 'driver' ? t('Logistics/Driver') :
              c.role === 'operator' ? t('Operator') : c.role;
            return (
              <option key={c.id} value={c.id}>
                {c.name} {translatedRole ? `(${translatedRole})` : ''}
              </option>
            );
          })}
        </FormSelect>
      </div>
    </FormModal>
  );
}
