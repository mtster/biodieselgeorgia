import React, { useState, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../types';
import { getSMSLogs } from '../lib/db';
import { 
  Plus, Search, Edit2, MessageSquareCode, 
  Trash2, X, ShieldAlert
} from 'lucide-react';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSMSLogs, setShowSMSLogs] = useState(false);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);

  const loadSMSLogs = async () => {
    const data = await getSMSLogs();
    setSmsLogs(data);
  };

  useEffect(() => {
    loadSMSLogs();
  }, [orders]);

  const startNew = () => {
    setErrorMessage(null);
    const defaultOrder: Order = {
      id: '',
      order_date: new Date().toISOString().substring(0, 10),
      doc_number: 'DOC-' + Math.floor(100000 + Math.random() * 900000),
      vendor_id: suppliers[0]?.id || '',
      warehouse_id: warehouses[0]?.id || '',
      note: '',
      qty_requested: 50,
      qty_actual: undefined,
      tanks_to_leave: 1,
      tanks_to_bring: 1,
      tanks_left_actual: undefined,
      tanks_bring_actual: undefined,
      pickup_date_time: undefined,
      operator_id: currentEmployee.id,
      driver_id: employees.find(e => e.role === 'driver')?.id || '',
      companion_id: employees.find(e => e.role !== 'driver')?.id || '',
      truck_plate: trucks[0]?.plate_number || '',
      status: 'registered'
    };
    setEditingOrder(defaultOrder);
    setIsNew(true);
  };

  const startEdit = (ord: Order) => {
    setErrorMessage(null);
    setEditingOrder(JSON.parse(JSON.stringify(ord)));
    setIsNew(false);
  };

  const handleSaveAll = () => {
    if (!editingOrder) return;
    setErrorMessage(null);

    if (!editingOrder.vendor_id) {
      setErrorMessage('Please select a Supplier / Vendor.');
      return;
    }
    if (!editingOrder.doc_number.trim()) {
      setErrorMessage('Document number is required.');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === editingOrder.vendor_id);
    const warehouseObj = warehouses.find(w => w.id === editingOrder.warehouse_id);
    const operatorObj = employees.find(e => e.id === editingOrder.operator_id);
    const driverObj = employees.find(e => e.id === editingOrder.driver_id);
    const companionObj = employees.find(e => e.id === editingOrder.companion_id);

    const final: Order = {
      ...editingOrder,
      vendor_name: supplierObj?.trade_name || '',
      warehouse_name: warehouseObj?.name || '',
      user_name: operatorObj?.name || currentEmployee.name,
      driver_name: driverObj?.name || '',
      companion_name: companionObj?.name || ''
    };

    onSave(final);
    setEditingOrder(null);
  };

  const filteredOrders = orders.filter(ord => {
    if (ord.is_deleted) return false; // Hard rule: do not render soft deleted orders
    
    const supplierObj = suppliers.find(s => s.id === ord.vendor_id);
    const supplierName = supplierObj ? supplierObj.trade_name : (ord.vendor_name || '');
    const matchesSearch = supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ord.doc_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === '' || ord.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // architecture view replacement if form is visible
  if (editingOrder) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200" id="orders-form-panel">
        <div className="bg-white border rounded-2xl shadow-sm flex flex-col relative overflow-hidden max-w-2xl min-h-[500px]">
          
          {/* Sticky header containing Action with Cancel & Save */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100 py-3.5 px-6 flex justify-between items-center select-none">
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm font-sans tracking-tight">
                {isNew ? '✨ Creating order' : `✏️ Editing: Order #${editingOrder.doc_number}`}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5 font-sans">
                {isNew ? 'Define collection parameters to assign driver crew' : `Update dispatch constraints and save changes`}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2 bg-white border border-gray-250 hover:bg-slate-55 font-bold rounded-xl text-xs text-gray-750 transition cursor-pointer select-none"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
              >
                Save
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-sans font-medium">
                <ShieldAlert size={14} className="text-red-650" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Relaxed Top-to-Bottom single column workflow */}
            <div className="space-y-5 max-w-xl">
              
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider block">1. Core Transaction Details</h4>

              {/* Supplier Dropdown - Notch styling */}
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                  Supplier / Vendor Restaurant *
                </span>
                <select
                  value={editingOrder.vendor_id}
                  onChange={(e) => setEditingOrder({...editingOrder, vendor_id: e.target.value})}
                  className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                >
                  <option value="" disabled>--- SELECT SUPPLIER ---</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.trade_name} (ID: {s.id_code})</option>
                  ))}
                </select>
              </div>

              {/* Destination storage dropdown - Notch styling */}
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                  Base Destination Warehouse *
                </span>
                <select
                  value={editingOrder.warehouse_id}
                  onChange={(e) => setEditingOrder({...editingOrder, warehouse_id: e.target.value})}
                  className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Document ID - Notch input */}
                <div className="relative">
                  <input 
                    type="text"
                    id="order-doc-number"
                    placeholder=" "
                    value={editingOrder.doc_number}
                    onChange={(e) => setEditingOrder({...editingOrder, doc_number: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono font-bold transition-all"
                  />
                  <label 
                    htmlFor="order-doc-number" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                  >
                    Document Dispatch ID *
                  </label>
                </div>

                {/* Dispatch Date - Notch input */}
                <div className="relative">
                  <input 
                    type="date"
                    id="order-dispatch-date"
                    value={editingOrder.order_date}
                    onChange={(e) => setEditingOrder({...editingOrder, order_date: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                  />
                  <label 
                    htmlFor="order-dispatch-date" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 pointer-events-none font-bold select-none"
                  >
                    Order Dispatch Date *
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Planned Volume input - Notch input */}
                <div className="relative">
                  <input 
                    type="number"
                    id="order-planned-qty"
                    placeholder=" "
                    value={editingOrder.qty_requested}
                    onChange={(e) => setEditingOrder({...editingOrder, qty_requested: parseFloat(e.target.value) || 0})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                  />
                  <label 
                    htmlFor="order-planned-qty" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                  >
                    Planned QTY (L)
                  </label>
                </div>

                {/* Tanks dropoff - Notch input */}
                <div className="relative">
                  <input 
                    type="number"
                    id="order-tanks-drop"
                    placeholder=" "
                    value={editingOrder.tanks_to_leave}
                    onChange={(e) => setEditingOrder({...editingOrder, tanks_to_leave: parseInt(e.target.value) || 0})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                  />
                  <label 
                    htmlFor="order-tanks-drop" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                  >
                    Tanks Dropoff
                  </label>
                </div>

                {/* Tanks pickup - Notch input */}
                <div className="relative">
                  <input 
                    type="number"
                    id="order-tanks-pick"
                    placeholder=" "
                    value={editingOrder.tanks_to_bring}
                    onChange={(e) => setEditingOrder({...editingOrder, tanks_to_bring: parseInt(e.target.value) || 0})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                  />
                  <label 
                    htmlFor="order-tanks-pick" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                  >
                    Tanks Pickup
                  </label>
                </div>
              </div>

              {/* Status Selector - Notch style */}
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-[#0369a1] bg-white select-none z-10 font-sans">
                  Fulfillment Status *
                </span>
                <select
                  value={editingOrder.status}
                  onChange={(e) => {
                    const statusVal = e.target.value as OrderStatus;
                    setEditingOrder({
                      ...editingOrder,
                      status: statusVal,
                      pickup_date_time: statusVal === 'completed' ? new Date().toISOString() : undefined
                    });
                  }}
                  className="block w-full px-3.5 py-3 text-xs bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd] rounded-xl focus:outline-none cursor-pointer font-bold relative"
                >
                  <option value="registered">Registered</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Completed Logistics Data subform fields */}
              {editingOrder.status === 'completed' && (
                <div className="bg-emerald-55/10 bg-emerald-50/20 p-5 border border-emerald-250 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-150">
                  <span className="text-[10px] font-black uppercase text-emerald-850 tracking-wider font-mono block">Actual Delivered Logistics data</span>
                  
                  <div className="relative">
                    <input 
                      type="number"
                      required
                      id="actual-vol-liters"
                      placeholder=" "
                      value={editingOrder.qty_actual || ''}
                      onChange={(e) => setEditingOrder({...editingOrder, qty_actual: parseFloat(e.target.value) || 0})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-905 bg-white border border-emerald-305 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                    />
                    <label 
                      htmlFor="actual-vol-liters" 
                      className="absolute text-[10px] text-emerald-800 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 font-bold select-none pointer-events-none"
                    >
                      Actual Volume Received (Liters) *
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <input 
                        type="number"
                        id="actual-tanks-left"
                        placeholder=" "
                        value={editingOrder.tanks_left_actual !== undefined ? editingOrder.tanks_left_actual : ''}
                        onChange={(e) => setEditingOrder({...editingOrder, tanks_left_actual: parseInt(e.target.value) || 0})}
                        className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-905 bg-white border border-emerald-305 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                      />
                      <label 
                        htmlFor="actual-tanks-left" 
                        className="absolute text-[10px] text-emerald-800 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 font-bold select-none pointer-events-none"
                      >
                        Actual Placed Tanks *
                      </label>
                    </div>

                    <div className="relative">
                      <input 
                        type="number"
                        id="actual-tanks-picked"
                        placeholder=" "
                        value={editingOrder.tanks_bring_actual !== undefined ? editingOrder.tanks_bring_actual : ''}
                        onChange={(e) => setEditingOrder({...editingOrder, tanks_bring_actual: parseInt(e.target.value) || 0})}
                        className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-905 bg-white border border-emerald-305 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                      />
                      <label 
                        htmlFor="actual-tanks-picked" 
                        className="absolute text-[10px] text-emerald-800 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 font-bold select-none pointer-events-none"
                      >
                        Actual Picked Tanks *
                      </label>
                    </div>
                  </div>

                  <p className="text-[10px] text-amber-800 font-bold font-mono">
                    * Note: Completing an order triggers immediate SMS confirmation alerts dispatching to local accounting gates!
                  </p>
                </div>
              )}

              {/* Handover comments / Navigation note - Notch input */}
              <div className="relative">
                <input 
                  type="text"
                  id="order-location-note"
                  placeholder=" "
                  value={editingOrder.note || ''}
                  onChange={(e) => setEditingOrder({...editingOrder, note: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans transition-all"
                />
                <label 
                  htmlFor="order-location-note" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                >
                  Handover Comments / Navigation Note on Location
                </label>
              </div>

              {/* Crew and Fleet Dispatch Assignments section wrapper - PLACED AT THE BOTTOM as requested! */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4.5">
                <div>
                  <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">2. Operations Vehicle Crew</h4>
                  <p className="text-[10px] text-gray-400 font-sans">Assign fleet driver and operational co-driver asset for physical collection logistics.</p>
                </div>

                {/* Driver select - Notch dropdown */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                    Assigned Fleet Driver
                  </span>
                  <select
                    value={editingOrder.driver_id}
                    onChange={(e) => setEditingOrder({...editingOrder, driver_id: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                  >
                    <option value="">-- No Driver Assigned --</option>
                    {employees.filter(e => e.role === 'driver').map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                {/* Co-Driver helper select - Notch dropdown */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                    Operations Dispatcher / Co-Driver Helper
                  </span>
                  <select
                    value={editingOrder.companion_id}
                    onChange={(e) => setEditingOrder({...editingOrder, companion_id: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                  >
                    <option value="">-- No companion helper assigned --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                </div>

                {/* Truck asset - Notch dropdown */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                    Assigned Vehicle Plate Asset
                  </span>
                  <select
                    value={editingOrder.truck_plate}
                    onChange={(e) => setEditingOrder({...editingOrder, truck_plate: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                  >
                    <option value="">-- No truck fleet asset --</option>
                    {trucks.map(t => (
                      <option key={t.plate_number} value={t.plate_number}>{t.plate_number} ({t.model})</option>
                    ))}
                  </select>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    );
  }

  // default primary view showing search dispatches and orders grid
  return (
    <div className="space-y-6" id="orders-view-panel">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 tracking-tight font-sans">Collection Orders</h2>
          <p className="text-xs text-gray-550 mt-1 font-sans">Oil collection progress, driver assignments, and warehouses routing.</p>
        </div>

        <div className="flex items-center gap-2 font-sans select-none">
          <button 
            onClick={() => {
              loadSMSLogs();
              setShowSMSLogs(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-xl text-xs font-bold text-gray-700 transition cursor-pointer shadow-3xs"
          >
            <MessageSquareCode size={15} className="text-emerald-700 animate-pulse" />
            SMS Dispatch Logs ({smsLogs.length})
          </button>
          
          <button 
            onClick={startNew}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            New Order
          </button>
        </div>
      </div>

      {/* FILTERS & STATUS CONTROL */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4.5 shadow-xs flex flex-col md:flex-row gap-3 select-none">
        
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search size={15} />
          </span>
          <input 
            id="orders-search"
            type="text"
            placeholder="Search dispatches by supplier trade name, legal entity, or document coordinate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans transition"
          />
        </div>

        <div className="w-full md:w-56 flex gap-2 font-sans">
          <button 
            onClick={() => setSelectedStatus('')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
              selectedStatus === '' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          <button 
            onClick={() => setSelectedStatus('registered')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
              selectedStatus === 'registered' ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-50 text-gray-650 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Registered
          </button>
          <button 
            onClick={() => setSelectedStatus('completed')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
              selectedStatus === 'completed' ? 'bg-emerald-650 text-white border-emerald-650' : 'bg-gray-50 text-gray-655 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Completed
          </button>
        </div>

      </div>

      {/* ORDERS GRID */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase font-mono bg-gray-50 select-none">
                <th className="py-3 px-4">Document #</th>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Destination Storage</th>
                <th className="py-3 px-4">QTY (Planned / Actual)</th>
                <th className="py-3 px-4">Tanks (Dropoff / Pickup)</th>
                <th className="py-3 px-4">Assigned Crew</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.map((ord) => {
                const supplierObj = suppliers.find(s => s.id === ord.vendor_id);
                return (
                  <tr key={ord.id} className="hover:bg-gray-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-905">
                      {ord.doc_number}
                      <span className="text-[9px] text-gray-400 block font-normal">{new Date(ord.order_date).toLocaleDateString('en-US')}</span>
                    </td>
                    
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-gray-805 block">
                        {supplierObj ? supplierObj.trade_name : (ord.vendor_name || 'Dispatched supplier')}
                      </span>
                      {ord.note && (
                        <span className="text-[10px] text-amber-705 block bg-amber-50 rounded px-1.5 py-0.5 w-fit font-mono mt-1">
                          {ord.note}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-gray-600 font-sans">
                      {ord.warehouse_name || 'Unassigned Destination'}
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span className="text-gray-550">{ord.qty_requested} L.</span>
                      {ord.qty_actual !== undefined && (
                        <span className="text-emerald-700 font-black block">→ {ord.qty_actual} L. (Actual)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span>Drop: {ord.tanks_to_leave} | Pick: {ord.tanks_to_bring}</span>
                      {ord.tanks_left_actual !== undefined && (
                        <span className="text-indigo-700 block font-bold">Placed: {ord.tanks_left_actual} | Picked: {ord.tanks_bring_actual}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-gray-655 font-sans">
                      <span className="block font-bold text-[11px] text-slate-805 leading-none">🚗 Driver: {ord.driver_name || 'None Assigned'}</span>
                      <span className="text-[10px] block text-gray-400 mt-1 leading-none">👥 Co-Driver: {ord.companion_name || 'None Assigned'}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit ${
                        ord.status === 'registered' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                        ord.status === 'scheduled' ? 'bg-[#e0f2fe] text-[#0369a1]' :
                        ord.status === 'completed' ? 'bg-emerald-50 text-emerald-755 border border-emerald-150' :
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
                          onClick={() => onDelete(ord.id, ord.doc_number)}
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
          <div className="text-center py-20 text-xs text-gray-400">
            No active collection order entries were located.
          </div>
        )}
      </div>

      {/* SMS DISPATCH LOG LOGGER POPUP */}
      {showSMSLogs && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-150 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                <MessageSquareCode className="text-emerald-700 font-bold" size={17} />
                SMS Logs (Fulfillment Dispatches)
              </h3>
              <button onClick={() => setShowSMSLogs(false)} className="text-gray-400 hover:text-gray-655 cursor-pointer p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-gray-505 font-sans">
              System notifications auto-delivered to accounting logs upon successful driver pickup sequence:
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {smsLogs.map(sms => (
                <div key={sms.id} className="p-3 bg-slate-50 border border-slate-105 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono">
                    <span>{sms.recipient}</span>
                    <span>{new Date(sms.date_time).toLocaleString('en-US')}</span>
                  </div>
                  <p className="font-medium text-gray-800 font-sans">{sms.message}</p>
                  <span className="text-[9px] bg-emerald-50 text-emerald-850 px-1.5 py-0.5 rounded font-mono font-bold w-fit block">
                    {sms.status}
                  </span>
                </div>
              ))}

              {smsLogs.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-xs italic font-sans animate-pulse">
                  No notifications recorded.
                </div>
              )}
            </div>

            <div className="pt-2 border-t flex justify-end font-sans select-none">
              <button 
                onClick={() => setShowSMSLogs(false)}
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-750 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
