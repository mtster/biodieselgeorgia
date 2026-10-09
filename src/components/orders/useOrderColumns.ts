import { useState, useEffect } from 'react';
import { ManagedColumn } from '../ColumnsManagerModal';
import { createDatabaseOrderColumn } from '../../lib/db';

export const defaultOrdersColumns: ManagedColumn[] = [
  { id: 'doc_number', label: 'Document Number', visible: true },
  { id: 'order_date', label: 'Order Date', visible: true },
  { id: 'pickup_date_time', label: 'Pickup Date Time', visible: true },
  { id: 'vendor_name', label: 'Vendor Name', visible: true },
  { id: 'vendor_id_code', label: 'Taxation ID', visible: true },
  { id: 'vendor_address', label: 'Address', visible: true },
  { id: 'vendor_location', label: 'Region / District', visible: true },
  { id: 'warehouse_name', label: 'Warehouse Name', visible: true },
  { id: 'qty_requested', label: 'Planned QTY (L)', visible: true },
  { id: 'fact_qty', label: 'Fact QTY (L)', visible: true },
  { id: 'tanks_to_leave', label: 'Tanks Dropoff', visible: true },
  { id: 'tanks_to_bring', label: 'Tanks Pickup', visible: true },
  { id: 'fact_tank_dropoff', label: 'Fact Tank Dropoff', visible: true },
  { id: 'fact_tank_pickup', label: 'Fact Tank Pickup', visible: true },
  { id: 'status', label: 'Fulfillment Status', visible: true },
  { id: 'truck_plate', label: 'Assigned Vehicle Plate', visible: true },
  { id: 'driver_name', label: 'Driver', visible: true },
  { id: 'companion_name', label: 'Assistant', visible: true },
  { id: 'operator_name', label: 'Registered By', visible: true },
  { id: 'notes', label: 'Latest Note', visible: true }
];

export function useOrderColumns() {
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [managedCols, setManagedCols] = useState<ManagedColumn[]>(() => {
    const versionKey = 'orders_columns_version';
    const currentVersion = '2026-09-24-v2';
    const loaded = localStorage.getItem('orders_columns_managed');
    const storedVersion = localStorage.getItem(versionKey);

    if (loaded && storedVersion === currentVersion) {
      try {
        const parsed = JSON.parse(loaded) as ManagedColumn[];
        const map = new Map<string, ManagedColumn>();
        defaultOrdersColumns.forEach(c => map.set(c.id, { ...c }));
        parsed.forEach(c => map.set(c.id, c));
        return Array.from(map.values());
      } catch (e) {
        console.warn('Could not parse previous orders columns', e);
      }
    }

    const finalCols = defaultOrdersColumns.map(col => {
      if (['notes', 'vendor_id_code', 'operator_name'].includes(col.id)) {
        return { ...col, visible: false };
      }
      return { ...col };
    });

    localStorage.setItem('orders_columns_managed', JSON.stringify(finalCols));
    localStorage.setItem(versionKey, currentVersion);
    return finalCols;
  });

  const handleSaveColumns = async (updated: ManagedColumn[]) => {
    setManagedCols(updated);
    localStorage.setItem('orders_columns_managed', JSON.stringify(updated));

    // Provision each dynamic custom column securely in Supabase orders table
    for (const col of updated) {
      if (col.isCustom && col.id.startsWith('custom_')) {
        try {
          await createDatabaseOrderColumn(col.id);
        } catch (err) {
          console.error(`Error provisioning custom column on db [${col.id}]:`, err);
        }
      }
    }
  };

  return {
    isColModalOpen,
    setIsColModalOpen,
    managedCols,
    handleSaveColumns,
    defaultOrdersColumns
  };
}
