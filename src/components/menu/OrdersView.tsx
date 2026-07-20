import React, { useState, useEffect, useRef } from 'react';
import { Order, Vendor, Warehouse, User, Truck, Direction } from '../../types';
import { getSMSLogs } from '../../lib/db';
import { Plus, Trash2 } from 'lucide-react';
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
import { FormSelect } from '../FormInput';

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
  { id: 'note', label: 'Comment', visible: true },
  { id: 'address', label: 'Address', visible: true },
  { id: 'direction', label: 'Direction', visible: true },
  { id: 'city', label: 'City', visible: true },
  { id: 'district', label: 'District', visible: true },
  { id: 'truck_plate', label: 'Vehicle', visible: true },
  { id: 'driver_id', label: 'Driver', visible: true },
  { id: 'companion_id', label: 'Assistant', visible: true },
  { id: 'contacts', label: 'Contacts', visible: true }
];

interface Props {
  orders: Order[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  directions: Direction[];
  currentEmployee: User;
  onSave: (order: Order) => void;
  onDelete: (id: string, docNum: string) => void;
}

export default function OrdersView({ 
  orders, suppliers, warehouses, employees, trucks, directions,
  currentEmployee, onSave, onDelete 
}: Props) {
  
  const canAdd = currentEmployee?.role === 'admin' || currentEmployee?.permissions?.['orders']?.includes('add');
  const canModify = currentEmployee?.role === 'admin' || currentEmployee?.permissions?.['orders']?.includes('modify');
  const canDelete = currentEmployee?.role === 'admin' || currentEmployee?.permissions?.['orders']?.includes('delete');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedDirection, setSelectedDirection] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
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

  const scrollMainToTop = () => {
    setTimeout(() => {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }, 0);
  };

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
      qty_requested: undefined as any,
      fact_qty: undefined,
      tanks_to_leave: undefined as any,
      tanks_to_bring: undefined as any,
      fact_tank_dropoff: undefined,
      fact_tank_pickup: undefined,
      pickup_date_time: undefined,
      operator_id: currentEmployee.id,
      created_by: currentEmployee.id,
      driver_id: '',
      companion_id: '',
      truck_plate: '',
      status: 'registered'
    };
    setEditingOrder(defaultOrder);
    setIsNew(true);
    scrollMainToTop();
  };

  const startEdit = (ord: Order) => {
    setEditingOrder(JSON.parse(JSON.stringify(ord)));
    setIsNew(false);
    scrollMainToTop();
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

    // City Filter
    if (selectedCity && (!supplierObj || supplierObj.city !== selectedCity)) return false;

    // District Filter
    if (selectedDistrict && (!supplierObj || supplierObj.district !== selectedDistrict)) return false;

    // Direction Filter
    if (selectedDirection && (!supplierObj || supplierObj.direction_id !== selectedDirection)) return false;

    // Vehicle/Truck Filter
    if (selectedVehicle && ord.truck_plate !== selectedVehicle) return false;

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
            onClick={() => formRef.current?.fillDummy()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-700 transition cursor-pointer select-none"
          >
            {t("Fill Dummy")}
          </button>
          <button 
            onClick={() => formRef.current?.save()}
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
          
          {canAdd && (<button 
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition shadow-sm cursor-pointer select-none font-sans"
          >
            <Plus size={15} />
            {t("New Order")}
          </button>)}
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
          <div className="space-y-4 w-full">
            {/* Search Bar - Full Width on Top */}
            <div className="w-full">
              <CentralSearchBar 
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                idPrefix="orders-search"
                searchPlaceholder={t("Search dispatches by supplier trade name, legal entity, or document coordinate...")}
              />
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-4 w-full select-none font-sans">
              {/* Period Filter */}
              <div className="shrink-0">
                <PeriodFilter 
                  startDate={startDate} 
                  setStartDate={setStartDate} 
                  endDate={endDate} 
                  setEndDate={setEndDate} 
                />
              </div>

              {/* Status Filter */}
              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  {t("Status")}
                </span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Statuses")}</option>
                  <option value="registered">{t("Registered")}</option>
                  <option value="driver_assigned">{t("Driver Assigned")}</option>
                  <option value="completed">{t("Completed")}</option>
                  <option value="uncompleted">{t("uncompleted")}</option>
                  <option value="cancelled">{t("cancelled")}</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              {/* City Filter */}
              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  ქალაქი
                </span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedDistrict(''); // Reset district when city changes
                  }}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Cities")}</option>
                  {Array.from(new Set(suppliers.map(s => s.city).filter(Boolean))).sort().map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              {/* District Filter */}
              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  რაიონი
                </span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Districts")}</option>
                  {Array.from(
                    new Set(
                      suppliers
                        .filter(s => !selectedCity || s.city === selectedCity)
                        .map(s => s.district)
                        .filter(Boolean)
                    )
                  ).sort().map(dist => (
                    <option key={dist} value={dist}>{dist}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              {/* Direction Filter */}
              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  მიმართულება
                </span>
                <select
                  value={selectedDirection}
                  onChange={(e) => setSelectedDirection(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Directions")}</option>
                  {directions.map(dir => (
                    <option key={dir.id} value={dir.id}>{dir.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              {/* Vehicle Filter */}
              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  მანქანა
                </span>
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Vehicles")}</option>
                  {trucks.map(truck => (
                    <option key={truck.plate_number} value={truck.plate_number}>{truck.plate_number} ({truck.model})</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>
            </div>
          </div>

          <OrdersList currentEmployee={currentEmployee} 
            filteredOrders={filteredOrders} 
            suppliers={suppliers} 
            warehouses={warehouses}
            employees={employees}
            directions={directions}
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
              <p className="text-[11.5px] text-gray-455 mt-2 font-sans leading-normal">
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
