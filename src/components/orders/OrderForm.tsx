import React, { useState, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../../types';
import OrderFormFields from './OrderFormFields';
import { t } from '../../utils/lang';

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

  // Search state for autocomplete select
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

  React.useImperativeHandle(formRef, () => ({
    save: handleSaveAll,
    fillDummy: fillDummyOrder
  }));

  // Pre-fill vendorSearch term
  useEffect(() => {
    const vendorObj = suppliers.find(s => s.id === editingOrder.vendor_id);
    setVendorSearch(vendorObj ? vendorObj.trade_name : '');
  }, [editingOrder.vendor_id, suppliers]);

  const handleSaveAll = () => {
    const errs: Record<string, string> = {};

    if (!editingOrder.vendor_id) {
      errs.vendor_id = 'გთხოვთ აირჩიოთ მომწოდებელი.';
    }
    if (!editingOrder.warehouse_id) {
      errs.warehouse_id = 'გთხოვთ აირჩიოთ დანიშნულების საწყობი.';
    }
    if (editingOrder.tanks_to_bring === undefined || editingOrder.tanks_to_bring === null || isNaN(editingOrder.tanks_to_bring)) {
      errs.tanks_to_bring = 'კასრების წამოღება სავალდებულოა.';
    }
    if (editingOrder.tanks_to_leave === undefined || editingOrder.tanks_to_leave === null || isNaN(editingOrder.tanks_to_leave)) {
      errs.tanks_to_leave = 'კასრების დატოვება სავალდებულოა.';
    }
    if (!editingOrder.contact_id) {
      errs.contact_id = 'გთხოვთ აირჩიოთ კონტაქტი.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});

    // Build pickup date/time ISO values if completed
    let finalOrder = { ...editingOrder };
    if (finalOrder.status === 'completed') {
      if (!finalOrder.pickup_date_time) {
        finalOrder.pickup_date_time = new Date().toISOString();
      }
    }

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
          currentEmployee={currentEmployee}
        />
      </fieldset>
    </div>
  );
}
