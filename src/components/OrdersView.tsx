import React, { useState, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../types';
import { getSMSLogs } from '../lib/db';
import { 
  Plus, Search, Edit2, MessageSquareCode, 
  Trash2
} from 'lucide-react';

// Modular child components
import OrderForm from './orders/OrderForm';
import SMSLogsModal from './orders/SMSLogsModal';
import OrderDeleteModal from './orders/OrderDeleteModal';

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
      <div className="-mt-4 -mx-4 md:-mt-6 md:-mx-6 mb-6">
        <div className="sticky -top-4 md:-top-6 z-20 bg-[#f8fafc]/95 backdrop-blur-md py-4 px-4 md:px-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left shadow-xs">
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

          {/* SPREADSHEET TABLE */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-700">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] text-gray-400 uppercase font-mono bg-slate-50 select-none">
                    <th className="py-3 px-4">Document #</th>
                    <th className="py-3 px-4">Supplier / Vendor</th>
                    <th className="py-3 px-4">Base Destination</th>
                    <th className="py-3 px-4">QTY (Planned / Actual)</th>
                    <th className="py-3 px-4">Tanks (Drop / Pick)</th>
                    <th className="py-3 px-4">Assigned Crew</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((ord) => {
                    const supplierObj = suppliers.find(s => s.id === ord.vendor_id);
                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-955">
                          {ord.doc_number}
                          <span className="text-[9px] text-gray-400 block font-normal">{new Date(ord.order_date).toLocaleDateString('en-US')}</span>
                        </td>
                        
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-gray-800 block text-[12.5px]">
                            {supplierObj ? supplierObj.trade_name : (ord.vendor_name || 'Dispatched supplier')}
                          </span>
                          {ord.note && (
                            <span className="text-[10px] text-amber-700 block bg-amber-50 rounded px-1.5 py-0.5 w-fit font-mono mt-1 font-semibold leading-normal">
                              {ord.note}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-gray-600 font-sans font-medium">
                          {ord.warehouse_name || 'Unassigned Destination'}
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <span className="text-gray-550 font-medium">{ord.qty_requested} L.</span>
                          {ord.qty_actual !== undefined && (
                            <span className="text-emerald-800 font-black text-[11.5px] block">→ {ord.qty_actual} L. (Actual)</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-medium">
                          <span>Drop: {ord.tanks_to_leave} | Pick: {ord.tanks_to_bring}</span>
                          {ord.tanks_left_actual !== undefined && (
                            <span className="text-indigo-800 block font-bold">Placed: {ord.tanks_left_actual} | Picked: {ord.tanks_bring_actual}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-gray-655 font-sans">
                          <span className="block font-extrabold text-[11px] text-slate-800 leading-none">🚗 Driver: {ord.driver_name || 'None Assigned'}</span>
                          <span className="text-[10px] block text-gray-400 mt-1 leading-none">👥 Co-Driver: {ord.companion_name || 'None Assigned'}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit ${
                            ord.status === 'registered' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                            ord.status === 'scheduled' ? 'bg-[#e0f2fe] text-[#0369a1]' :
                            ord.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' :
                            'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {ord.status === 'registered' ? 'Registered' :
                             ord.status === 'scheduled' ? 'Scheduled' :
                             ord.status === 'completed' ? 'Completed' :
                             'Cancelled'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 select-none font-sans font-bold">
                            <button 
                              onClick={() => startEdit(ord)}
                              className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                              title="Modify details / crew"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button 
                              onClick={() => askDelete(ord.id, ord.doc_number)}
                              className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                              title="Delete dispatch log"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredOrders.length === 0 && (
              <div className="text-center py-20 text-xs text-gray-400 font-sans italic">
                No active collection order entries were located.
              </div>
            )}
          </div>
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
