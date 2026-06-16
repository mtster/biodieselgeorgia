import React, { useState, useEffect, useRef } from 'react';
import { Order, Vendor, Warehouse, User, Truck } from '../../types';
import { getSMSLogs } from '../../lib/db';
import { 
  Plus, Search, Trash2, ArrowLeft
} from 'lucide-react';

// Modular child components
import OrderForm from '../orders/OrderForm';
import SMSLogsModal from '../orders/SMSLogsModal';
import OrderDeleteModal from '../orders/OrderDeleteModal';
import OrdersList from '../orders/OrdersList';

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

  // Active form management
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showSMSLogs, setShowSMSLogs] = useState(false);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);

  // Bulk-delete selection states
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmDocNum, setDeleteConfirmDocNum] = useState<string | null>(null);

  // Action triggers for child forms
  const formRef = useRef<{ save: () => void; fillDummy: () => void }>(null);

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
      qty_actual: undefined,
      tanks_to_leave: 1,
      tanks_to_bring: 1,
      tanks_left_actual: undefined,
      tanks_bring_actual: undefined,
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
    return matchesSearch && matchesStatus;
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

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-4 bg-[#f8fafc]/95 backdrop-blur-md border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left shadow-xs mb-6">
        <div className="flex items-center">
          {editingOrder && (
            <button
              onClick={() => setEditingOrder(null)}
              className="p-2 mr-3 hover:bg-slate-105 rounded-xl transition cursor-pointer text-gray-600 flex items-center justify-center border border-transparent hover:border-gray-200"
              title="Go Back"
              id="order-form-back-arrow"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Orders</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {editingOrder ? (
            <>
              {editingOrder.id && (
                <button 
                  onClick={() => {
                    askDelete(editingOrder.id, editingOrder.doc_number);
                  }}
                  className="px-4 py-2 hover:bg-red-50 text-red-650 border border-transparent hover:border-red-200 font-bold rounded-xl text-xs transition cursor-pointer select-none flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
              <button 
                onClick={() => {
                  formRef.current?.fillDummy();
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-705 transition cursor-pointer select-none"
              >
                Fill Dummy
              </button>
              <button 
                onClick={() => {
                  formRef.current?.save();
                }}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
              >
                Save
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
                    }
                    e.target.value = ''; // Reset select trigger
                  }}
                  className="px-3.5 py-2.5 pr-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-gray-200 cursor-pointer select-none focus:outline-none appearance-none font-sans"
                >
                  <option value="" disabled hidden>Actions</option>
                  <option value="sms_logs">SMS Logs ({smsLogs.length})</option>
                  <option value="delete" disabled={selectedOrders.length === 0}>
                    Delete {selectedOrders.length > 0 ? `(${selectedOrders.length})` : ''}
                  </option>
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
                New Order
              </button>
            </>
          )}
        </div>
      </div>

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
          <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-sm select-none font-sans">
            
            {/* Search + Status inside a single unified compact block */}
            <div className="flex flex-col md:flex-row items-center gap-4">
              
              {/* Search input (flex-1) */}
              <div className="relative flex-1 w-full">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                  <Search size={15} />
                </span>
                <input 
                  id="orders-search"
                  type="text"
                  placeholder="Search dispatches by supplier trade name, legal entity, or document coordinate..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none transition-all font-sans text-gray-900"
                />
              </div>

              {/* Status dropdown on the right with outline label */}
              <div className="relative min-w-[145px] w-full md:w-auto">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-white select-none z-10 text-left font-sans uppercase tracking-wider">
                  Status
                </span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">All Statuses</option>
                  <option value="registered">Registered</option>
                  <option value="completed">Completed</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

            </div>
          </div>

          <OrdersList 
            filteredOrders={filteredOrders} 
            suppliers={suppliers} 
            employees={employees}
            startEdit={startEdit} 
            askDelete={askDelete}
            selectedOrders={selectedOrders}
            setSelectedOrders={setSelectedOrders} 
          />
        </div>
      )}

      {/* SMS DISPATCH LOG LOGGER POPUP */}
      <SMSLogsModal
        isOpen={showSMSLogs}
        onClose={() => setShowSMSLogs(false)}
        smsLogs={smsLogs}
      />

      {/* SYSTEM CONFIRMATION DELETE MODAL */}
      <OrderDeleteModal
        docNumber={deleteConfirmDocNum}
        onClose={() => {
          setDeleteConfirmId(null);
          setDeleteConfirmDocNum(null);
        }}
        onConfirm={confirmDelete}
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border shadow-lg p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">Confirm Bulk Orders Deleted</h4>
              <p className="text-[11.5px] text-gray-450 mt-2 font-sans leading-normal">
                Are you sure you want to soft delete <strong>{selectedOrders.length} selected orders</strong>? They will hide from the UI immediately.
              </p>
            </div>
            <div className="flex gap-2 font-sans pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 border hover:bg-slate-50 text-xs font-bold text-gray-600 rounded-xl cursor-pointer"
              >
                No, Keep Them
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteExecute}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-black text-white rounded-xl cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
