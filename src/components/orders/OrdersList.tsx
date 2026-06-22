import React from 'react';
import { Order, Vendor, User, Warehouse } from '../../types';
import { Edit2, Trash2, Check } from 'lucide-react';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { ManagedColumn } from '../ColumnsManagerModal';
import { t } from '../../utils/lang';

interface Props {
  filteredOrders: Order[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  startEdit: (ord: Order, readOnly?: boolean) => void;
  askDelete: (id: string, docNum: string) => void;
  selectedOrders?: string[];
  setSelectedOrders?: React.Dispatch<React.SetStateAction<string[]>>;
  managedCols: ManagedColumn[];
}

export default function OrdersList({
  filteredOrders,
  suppliers,
  warehouses,
  employees,
  startEdit,
  askDelete,
  selectedOrders = [],
  setSelectedOrders,
  managedCols = []
}: Props) {

  const handleRowClick = (ord: Order) => {
    startEdit(ord, false);
  };

  const toggleSelect = (ordId: string) => {
    if (!setSelectedOrders) return;
    if (selectedOrders.includes(ordId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== ordId));
    } else {
      setSelectedOrders([...selectedOrders, ordId]);
    }
  };

  const columnMap: Record<string, ColumnConfig<Order>> = {
    order_date: {
      header: t('Date'),
      key: 'order_date',
      render: (ord) => new Date(ord.order_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    },
    doc_number: {
      header: t('Doc Num'),
      key: 'doc_number',
      render: (ord) => ord.doc_number
    },
    vendor_id: {
      header: t('Supplier'),
      key: 'supplier',
      render: (ord) => {
        const supplierObj = suppliers.find(s => s.id === ord.vendor_id);
        return supplierObj ? supplierObj.trade_name : (ord.vendor_name || 'Dispatched supplier');
      }
    },
    warehouse_id: {
      header: t('Warehouse'),
      key: 'warehouse_name',
      render: (ord) => {
        const wh = warehouses.find(w => w.id === ord.warehouse_id);
        return wh ? wh.name : (ord.warehouse_name || 'Unassigned Warehouse');
      }
    },
    status: {
      header: t('Status'),
      key: 'status',
      render: (ord) => {
        const s = ord.status;
        if (s === 'driver_assigned') return t('Driver Assigned');
        if (s === 'picked_up') return t('Picked Up');
        return t(s);
      }
    },
    pickup_date_time: {
      header: t('Dispatch Date'),
      key: 'pickup_date_time',
      render: (ord) => ord.pickup_date_time ? new Date(ord.pickup_date_time).toLocaleString('en-US') : '-'
    },
    planned: {
      header: t('Planned'),
      key: 'planned',
      render: (ord) => `${ord.qty_requested} L`
    },
    tanks_to_leave: {
      header: t('Dropoff'),
      key: 'tanks_to_leave',
      render: (ord) => `${ord.tanks_to_leave}`
    },
    tanks_to_bring: {
      header: t('Pickup'),
      key: 'tanks_to_bring',
      render: (ord) => `${ord.tanks_to_bring}`
    },
    fact_qty: {
      header: t('Fact QTY'),
      key: 'fact_qty',
      render: (ord) => ord.fact_qty === undefined || ord.fact_qty === null ? '-' : ord.fact_qty
    },
    fact_tank_dropoff: {
      header: t('Fact Tank Dropoff'),
      key: 'fact_tank_dropoff',
      render: (ord) => ord.fact_tank_dropoff === undefined || ord.fact_tank_dropoff === null ? '-' : ord.fact_tank_dropoff
    },
    fact_tank_pickup: {
      header: t('Fact Tank Pickup'),
      key: 'fact_tank_pickup',
      render: (ord) => ord.fact_tank_pickup === undefined || ord.fact_tank_pickup === null ? '-' : ord.fact_tank_pickup
    },
    note: {
      header: t('Comment'),
      key: 'comment',
      render: (ord) => ord.note || '-'
    }
  };

  const columns: ColumnConfig<Order>[] = [];

  // Prepend select checkbox column
  columns.push({
    header: '',
    key: 'select',
    className: 'w-12 text-center',
    render: (ord) => {
      const isChecked = selectedOrders.includes(ord.id);
      return (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
          <button
            type="button"
            onClick={() => toggleSelect(ord.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto cursor-pointer ${
              isChecked
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            {isChecked && <Check size={11} strokeWidth={3.5} />}
          </button>
        </div>
      );
    }
  });

  // Map dynamic visible columns
  managedCols.forEach((col) => {
    if (col.visible) {
      if (columnMap[col.id]) {
        columns.push(columnMap[col.id]);
      } else {
        columns.push({
          header: col.label,
          key: col.id,
          render: (item: any) => item[col.id] ?? '-'
        });
      }
    }
  });

  // Append action button column at the end
  // columns.push({
  //   header: 'Actions',
  //   key: 'actions',
  //   className: 'text-right',
  //   render: (ord) => (
  //     <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-end gap-1 select-none">
  //       <button 
  //         onClick={() => startEdit(ord, false)}
  //         className="p-1 px-1.5 text-gray-400 hover:text-emerald-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
  //         title="Modify details"
  //       >
  //         <Edit2 size={13} />
  //       </button>
  //       <button 
  //         onClick={() => askDelete(ord.id, ord.doc_number)}
  //         className="p-1 px-1.5 text-gray-400 hover:text-red-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
  //         title="Delete coordinate"
  //       >
  //         <Trash2 size={13} />
  //       </button>
  //     </div>
  //   )
  // });

  const rowClassName = (ord: Order) => {
    const isChecked = selectedOrders.includes(ord.id);
    return isChecked ? 'bg-emerald-50/20 hover:bg-emerald-50/30' : 'hover:bg-slate-50/80';
  };

  return (
    <StandardTable
      data={filteredOrders}
      columns={columns}
      onRowClick={handleRowClick}
      rowClassName={rowClassName}
      emptyMessage={t("No active collection order entries were located.")}
    />
  );
}
