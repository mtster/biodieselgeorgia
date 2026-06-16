import React, { useState, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../../types';
import OrderFormFields from './OrderFormFields';

interface Props {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  currentEmployee: User;
  onSave: (order: Order) => void;
  onCancel: () => void;
  formRef?: React.RefObject<{ save: () => void; fillDummy: () => void }>;
  isReadOnly?: boolean;
}

export default function OrderForm({
  editingOrder,
  setEditingOrder,
  suppliers,
  warehouses,
  employees,
  trucks,
  currentEmployee,
  onSave,
  onCancel,
  formRef,
  isReadOnly = false
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Time & Date states for Priority UX
  const [pickupHour, setPickupHour] = useState('12');
  const [pickupMin, setPickupMin] = useState('00');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  // Search state for autocomplete select
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

  React.useImperativeHandle(formRef, () => ({
    save: handleSaveAll,
    fillDummy: fillDummyOrder
  }));

  // Sync custom time picker fields when editingOrder changes
  useEffect(() => {
    if (editingOrder.pickup_date_time) {
      try {
        const d = new Date(editingOrder.pickup_date_time);
        if (!isNaN(d.getTime())) {
          setPickupHour(d.getHours().toString().padStart(2, '0'));
          setPickupMin(d.getMinutes().toString().padStart(2, '0'));
          setSelectedDay(d.getDate().toString());
          setSelectedMonth((d.getMonth() + 1).toString());
          
          const today = new Date();
          if (d.toDateString() !== today.toDateString()) {
            setUseCustomDate(true);
          } else {
            setUseCustomDate(false);
          }
        }
      } catch (e) {
        // Fallback
      }
    } else {
      setPickupHour('12');
      setPickupMin('00');
      setUseCustomDate(false);
      setSelectedDay(new Date().getDate().toString());
      setSelectedMonth((new Date().getMonth() + 1).toString());
    }
  }, [editingOrder.id, editingOrder.status]);

  // Pre-fill vendorSearch term
  useEffect(() => {
    const vendorObj = suppliers.find(s => s.id === editingOrder.vendor_id);
    setVendorSearch(vendorObj ? vendorObj.trade_name : '');
  }, [editingOrder.vendor_id, suppliers]);

  const handleSaveAll = () => {
    const errs: Record<string, string> = {};

    if (!editingOrder.vendor_id) {
      errs.vendor_id = 'Please select a Supplier / Vendor.';
    }
    if (!editingOrder.warehouse_id) {
      errs.warehouse_id = 'Please select a Base Destination Warehouse.';
    }
    if (!editingOrder.doc_number.trim()) {
      errs.doc_number = 'Document dispatch number is required.';
    }
    if (editingOrder.status !== 'registered' && editingOrder.status !== 'cancelled') {
      if (!editingOrder.driver_id) {
        errs.driver_id = 'Please select an Assigned Fleet Driver.';
      }
      if (!editingOrder.truck_plate) {
        errs.truck_plate = 'Please select an Assigned Vehicle.';
      }
    }

    // Build pickup date/time ISO values if completed
    let finalOrder = { ...editingOrder };
    if (finalOrder.status === 'completed') {
      const year = new Date().getFullYear();
      const finalDate = new Date();
      if (useCustomDate) {
        finalDate.setFullYear(year, parseInt(selectedMonth) - 1, parseInt(selectedDay));
      }
      finalDate.setHours(parseInt(pickupHour), parseInt(pickupMin), 0, 0);
      finalOrder.pickup_date_time = finalDate.toISOString();

      if (finalOrder.qty_actual === undefined || finalOrder.qty_actual <= 0) {
        errs.qty_actual = 'Please specify Actual Volume Received (Liters) for completed orders.';
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});

    const supplierObj = suppliers.find(s => s.id === finalOrder.vendor_id);
    const warehouseObj = warehouses.find(w => w.id === finalOrder.warehouse_id);
    const operatorObj = employees.find(e => e.id === finalOrder.operator_id);
    const driverObj = employees.find(e => e.id === finalOrder.driver_id);
    const companionObj = employees.find(e => e.id === finalOrder.companion_id);

    const final: Order = {
      ...finalOrder,
      vendor_name: supplierObj?.trade_name || '',
      warehouse_name: warehouseObj?.name || '',
      operator_name: operatorObj?.name || currentEmployee.name,
      driver_name: driverObj?.name || '',
      companion_name: companionObj?.name || ''
    };

    onSave(final);
  };

  const fillDummyOrder = () => {
    setEditingOrder({
        ...editingOrder,
        vendor_id: suppliers[0]?.id || '',
        warehouse_id: warehouses[0]?.id || '',
        qty_requested: Math.floor(Math.random() * 1000),
        driver_id: employees.find(e => e.role === 'driver')?.id || '',
        truck_plate: trucks[0]?.plate_number || '',
        note: 'Dummy note',
    });
    setVendorSearch(suppliers[0]?.trade_name || '');
  };

  const daysList = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  const monthsList = [
    { value: '1', name: 'January' },
    { value: '2', name: 'February' },
    { value: '3', name: 'March' },
    { value: '4', name: 'April' },
    { value: '5', name: 'May' },
    { value: '6', name: 'June' },
    { value: '7', name: 'July' },
    { value: '8', name: 'August' },
    { value: '9', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ];

  return (
    <div className="animate-in fade-in duration-200 max-w-2xl text-left" id="orders-form-panel">
      <fieldset disabled={isReadOnly} className="contents disabled:opacity-95">
        <OrderFormFields
          editingOrder={editingOrder}
          setEditingOrder={setEditingOrder}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          suppliers={suppliers}
          warehouses={warehouses}
          employees={employees}
          trucks={trucks}
          vendorSearch={vendorSearch}
          setVendorSearch={setVendorSearch}
          showVendorSuggestions={showVendorSuggestions}
          setShowVendorSuggestions={setShowVendorSuggestions}
          pickupHour={pickupHour}
          setPickupHour={setPickupHour}
          pickupMin={pickupMin}
          setPickupMin={setPickupMin}
          useCustomDate={useCustomDate}
          setUseCustomDate={setUseCustomDate}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          daysList={daysList}
          monthsList={monthsList}
        />
      </fieldset>
    </div>
  );
}
