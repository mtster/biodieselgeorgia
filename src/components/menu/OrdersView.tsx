import React, { useState, useEffect, useRef } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../../types';
import { getSMSLogs } from '../../lib/db';
import { 
  Plus, Search, Edit2, MessageSquareCode, 
  Trash2, ArrowLeft
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

  // Read-only and bulk-delete selection states
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
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
    setIsReadOnly(false);
  };

  const startEdit = (ord: Order, readOnly = false) => {
    setEditingOrder(JSON.parse(JSON.stringify(ord)));
    setIsNew(false);
    setIsReadOnly(readOnly);
  };

  const handleBulkDeleteExecute = () => {
    selectedOrders.forEach(id => {
      const ord = orders.find(o => o.id === id);
      onDelete(id, ord?.doc_number || '');
    });
    setSelectedOrders([]);
    setIsSelectionMode(false);
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
              className="p-2 mr-3 hover:bg-slate-100 rounded-xl transition cursor-pointer text-gray-600 flex items-center justify-center border border-transparent hover:border-gray-200"
              title="Go Back"
              id="order-form-back-arrow"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Orders</h2>
            <p className="text-xs text-gray-550 mt-1 font-sans">
              {editingOrder 
                ? (isNew ? 'Creating order' : `Editing: Order #${editingOrder.doc_number}`)
                : 'Oil collection progress, driver assignments, and warehouses routing.'
              }
            </p>
          </div>
        </div>

          <div className="flex items-center gap-3">
            {editingOrder ? (
              <>
                {!isReadOnly && (
                  <button 
                    onClick={() => {
                      formRef.current?.fillDummy();
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-700 transition cursor-pointer select-none"
                  >
                    Fill Dummy
                  </button>
                )}
                {!isReadOnly ? (
                  <button 
                    onClick={() => {
                      formRef.current?.save();
                    }}
                    className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
                  >
                    Save
                  </button>
                ) : (
                  <button 
                    onClick={() => setEditingOrder(null)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold rounded-xl text-xs transition cursor-pointer select-none animate-pulse"
                  >
                    Viewing Mode
                  </button>
                )}
              </>
            ) : (
              <>
                <button 
                  onClick={() => {
                    loadSMSLogs();
                    setShowSMSLogs(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-755 border rounded-xl text-xs font-bold text-gray-705 transition cursor-pointer select-none"
                >
                  <MessageSquareCode size={15} className="text-emerald-700 animate-pulse" />
                  SMS Dispatch Logs ({smsLogs.length})
                </button>
                
                <button 
                  onClick={startNew}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition shadow-sm cursor-pointer select-none"
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
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3.5 select-none">
            
            <div className="flex gap-3">
              <div className="flex-1 relative">
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

              {/* Action Dropdown on the right */}
              <div className="relative shrink-0">
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'delete') {
                      setIsSelectionMode(true);
                    }
                    e.target.value = ''; // Reset select trigger
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold border border-gray-200 cursor-pointer focus:outline-none h-full transition-colors flex items-center"
                  defaultValue=""
                >
                  <option value="" disabled hidden>Actions</option>
                  <option value="delete">🗑️ Bulk Select & Delete</option>
                </select>
              </div>
            </div>

            {/* Selection Status Banner */}
            {isSelectionMode && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-xs animate-in slide-in-from-top-2 duration-150">
                <div className="font-semibold text-amber-800">
                  Bulk Delete Mode active: <strong className="font-black text-amber-955 font-mono">{selectedOrders.length} Orders Selected</strong>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedOrders([]);
                    }}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg font-bold text-gray-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedOrders.length === 0) {
                        alert('Please select at least one order row.');
                        return;
                      }
                      setShowBulkDeleteConfirm(true);
                    }}
                    className="px-3.5 py-1.5 bg-red-650 hover:bg-red-750 text-white rounded-lg font-black"
                  >
                    Delete Selected ({selectedOrders.length})
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-full md:w-64 flex gap-2 font-sans shrink-0">
              <button 
                onClick={() => setSelectedStatus('')}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                  selectedStatus === '' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-gray-50 text-gray-650 border-gray-205 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setSelectedStatus('registered')}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                  selectedStatus === 'registered' ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-50 text-gray-650 border-gray-205 hover:bg-gray-100'
                }`}
              >
                Registered
              </button>
              <button 
                onClick={() => setSelectedStatus('completed')}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                  selectedStatus === 'completed' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-gray-50 text-gray-655 border-gray-205 hover:bg-gray-100'
                }`}
              >
                Completed
              </button>
            </div>
          </div>
        </div>

        <OrdersList 
            filteredOrders={filteredOrders} 
            suppliers={suppliers} 
            employees={employees}
            startEdit={startEdit} 
            askDelete={askDelete}
            isSelectionMode={isSelectionMode}
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
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto animate-bounce">
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
                className="flex-1 py-2 border hover:bg-slate-50 text-xs font-bold text-gray-600 rounded-xl"
              >
                No, Keep Them
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteExecute}
                className="flex-1 py-2 bg-red-650 hover:bg-red-750 text-xs font-black text-white rounded-xl"
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
