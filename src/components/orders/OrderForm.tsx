import React, { useState, useEffect, useRef } from 'react';
import { Order, Vendor, Warehouse, User, Truck } from '../../types';
import OrderFormFields from './OrderFormFields';
import { t } from '../../utils/lang';
import { getVendorById } from '../../lib/db';

interface Props {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  currentEmployee: User;
  onSave: (order: Order) => Promise<void> | void;
  onCancel: () => void;
  formRef?: React.RefObject<{ 
    save: () => void; 
    fillDummy: () => void;
    saveAndReminder?: (onSuccess?: (vendorId: string) => void) => void;
  }>;
  isReadOnly?: boolean;
  onSavingStateChange?: (isSaving: boolean) => void;
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
  isReadOnly = false,
  onSavingStateChange
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Search state for autocomplete select
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

  const initialSnapshotRef = useRef<{
    isNew: boolean;
    order: Partial<Order>;
  } | null>(null);

  useEffect(() => {
    if (editingOrder) {
      initialSnapshotRef.current = {
        isNew: !editingOrder.id || editingOrder.id.startsWith('order-temp-'),
        order: JSON.parse(JSON.stringify(editingOrder))
      };
    }
  }, [editingOrder?.id]);

  // Pre-fill vendorSearch term with company name
  useEffect(() => {
    if (!editingOrder.vendor_id) {
      setVendorSearch('');
      return;
    }
    const cleanVendorId = String(editingOrder.vendor_id).trim().toLowerCase();
    const vendorObj = suppliers.find(s => s.id === editingOrder.vendor_id || (s.id && String(s.id).trim().toLowerCase() === cleanVendorId));
    if (vendorObj) {
      const name = vendorObj.trade_name || vendorObj.company_name || '';
      setVendorSearch(name);
      if (!editingOrder.vendor_name) {
        setEditingOrder(prev => prev ? { ...prev, vendor_name: name } : null);
      }
    } else if (editingOrder.vendor_name) {
      setVendorSearch(editingOrder.vendor_name);
    } else {
      getVendorById(editingOrder.vendor_id).then(v => {
        if (v) {
          const name = v.trade_name || v.company_name || '';
          setVendorSearch(name);
          setEditingOrder(prev => prev ? { 
            ...prev, 
            vendor_name: name,
            address: prev.address || v.address,
            city: prev.city || v.city,
            district: prev.district || v.district,
            warehouse_id: prev.warehouse_id || v.warehouse_id
          } : null);
        }
      });
    }
  }, [editingOrder.vendor_id, suppliers]);

  const hasOrderChanges = (): boolean => {
    if (!initialSnapshotRef.current || initialSnapshotRef.current.isNew) {
      return true;
    }
    const initO = initialSnapshotRef.current.order;
    if (!initO) return true;

    const fieldsToCompare: (keyof Order)[] = [
      'vendor_id', 'order_date', 'warehouse_id', 'contact_id',
      'driver_id', 'companion_id', 'truck_plate', 'direction_id',
      'status', 'note', 'address', 'city', 'district'
    ];

    for (const f of fieldsToCompare) {
      const v1 = (editingOrder[f] ?? '').toString().trim();
      const v2 = (initO[f] ?? '').toString().trim();
      if (v1 !== v2) return true;
    }

    if (Number(editingOrder.qty_requested || 0) !== Number(initO.qty_requested || 0)) return true;
    if (Number(editingOrder.tanks_to_bring || 0) !== Number(initO.tanks_to_bring || 0)) return true;
    if (Number(editingOrder.tanks_to_leave || 0) !== Number(initO.tanks_to_leave || 0)) return true;
    if (Number(editingOrder.fact_qty || 0) !== Number(initO.fact_qty || 0)) return true;
    if (Number(editingOrder.fact_tank_dropoff || 0) !== Number(initO.fact_tank_dropoff || 0)) return true;
    if (Number(editingOrder.fact_tank_pickup || 0) !== Number(initO.fact_tank_pickup || 0)) return true;

    return false;
  };

  const handleSaveAll = async (onSuccessCallback?: (vendorId: string) => void) => {
    const errs: Record<string, string> = {};

    if (!editingOrder.vendor_id) {
      errs.vendor_id = 'გთხოვთ აირჩიოთ მომწოდებელი.';
    }
    if (!editingOrder.warehouse_id) {
      errs.warehouse_id = 'გთხოვთ აირჩიოთ დანიშნულების საწყობი.';
    }
    if (editingOrder.tanks_to_bring === undefined || editingOrder.tanks_to_bring === null || isNaN(editingOrder.tanks_to_bring)) {
      errs.tanks_to_bring = 'ავზების წამოღება სავალდებულოა.';
    }
    if (editingOrder.tanks_to_leave === undefined || editingOrder.tanks_to_leave === null || isNaN(editingOrder.tanks_to_leave)) {
      errs.tanks_to_leave = 'ავზების დატოვება სავალდებულოა.';
    }
    if (!editingOrder.contact_id) {
      errs.contact_id = 'გთხოვთ აირჩიოთ კონტაქტი.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});

    // If no changes were made to an existing order, do not send unnecessary update request
    if (!hasOrderChanges()) {
      onSavingStateChange?.(false);
      if (onSuccessCallback) {
        onSuccessCallback(editingOrder.vendor_id);
      } else {
        onCancel();
      }
      return;
    }

    onSavingStateChange?.(true);

    try {
      // Build pickup date/time ISO values if completed
      let finalOrder = { ...editingOrder };
      if (finalOrder.status === 'completed') {
        if (!finalOrder.pickup_date_time) {
          finalOrder.pickup_date_time = new Date().toISOString();
        }
      }

      const cleanVendorId = String(finalOrder.vendor_id || '').trim().toLowerCase();
      const supplierObj = suppliers.find(s => s.id === finalOrder.vendor_id || (s.id && String(s.id).trim().toLowerCase() === cleanVendorId));
      const warehouseObj = warehouses.find(w => w.id === finalOrder.warehouse_id);
      const operatorObj = employees.find(e => e.id === finalOrder.operator_id);
      const driverObj = employees.find(e => e.id === finalOrder.driver_id);
      const companionObj = employees.find(e => e.id === finalOrder.companion_id);

      const final: Order = {
        ...finalOrder,
        vendor_name: (supplierObj?.trade_name || supplierObj?.company_name) || finalOrder.vendor_name || vendorSearch || '',
        warehouse_name: warehouseObj?.name || '',
        operator_name: operatorObj?.name || currentEmployee.name,
        driver_name: driverObj?.name || '',
        companion_name: companionObj?.name || ''
      };

      await onSave(final);
      onSavingStateChange?.(false);
      if (onSuccessCallback) {
        onSuccessCallback(final.vendor_id);
      }
    } catch (err) {
      onSavingStateChange?.(false);
      console.error('Error in handleSaveAll:', err);
    }
  };

  React.useImperativeHandle(formRef, () => ({
    save: () => handleSaveAll(),
    fillDummy: fillDummyOrder,
    saveAndReminder: (onSuccess?: (vendorId: string) => void) => handleSaveAll(onSuccess)
  }));

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
