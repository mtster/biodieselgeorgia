import { useState } from 'react';
import { ManagedColumn } from '../ColumnsManagerModal';
import { createDatabaseOrderColumn } from '../../lib/db';

export const defaultOrdersColumns: ManagedColumn[] = [
  { id: 'order_date', label: 'Order Date', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'completed_at', label: 'Completion Time', visible: true },
  { id: 'vendor_id', label: 'Supplier', visible: true },
  { id: 'city', label: 'City', visible: true },
  { id: 'address', label: 'Address', visible: true },
  { id: 'contacts', label: 'Contact', visible: true },
  { id: 'note', label: 'Comment', visible: true },
  { id: 'planned', label: 'Planned Qty', visible: true },
  { id: 'tanks_to_bring', label: 'Order Pickup', visible: true },
  { id: 'tanks_to_leave', label: 'Order Dropoff', visible: true },
  { id: 'fact_qty', label: 'Fact Qty', visible: true },
  { id: 'fact_tank_pickup', label: 'Fact Pickup', visible: true },
  { id: 'fact_tank_dropoff', label: 'Fact Dropoff', visible: true },
  { id: 'district', label: 'District', visible: true },
  { id: 'direction', label: 'Direction', visible: true },
  { id: 'truck_plate', label: 'Vehicle', visible: true },
  { id: 'driver_id', label: 'Driver', visible: true },
  { id: 'companion_id', label: 'Assistant', visible: true },
  { id: 'doc_number', label: 'Doc Num', visible: true },
  { id: 'warehouse_id', label: 'Warehouse', visible: true },
  { id: 'operator_id', label: 'Created By', visible: true },
  { id: 'created_at', label: 'Created At', visible: true }
];

export function useOrderColumns() {
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [managedCols, setManagedCols] = useState<ManagedColumn[]>(() => {
    const versionKey = 'orders_columns_version';
    const currentVersion = '2026-10-09-v7-restored';
    const loaded = localStorage.getItem('orders_columns_managed');
    const storedVersion = localStorage.getItem(versionKey);

    if (loaded && storedVersion === currentVersion) {
      try {
        const parsed = JSON.parse(loaded) as ManagedColumn[];
        // Check if cached items have corrupted/outdated IDs
        const hasOutdated = parsed.some(c =>
          c.id === 'vendor_name' ||
          c.id === 'qty_requested' ||
          c.id === 'notes' ||
          c.id === 'driver_name' ||
          c.id === 'companion_name' ||
          c.id === 'operator_name'
        );
        if (!hasOutdated && parsed.length > 0) {
          const map = new Map<string, ManagedColumn>();
          defaultOrdersColumns.forEach(c => map.set(c.id, { ...c }));
          parsed.forEach(c => {
            if (map.has(c.id)) {
              const def = map.get(c.id)!;
              map.set(c.id, { ...def, visible: c.visible });
            } else if (c.isCustom) {
              map.set(c.id, c);
            }
          });
          return Array.from(map.values());
        }
      } catch (e) {
        console.warn('Could not parse previous orders columns', e);
      }
    }

    const finalCols = defaultOrdersColumns.map(col => ({ ...col }));
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
