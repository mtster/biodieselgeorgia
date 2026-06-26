import React, { useState, useEffect, useRef } from 'react';
import { Order, Vendor, Warehouse, User, Truck } from '../../types';
import { getSMSLogs } from '../../lib/db';
import { 
  Plus, Search, Trash2
} from 'lucide-react';

import { t } from '../../utils/lang';

import PeriodFilter from '../PeriodFilter';
import OrderForm from '../orders/OrderForm';
import SMSLogsModal from '../orders/SMSLogsModal';
import AssignDriverModal from '../orders/AssignDriverModal';
import OrdersList from '../orders/OrdersList';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import ColumnsManagerModal, { ManagedColumn } from '../ColumnsManagerModal';
import DeleteButton from '../DeleteButton';
import { createDatabaseOrderColumn } from '../../services/orderService';

const defaultOrdersColumns: ManagedColumn[] = [
  { id: 'order_date', label: 'Date', visible: true },
  { id: 'doc_number', label: 'Doc Num', visible: true },
  { id: 'vendor_id', label: 'Supplier', visible: true },
  { id: 'warehouse_id', label: 'Warehouse', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'pickup_date_time', label: 'Dispatch Date', visible: true },
  { id: 'planned', label: 'Planned Qty', visible: true },
  { id: 'fact_qty', label: 'Fact QTY', visible: true },
  { id: 'tanks_to_leave', label: 'Dropoff Tanks', visible: true },
  { id: 'fact_tank_dropoff', label: 'Fact Tank Dropoff', visible: true },
  { id: 'tanks_to_bring', label: 'Pickup Tanks', visible: true },
  { id: 'fact_tank_pickup', label: 'Fact Tank Pickup', visible: true },
  { id: 'note', label: 'Comment', visible: true }
];

