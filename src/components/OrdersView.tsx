import React, { useState, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../types';
import { getSMSLogs } from '../lib/db';
import { 
  Plus, Search, Edit2, CheckCircle2, 
  MessageSquareCode, Calendar, Trash2, X, Check,
  User as UserIcon, TruckIcon, Fuel, ClipboardList, Info, ShieldAlert
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
    // Smooth scroll down to form
    setTimeout(() => {
      document.getElementById('order-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const startEdit = (ord: Order) => {
    setErrorMessage(null);
    setEditingOrder(JSON.parse(JSON.stringify(ord)));
    setIsNew(false);
    setTimeout(() => {
      document.getElementById('order-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
    const supplierObj = suppliers.find(s => s.id === ord.vendor_id);
    const supplierName = supplierObj ? supplierObj.trade_name : (ord.vendor_name || '');
    const matchesSearch = supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ord.doc_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === '' || ord.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" id="orders-view-panel">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 tracking-tight font-sans">Collection Orders</h2>
          <p className="text-xs text-gray-500 mt-1">Oil collection progress, driver assignments, and warehouses routing.</p>
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

      {/* COMPACT ON-SCREEN FORM (COHESIVE INLINE LAYOUT) */}
      {editingOrder && (
        <div id="order-form-anchor" className="bg-white border rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200 border-emerald-300">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">
                {isNew ? '✨ Create New Oil Collection Dispatch' : `✏️ Edit Dispatch Order: #${editingOrder.doc_number}`}
              </h3>
              <p className="text-[11px] text-gray-400">All data directly synchronizes with mobile driver dashboards and accounting logs</p>
            </div>
            
            <button 
              onClick={() => setEditingOrder(null)}
              className="p-1 px-1.5 hover:bg-gray-100 rounded-lg text-gray-400 cursor-pointer transition select-none"
            >
              <X size={16} />
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-105 text-red-750 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert size={14} className="text-red-750" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Floating labels order form grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Main Form Fields */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4.5">
              
              {/* Floating select Supplier */}
              <div className="relative">
                <select
                  value={editingOrder.vendor_id}
                  onChange={(e) => setEditingOrder({...editingOrder, vendor_id: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.trade_name} (Tax code: {s.id_code})</option>
                  ))}
                </select>
                <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold">
                  Supplier / Vendor Restaurant *
                </label>
              </div>

              {/* Floating select Warehouse */}
              <div className="relative">
                <select
                  value={editingOrder.warehouse_id}
                  onChange={(e) => setEditingOrder({...editingOrder, warehouse_id: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold">
                  Base Destination Warehouse *
                </label>
              </div>

              {/* Floating label Doc Number */}
              <div className="relative">
                <input 
                  type="text"
                  value={editingOrder.doc_number}
                  onChange={(e) => setEditingOrder({...editingOrder, doc_number: e.target.value})}
                  placeholder=" "
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                />
                <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3. peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                  Document Dispatch ID *
                </label>
              </div>

              {/* Floating label Date picker */}
              <div className="relative">
                <input 
                  type="date"
                  value={editingOrder.order_date}
                  onChange={(e) => setEditingOrder({...editingOrder, order_date: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold">
                  Order Dispatch Date *
                </label>
              </div>

              {/* Planned Vol and Dropoff tanks */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input 
                    type="number"
                    value={editingOrder.qty_requested}
                    onChange={(e) => setEditingOrder({...editingOrder, qty_requested: parseFloat(e.target.value) || 0})}
                    placeholder=" "
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                    Planned QTY (L)
                  </label>
                </div>

                <div className="relative">
                  <input 
                    type="number"
                    value={editingOrder.tanks_to_leave}
                    onChange={(e) => setEditingOrder({...editingOrder, tanks_to_leave: parseInt(e.target.value) || 0})}
                    placeholder=" "
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                    Tanks Dropoff
                  </label>
                </div>
              </div>

              {/* Status and Pickup tanks */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input 
                    type="number"
                    value={editingOrder.tanks_to_bring}
                    onChange={(e) => setEditingOrder({...editingOrder, tanks_to_bring: parseInt(e.target.value) || 0})}
                    placeholder=" "
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                    Tanks Pickup
                  </label>
                </div>

                <div className="relative">
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
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-emerald-900 font-extrabold bg-emerald-50 border border-emerald-300 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="registered">Registered</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold font-sans">
                    Fulfillment Status *
                  </label>
                </div>
              </div>

              {/* Special actual properties when completed */}
              {editingOrder.status === 'completed' && (
                <div className="bg-emerald-50/20 p-4 border border-emerald-250 rounded-2xl col-span-1 sm:col-span-2 grid grid-cols-2 gap-4.5">
                  <span className="col-span-2 text-[10px] font-black uppercase text-emerald-800 tracking-wider font-mono">Actual Delivered Logistics data</span>
                  
                  <div className="relative">
                    <input 
                      type="number"
                      required
                      value={editingOrder.qty_actual || ''}
                      onChange={(e) => setEditingOrder({...editingOrder, qty_actual: parseFloat(e.target.value) || 0})}
                      placeholder=" "
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-905 bg-white border border-emerald-300 rounded-xl focus:outline-none"
                    />
                    <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold">
                      Actual Volume Received (L.) *
                    </label>
                  </div>

                  <div className="relative">
                    <input 
                      type="number"
                      value={editingOrder.tanks_bring_actual || ''}
                      onChange={(e) => setEditingOrder({...editingOrder, tanks_bring_actual: parseInt(e.target.value) || 0})}
                      placeholder=" "
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-905 bg-white border border-emerald-300 rounded-xl focus:outline-none"
                    />
                    <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold">
                      Actual Placed Tanks *
                    </label>
                  </div>

                  <p className="col-span-2 text-[10.5px] text-amber-800 font-bold font-mono">
                    * Note: Completing an order triggers immediate SMS confirmation alerts dispatching to local accounting gates!
                  </p>
                </div>
              )}

              {/* Note / Handover Comment */}
              <div className="relative col-span-1 sm:col-span-2">
                <input 
                  type="text"
                  placeholder=" "
                  value={editingOrder.note || ''}
                  onChange={(e) => setEditingOrder({...editingOrder, note: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                  Handover Comments / Navigation Note on Location
                </label>
              </div>

            </div>

            {/* Crew Assignments section */}
            <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4.5 space-y-4 flex flex-col justify-between">
              
              <div className="space-y-4">
                <span className="text-xs font-black text-indigo-805 uppercase tracking-widest block border-b pb-1">
                  2. Operations & Vehicle Crew
                </span>

                {/* Driver */}
                <div className="relative">
                  <select
                    value={editingOrder.driver_id}
                    onChange={(e) => setEditingOrder({...editingOrder, driver_id: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-905 bg-white border border-gray-250 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="">-- No Driver Assigned --</option>
                    {employees.filter(e => e.role === 'driver').map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  <label className="absolute text-[10px] text-indigo-700 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold select-none">
                    Assigned Fleet Driver
                  </label>
                </div>

                {/* Companion helper */}
                <div className="relative">
                  <select
                    value={editingOrder.companion_id}
                    onChange={(e) => setEditingOrder({...editingOrder, companion_id: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-950 bg-white border border-gray-250 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="">-- No companion --</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                  <label className="absolute text-[10px] text-indigo-700 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold select-none">
                    Operations Dispatcher / Co-Driver Helper
                  </label>
                </div>

                {/* Truck fleet asset selection */}
                <div className="relative">
                  <select
                    value={editingOrder.truck_plate}
                    onChange={(e) => setEditingOrder({...editingOrder, truck_plate: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-955 bg-white border border-gray-250 rounded-xl cursor-pointer focus:outline-none"
                  >
                    <option value="">-- No truck fleet asset --</option>
                    {trucks.map(t => (
                      <option key={t.plate_number} value={t.plate_number}>{t.plate_number} ({t.model})</option>
                    ))}
                  </select>
                  <label className="absolute text-[10px] text-indigo-700 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.5 pointer-events-none font-bold select-none">
                    Assigned Vehicle Plate Asset
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 mt-4 flex justify-end gap-2.5 select-none">
                <button 
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-1.5 bg-white border hover:bg-gray-50 border-gray-200 text-gray-700 rounded-xl text-xs font-bold leading-none cursor-pointer transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveAll}
                  className="px-5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-black shadow-xs hover:bg-emerald-900 transition leading-none cursor-pointer"
                >
                  Save Dispatch
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

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
              selectedStatus === 'completed' ? 'bg-emerald-650 text-white border-emerald-650' : 'bg-gray-50 text-gray-650 border-gray-200 hover:bg-gray-100'
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

                    <td className="py-3.5 px-4 text-gray-650 font-sans">
                      <span className="block font-bold text-[11px] text-slate-805 leading-none">🚗 Driver: {ord.driver_name || 'None Assigned'}</span>
                      <span className="text-[10px] block text-gray-400 mt-1 leading-none">👥 Dispatch Helper: {ord.companion_name || 'None Assigned'}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit ${
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
                          className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-gray-55 rounded-lg transition cursor-pointer"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-150">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                <MessageSquareCode className="text-emerald-700 font-bold" size={17} />
                SMS Logs (Fulfillment Dispatches)
              </h3>
              <button onClick={() => setShowSMSLogs(false)} className="text-gray-400 hover:text-gray-655 cursor-pointer p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-gray-500 font-sans">
              System notifications auto-delivered to accounting logs upon successful driver pickup sequence:
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {smsLogs.map(sms => (
                <div key={sms.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
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
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition"
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
