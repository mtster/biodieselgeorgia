import React from 'react';
import { Order, Vendor, User, Warehouse, Direction } from '../../types';
import { Edit2, Trash2, Check } from 'lucide-react';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { ManagedColumn } from '../ColumnsManagerModal';
import { t, formatDate, formatDateTime } from '../../utils/lang';

interface Props {
  currentEmployee: User;
  filteredOrders: Order[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  directions: Direction[];
  startEdit: (ord: Order, readOnly?: boolean) => void;
  askDelete: (id: string, docNum: string) => void;
  selectedOrders?: string[];
  setSelectedOrders?: React.Dispatch<React.SetStateAction<string[]>>;
  managedCols: ManagedColumn[];
  serverTotalCount?: number;
  page?: number;
  onPageChange?: (newPage: number) => void;
  isLoading?: boolean;
}

export default function OrdersList({
  currentEmployee,
  filteredOrders,
  suppliers,
  warehouses,
  employees,
  directions,
  startEdit,
  askDelete,
  selectedOrders = [],
  setSelectedOrders,
  managedCols = [],
  serverTotalCount,
  page,
  onPageChange,
  isLoading
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

  const findSupplier = (vendorId?: string, ord?: Order) => {
    if (ord && (ord as any).vendor) {
      return (ord as any).vendor;
    }
    if (!vendorId) return null;
    const cleanId = String(vendorId).trim().toLowerCase();
    return suppliers.find(s => s.id === vendorId || (s.id && String(s.id).trim().toLowerCase() === cleanId)) || null;
  };

  const columnMap: Record<string, ColumnConfig<Order>> = {
    order_date: {
      header: t('Dispatch Date'),
      key: 'order_date',
      render: (ord) => formatDateTime(ord.order_date)
    },
    doc_number: {
      header: t('Doc Num'),
      key: 'doc_number',
      render: (ord) => ord.doc_number
    },
    vendor_id: {
      header: t('Supplier'),
      key: 'supplier',
      className: 'max-w-[200px] xl:max-w-[260px]',
      render: (ord) => {
        const supplierObj = findSupplier(ord.vendor_id, ord);
        const name = (supplierObj?.trade_name || supplierObj?.company_name) || ord.vendor_name || t('Supplier');
        return (
          <div className="max-w-[200px] xl:max-w-[260px] truncate" title={name}>
            <span className="font-semibold text-gray-800">{name}</span>
          </div>
        );
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
      render: (ord) => {
        const notes = ord.notes && ord.notes.length > 0 ? ord.notes : null;
        if (notes && notes.length > 0) {
          const hasImportant = notes.some(n => n.before_leaving_base);
          const priorityNote = notes.find(n => n.before_leaving_base) || notes[0];
          const author = (employees?.find(e => e.id === priorityNote.user_id)?.name) || priorityNote.user_name || '';

          return (
            <div 
              className="flex items-center gap-1.5 max-w-[240px]" 
              title={notes.map(n => {
                const a = (employees?.find(e => e.id === n.user_id)?.name) || n.user_name || '';
                return `${a ? a + ': ' : ''}${n.comment}${n.before_leaving_base ? ' [ბაზიდან გასვლამდე საყურადღებო]' : ''}`;
              }).join('\n')}
            >
              {hasImportant && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold shrink-0 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                  საყურადღებო
                </span>
              )}
              <span className={`truncate text-xs ${hasImportant ? 'text-rose-700 font-semibold' : 'text-gray-700'}`}>
                {priorityNote.comment}
              </span>
              {notes.length > 1 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 text-gray-500 rounded font-mono shrink-0">
                  +{notes.length - 1}
                </span>
              )}
            </div>
          );
        }
        return ord.note ? (
          <span className="truncate text-xs text-gray-700 max-w-[200px] block" title={ord.note}>{ord.note}</span>
        ) : '-';
      }
    },
    address: {
      header: t('Address'),
      key: 'address',
      render: (ord) => {
        const vendor = findSupplier(ord.vendor_id, ord);
        return vendor?.address || ord.address || '-';
      }
    },
    direction: {
      header: t('Direction'),
      key: 'direction',
      render: (ord) => {
        const vendor = findSupplier(ord.vendor_id, ord);
        const dirId = vendor?.direction_id || ord.direction_id;
        if (!dirId) return '-';
        const d = directions.find(dir => dir.id === dirId);
        return d ? d.name : '-';
      }
    },
    city: {
      header: t('City'),
      key: 'city',
      render: (ord) => {
        const vendor = findSupplier(ord.vendor_id, ord);
        return vendor?.city || ord.city || '-';
      }
    },
    district: {
      header: t('District'),
      key: 'district',
      render: (ord) => {
        const vendor = findSupplier(ord.vendor_id, ord);
        return vendor?.district || ord.district || '-';
      }
    },
    truck_plate: {
      header: t('Vehicle'),
      key: 'truck_plate',
      render: (ord) => ord.truck_plate || '-'
    },
    driver_id: {
      header: t('Driver'),
      key: 'driver_id',
      render: (ord) => {
        if (!ord.driver_id) return '-';
        const emp = employees.find(e => e.id === ord.driver_id);
        return emp ? emp.name : '-';
      }
    },
    companion_id: {
      header: t('Assistant'),
      key: 'companion_id',
      render: (ord) => {
        if (!ord.companion_id) return '-';
        const emp = employees.find(e => e.id === ord.companion_id);
        return emp ? emp.name : '-';
      }
    },
    contacts: {
      header: t('Contacts'),
      key: 'contacts',
      render: (ord) => {
        const vendor = findSupplier(ord.vendor_id);
        if (!vendor || !vendor.contacts || vendor.contacts.length === 0) return '-';
        const mainContact = vendor.contacts.find(c => c.is_default) || vendor.contacts[0];
        return `${mainContact.name} (${mainContact.phone})`;
      }
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
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center w-full h-full bg-transparent">
          <button
            type="button"
            onClick={() => toggleSelect(ord.id)}
            className={`w-4 h-4 rounded border flex items-center justify-center p-0 shrink-0 mx-auto cursor-pointer ${
              isChecked
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            {isChecked && <Check size={11} strokeWidth={3.5} className="shrink-0 leading-none" />}
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
    return isChecked ? 'bg-emerald-50/70 hover:bg-emerald-100/70' : 'hover:bg-slate-50';
  };

  return (
    <StandardTable
      data={filteredOrders}
      columns={columns}
      onRowClick={handleRowClick}
      rowClassName={rowClassName}
      emptyMessage={t("No active collection order entries were located.")}
      serverTotalCount={serverTotalCount}
      page={page}
      onPageChange={onPageChange}
      isLoading={isLoading}
    />
  );
}