interface Props {
  orders: Order[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  currentEmployee: User;
  onSave: (order: Order) => void;
  onDelete: (id: string, docNum: string) => void;
}

export default function OrdersView({ 
  orders, suppliers, warehouses, employees, trucks, 
  currentEmployee, onSave, onDelete 
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(endOfMonth.getDate())}`;
  });

  // Active form management
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showSMSLogs, setShowSMSLogs] = useState(false);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);

  // Bulk-delete selection states
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showAssignDriverModal, setShowAssignDriverModal] = useState(false);

  // Columns Manager State
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [managedCols, setManagedCols] = useState<ManagedColumn[]>(() => {
    const loaded = localStorage.getItem('orders_columns_managed');
    return loaded ? JSON.parse(loaded) : defaultOrdersColumns;
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

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmDocNum, setDeleteConfirmDocNum] = useState<string | null>(null);

  // Action triggers for child forms
  const formRef = useRef<{ save: () => void; fillDummy: () => void }>(null);

  const lastScrolledOrderId = useRef<string | null>(null);

  useEffect(() => {
    if (editingOrder) {
      const currentId = editingOrder.id || 'new';
      if (lastScrolledOrderId.current !== currentId) {
        lastScrolledOrderId.current = currentId;
        const mainElement = document.querySelector('main');
        if (mainElement) {
          mainElement.scrollTop = 0;
        }
      }
    } else {
      lastScrolledOrderId.current = null;
    }
  }, [editingOrder?.id]);

  const loadSMSLogs = async () => {
    const data = await getSMSLogs();
    setSmsLogs(data);
  };

  useEffect(() => {
    loadSMSLogs();
  }, [orders]);

  const startNew = () => {
    const defaultOrder: Order = {
      id: '',
      order_date: new Date().toISOString().substring(0, 10),
      doc_number: 'DOC-' + Math.floor(100000 + Math.random() * 900000),
      vendor_id: '',
      warehouse_id: '',
      note: '',
      qty_requested: 50,
      fact_qty: undefined,
      tanks_to_leave: 1,
      tanks_to_bring: 1,
      fact_tank_dropoff: undefined,
      fact_tank_pickup: undefined,
      pickup_date_time: undefined,
      operator_id: currentEmployee.id,
      driver_id: '',
      companion_id: '',
      truck_plate: '',
      status: 'registered'
    };
    setEditingOrder(defaultOrder);
    setIsNew(true);
  };

  const startEdit = (ord: Order) => {
    setEditingOrder(JSON.parse(JSON.stringify(ord)));
    setIsNew(false);
  };

  const handleBulkDeleteExecute = () => {
    selectedOrders.forEach(id => {
      const ord = orders.find(o => o.id === id);
      onDelete(id, ord?.doc_number || '');
    });
    setSelectedOrders([]);
    setShowBulkDeleteConfirm(false);
  };

  const handleSaveFromForm = (finalOrder: Order) => {
    onSave(finalOrder);
    setEditingOrder(null);
  };

  const filteredOrders = orders.filter(ord => {
    if (ord.is_deleted) return false;
    
    const supplierObj = suppliers.find(s => s.id === ord.vendor_id);
    const supplierName = supplierObj ? supplierObj.trade_name : (ord.vendor_name || '');
    const matchesSearch = supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ord.doc_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === '' || ord.status === selectedStatus;
    if (!matchesSearch || !matchesStatus) return false;

    // Period Filter
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const ordDate = new Date(ord.order_date);
      if (ordDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const ordDate = new Date(ord.order_date);
      if (ordDate > end) return false;
    }

    return true;
  });

  const askDelete = (id: string, docNum: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmDocNum(docNum);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId, deleteConfirmDocNum || '');
      if (editingOrder && editingOrder.id === deleteConfirmId) {
        setEditingOrder(null);
      }
    }
    setDeleteConfirmId(null);
    setDeleteConfirmDocNum(null);
  };

  const headerActions = (
    <>
      {editingOrder ? (
        <>
          {editingOrder.id && (
            <DeleteButton
              onClick={() => {
                askDelete(editingOrder.id, editingOrder.doc_number);
              }}
            />
          )}
          <button 
            onClick={() => {
              formRef.current?.fillDummy();
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-700 transition cursor-pointer select-none"
          >
            {t("Fill Dummy")}
          </button>
          <button 
            onClick={() => {
              formRef.current?.save();
            }}
            className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
          >
            {t("Save")}
          </button>
        </>
      ) : (
        <>
          <div className="relative">
            <select
              value=""
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'sms_logs') {
                  loadSMSLogs();
                  setShowSMSLogs(true);
                } else if (val === 'delete' && selectedOrders.length > 0) {
                  setShowBulkDeleteConfirm(true);
                } else if (val === 'assign_driver' && selectedOrders.length > 0) {
                  setShowAssignDriverModal(true);
                } else if (val === 'col_manager') {
                  setIsColModalOpen(true);
                }
                e.target.value = ''; // Reset select trigger
              }}
              className="px-3.5 py-2.5 pr-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-gray-200 cursor-pointer select-none focus:outline-none appearance-none font-sans"
            >
              <option value="" disabled hidden>{t("Actions")}</option>
              <option value="sms_logs">{t("SMS Logs")} ({smsLogs.length})</option>
              <option value="assign_driver" disabled={selectedOrders.length === 0}>
                {t("Assign Driver")} {selectedOrders.length > 0 ? `(${selectedOrders.length})` : ''}
              </option>
              <option value="delete" disabled={selectedOrders.length === 0}>
                {t("Delete")} {selectedOrders.length > 0 ? `(${selectedOrders.length})` : ''}
              </option>
              <option value="col_manager">{t("Columns Manager")}</option>
            </select>
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
              ▼
            </span>
          </div>
          
          <button 
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition shadow-sm cursor-pointer select-none font-sans"
          >
            <Plus size={15} />
            {t("New Order")}
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER */}
      <PageHeader 
        title={editingOrder ? (editingOrder.id ? `${t("Order")}: ${editingOrder.doc_number}` : t("New Order")) : t("Orders")}

        onBack={editingOrder ? () => setEditingOrder(null) : undefined}
        backButtonId="order-form-back-arrow"
        actions={headerActions}
      />

      {/* 2. FORM OR LIST SPREADSHEET */}
      {editingOrder ? (
        <OrderForm
          editingOrder={editingOrder}
          setEditingOrder={setEditingOrder}
          suppliers={suppliers}
          warehouses={warehouses}
          employees={employees}
          trucks={trucks}
          currentEmployee={currentEmployee}
          onSave={handleSaveFromForm}
          onCancel={() => setEditingOrder(null)}
          formRef={formRef}
        />
      ) : (
        <div className="space-y-6 text-left">
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="flex flex-col md:flex-row items-center gap-4 w-full">
            <PeriodFilter 
              startDate={startDate} 
              setStartDate={setStartDate} 
              endDate={endDate} 
              setEndDate={setEndDate} 
            />

            {/* Text Search & Status Filter */}
            <div className="flex-1 w-full">
              <CentralSearchBar 
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                idPrefix="orders-search"
                searchPlaceholder={t("Search dispatches by supplier trade name, legal entity, or document coordinate...")}
                filters={[
                  {
                    label: t("Status"),
                    value: selectedStatus,
                    onChange: setSelectedStatus,
                    placeholder: t("All Statuses"),
                    options: [
                      { value: "registered", label: t("Registered") },
                      { value: "driver_assigned", label: t("Driver Assigned") },
                      { value: "picked_up", label: t("Picked Up") },
                      { value: "completed", label: t("Completed") },
                      { value: "cancelled", label: t("Cancelled") }
                    ]
                  }
                ]}
              />
            </div>
          </div>

          <OrdersList 
            filteredOrders={filteredOrders} 
            suppliers={suppliers} 
            warehouses={warehouses}
            employees={employees}
            startEdit={startEdit} 
            askDelete={askDelete}
            selectedOrders={selectedOrders}
            setSelectedOrders={setSelectedOrders} 
            managedCols={managedCols}
          />
        </div>
      )}

      <ColumnsManagerModal
        isOpen={isColModalOpen}
        onClose={() => setIsColModalOpen(false)}
        columns={managedCols}
        onSave={handleSaveColumns}
        storageKey="orders_columns_managed"
        defaultColumns={defaultOrdersColumns}
      />

      {/* SMS DISPATCH LOG LOGGER POPUP */}
      <SMSLogsModal
        isOpen={showSMSLogs}
        onClose={() => setShowSMSLogs(false)}
        smsLogs={smsLogs}
      />

      <AssignDriverModal
        isOpen={showAssignDriverModal}
        onClose={() => setShowAssignDriverModal(false)}
        onSave={(driverId, companionId, truckPlate) => {
          selectedOrders.forEach(id => {
            const ord = orders.find(o => o.id === id);
            if (ord) {
              onSave({
                ...ord,
                driver_id: driverId,
                companion_id: companionId,
                truck_plate: truckPlate,
                status: 'driver_assigned'
              });
            }
          });
          setSelectedOrders([]);
        }}
        orders={selectedOrders.map(id => orders.find(o => o.id === id)!).filter(Boolean)}
        employees={employees}
        trucks={trucks}
        suppliers={suppliers}
        warehouses={warehouses}
      />

      {/* SYSTEM CONFIRMATION DELETE MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmId}
        onClose={() => {
          setDeleteConfirmId(null);
          setDeleteConfirmDocNum(null);
        }}
        onConfirm={confirmDelete}
        title={t("Cancel & Delete Order?")}
        message={
          <span>
            {t("Are you sure you want to completely cancel and soft delete high-priority order dispatch")} <strong>"{deleteConfirmDocNum}"</strong>? {t("They will hide from the UI immediately.")}
          </span>
        }
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border shadow-lg p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">{t("Confirm Bulk Orders Deleted")}</h4>
              <p className="text-[11.5px] text-gray-450 mt-2 font-sans leading-normal">
                {t("Are you sure you want to soft delete")} <strong>{selectedOrders.length} {t("selected orders")}</strong>? {t("They will hide from the UI immediately.")}
              </p>
            </div>
            <div className="flex gap-2 font-sans pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 border hover:bg-slate-50 text-xs font-bold text-gray-600 rounded-xl cursor-pointer"
              >
                {t("No, Keep Them")}
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteExecute}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-black text-white rounded-xl cursor-pointer"
              >
                {t("Yes, Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
