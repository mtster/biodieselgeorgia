import { useState } from 'react';
import { ManagedColumn } from '../ColumnsManagerModal';
import { createDatabaseColumn } from '../../services/vendorService';

export const defaultSuppliersColumns: ManagedColumn[] = [
  { id: 'trade_name', label: 'Trade Name', visible: true },
  { id: 'id_code', label: 'Taxation ID', visible: true },
  { id: 'company_name', label: 'Legal Name', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'price_per_liter', label: 'Rate (₾)', visible: true },
  { id: 'working_hours', label: 'Working Hours', visible: true },
  { id: 'location', label: 'Address', visible: true },
  { id: 'direction', label: 'Direction', visible: true },
  { id: 'overdue_threshold_days', label: 'overdue_threshold_days', visible: true },
  { id: 'barrels_amount', label: 'Barrels Amount', visible: true },
  { id: 'company_code', label: 'Assigned Code', visible: true },
  { id: 'primary_contact', label: 'Primary Contact', visible: true },
  { id: 'additional_contacts', label: 'Additional Contacts', visible: true },
  { id: 'manager', label: 'Sales Manager', visible: true },
  { id: 'dispatcher', label: 'Operation Manager', visible: true },
  { id: 'communications', label: 'Communications', visible: true },
  { id: 'comments', label: 'Memos / Internal Notes', visible: true }
];

export function useVendorColumns() {
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [managedCols, setManagedCols] = useState<ManagedColumn[]>(() => {
    const loaded = localStorage.getItem('suppliers_columns_managed');
    let cols = loaded ? (JSON.parse(loaded) as ManagedColumn[]) : defaultSuppliersColumns;
    cols = cols.filter(
      (c: ManagedColumn) => c.id !== 'fact_qty' && c.id !== 'fact_tank_dropoff' && c.id !== 'fact_tank_pickup'
    );

    if (!cols.some(c => c.id === 'company_name')) {
      const idCodeIdx = cols.findIndex(c => c.id === 'id_code');
      const newCol: ManagedColumn = { id: 'company_name', label: 'Legal Name', visible: true };
      if (idCodeIdx !== -1) {
        cols.splice(idCodeIdx + 1, 0, newCol);
      } else {
        cols.unshift(newCol);
      }
    }
    return cols;
  });

  const handleSaveColumns = async (updated: ManagedColumn[]) => {
    setManagedCols(updated);
    localStorage.setItem('suppliers_columns_managed', JSON.stringify(updated));

    // Provision each dynamic custom column securely in Supabase vendors table
    for (const col of updated) {
      if (col.isCustom && col.id.startsWith('custom_')) {
        try {
          await createDatabaseColumn(col.id);
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
    defaultSuppliersColumns
  };
}
