import React, { useState, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../../types';
import { getSMSLogs } from '../../lib/db';
import { 
  Plus, Search, Edit2, MessageSquareCode, 
  Trash2
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

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmDocNum, setDeleteConfirmDocNum] = useState<string | null>(null);

  // Action triggers for child forms
  const [formSubmitTrigger, setFormSubmitTrigger] = useState<(() => void) | null>(null);
  const [formDummyTrigger, setFormDummyTrigger] = useState<(() => void) | null>(null);

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
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Orders</h2>
          <p className="text-xs text-gray-550 mt-1 font-sans">
              {editingOrder 
                ? (isNew ? 'Creating order' : `Editing: Order #${editingOrder.doc_number}`)
                : 'Oil collection progress, driver assignments, and warehouses routing.'
              }
            </p>
          </div>

          <div className="flex items-center gap-3">
            {editingOrder ? (
              <>
                <button 
                  onClick={() => {
                    if (formDummyTrigger) formDummyTrigger();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-700 transition cursor-pointer select-none"
                >
                  Fill Dummy
                </button>
                <button 
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 font-bold rounded-xl text-xs text-gray-700 transition cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (formSubmitTrigger) formSubmitTrigger();
                  }}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
                >
                  Save
                </button>
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
          onRegisterTriggers={(triggers) => {
            setFormSubmitTrigger(() => triggers.save);
            setFormDummyTrigger(() => triggers.fillDummy);
          }}
        />
      ) : (
        <div className="space-y-6 text-left">
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4 select-none">
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
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none transition-all font-sans"
              />
            </div>

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

          <OrdersList 
            filteredOrders={filteredOrders} 
            suppliers={suppliers} 
            startEdit={startEdit} 
            askDelete={askDelete} 
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

    </div>
  );
}
