import React, { useState, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../types';
import { getSMSLogs } from '../lib/db';
import { 
  Plus, Search, Edit2, MessageSquareCode, 
  Trash2, X, ShieldAlert, Clock, Calendar
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

  // Custom Time & Date states for Priority UX
  const [pickupHour, setPickupHour] = useState('12');
  const [pickupMin, setPickupMin] = useState('00');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmDocNum, setDeleteConfirmDocNum] = useState<string | null>(null);

  const loadSMSLogs = async () => {
    const data = await getSMSLogs();
    setSmsLogs(data);
  };

  useEffect(() => {
    loadSMSLogs();
  }, [orders]);

  // Sync custom time picker fields when editingOrder changes
  useEffect(() => {
    if (editingOrder && editingOrder.pickup_date_time) {
      try {
        const d = new Date(editingOrder.pickup_date_time);
        if (!isNaN(d.getTime())) {
          setPickupHour(d.getHours().toString().padStart(2, '0'));
          setPickupMin(d.getMinutes().toString().padStart(2, '0'));
          setSelectedDay(d.getDate().toString());
          setSelectedMonth((d.getMonth() + 1).toString());
          
          // If date is different from today or yesterday, or explicit, toggle customization on
          const today = new Date();
          if (d.toDateString() !== today.toDateString()) {
            setUseCustomDate(true);
          } else {
            setUseCustomDate(false);
          }
        }
      } catch (e) {
        // Fallback default
      }
    } else {
      setPickupHour('12');
      setPickupMin('00');
      setUseCustomDate(false);
      setSelectedDay(new Date().getDate().toString());
      setSelectedMonth((new Date().getMonth() + 1).toString());
    }
  }, [editingOrder?.id, editingOrder?.status]);

  const startNew = () => {
    setErrorMessage(null);
    const defaultOrder: Order = {
      id: '',
      order_date: new Date().toISOString().substring(0, 10),
      doc_number: 'DOC-' + Math.floor(100000 + Math.random() * 900000),
      vendor_id: '', // Empty: do not prefill dropdowns
      warehouse_id: '', // Empty: do not prefill dropdowns
      note: '',
      qty_requested: 50,
      qty_actual: undefined,
      tanks_to_leave: 1,
      tanks_to_bring: 1,
      tanks_left_actual: undefined,
      tanks_bring_actual: undefined,
      pickup_date_time: undefined,
      operator_id: currentEmployee.id,
      driver_id: '', // Empty: do not prefill
      companion_id: '', // Empty: do not prefill
      truck_plate: '', // Empty: do not prefill
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
    if (!editingOrder.warehouse_id) {
      setErrorMessage('Please select a Base Destination Warehouse.');
      return;
    }
    if (!editingOrder.doc_number.trim()) {
      setErrorMessage('Document dispatch number is required.');
      return;
    }
    if (!editingOrder.driver_id) {
      setErrorMessage('Please select an Assigned Fleet Driver.');
      return;
    }
    if (!editingOrder.truck_plate) {
      setErrorMessage('Please select an Assigned Vehicle Plate Asset.');
      return;
    }

    // Build the pickup date and time ISO values if completed or filled
    let finalOrder = { ...editingOrder };
    if (finalOrder.status === 'completed') {
      const year = new Date().getFullYear();
      const finalDate = new Date();
      if (useCustomDate) {
        finalDate.setFullYear(year, parseInt(selectedMonth) - 1, parseInt(selectedDay));
      }
      finalDate.setHours(parseInt(pickupHour), parseInt(pickupMin), 0, 0);
      finalOrder.pickup_date_time = finalDate.toISOString();

      if (finalOrder.qty_actual === undefined || finalOrder.qty_actual <= 0) {
        setErrorMessage('Please specify Actual Volume Received (Liters) for completed orders.');
        return;
      }
    }

    const supplierObj = suppliers.find(s => s.id === finalOrder.vendor_id);
    const warehouseObj = warehouses.find(w => w.id === finalOrder.warehouse_id);
    const operatorObj = employees.find(e => e.id === finalOrder.operator_id);
    const driverObj = employees.find(e => e.id === finalOrder.driver_id);
    const companionObj = employees.find(e => e.id === finalOrder.companion_id);

    const final: Order = {
      ...finalOrder,
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

  // Generate days array (1-31)
  const daysList = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
  
  // Months choices
  const monthsList = [
    { value: '1', name: 'January' },
    { value: '2', name: 'February' },
    { value: '3', name: 'March' },
    { value: '4', name: 'April' },
    { value: '5', name: 'May' },
    { value: '6', name: 'June' },
    { value: '7', name: 'July' },
    { value: '8', name: 'August' },
    { value: '9', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ];

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER */}
      <div className="sticky top-0 z-20 bg-[#f8fafc]/95 backdrop-blur-md pb-5 pt-3 -mt-4 -mx-4 px-4 md:-mt-6 md:-mx-6 md:px-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left mb-6 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Collection Orders</h2>
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
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 font-bold rounded-xl text-xs text-gray-700 transition cursor-pointer select-none"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
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
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-55 bg-slate-100 hover:bg-slate-200 text-slate-705 border rounded-xl text-xs font-bold text-gray-700 transition cursor-pointer select-none"
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
        <div className="animate-in fade-in duration-200 max-w-2xl text-left" id="orders-form-panel">
          {errorMessage && (
            <div className="mb-5 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-sans font-medium">
              <ShieldAlert size={14} className="text-red-650" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Layout: Relaxed, beautiful top-to-bottom vertical stack */}
          <div className="space-y-6">
            
            {/* Core parameters card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
              <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Core Transaction Details</span>
              
              {/* Supplier Dropdown - Notch styling */}
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                  Supplier / Vendor Restaurant *
                </span>
                <select
                  value={editingOrder.vendor_id}
                  onChange={(e) => setEditingOrder({...editingOrder, vendor_id: e.target.value})}
                  className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
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
                  className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
                >
                  <option value="" disabled>--- SELECT DESTINATION WAREHOUSE ---</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Document ID - Notch input */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                    Document Dispatch ID *
                  </span>
                  <input 
                    type="text"
                    id="order-doc-number"
                    value={editingOrder.doc_number}
                    onChange={(e) => setEditingOrder({...editingOrder, doc_number: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono font-bold transition-all"
                  />
                </div>

                {/* Dispatch Date - Notch input */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                    Order Dispatch Date *
                  </span>
                  <input 
                    type="date"
                    id="order-dispatch-date"
                    value={editingOrder.order_date}
                    onChange={(e) => setEditingOrder({...editingOrder, order_date: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs text-gray-950 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {/* Planned Volume input - Notch input */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                    Planned QTY (L)
                  </span>
                  <input 
                    type="number"
                    id="order-planned-qty"
                    value={editingOrder.qty_requested || ''}
                    onChange={(e) => setEditingOrder({...editingOrder, qty_requested: parseFloat(e.target.value) || 0})}
                    className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
                  />
                </div>

                {/* Tanks dropoff - Notch input */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                    Tanks Dropoff
                  </span>
                  <input 
                    type="number"
                    id="order-tanks-drop"
                    value={editingOrder.tanks_to_leave}
                    onChange={(e) => setEditingOrder({...editingOrder, tanks_to_leave: parseInt(e.target.value) || 0})}
                    className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
                  />
                </div>

                {/* Tanks pickup - Notch input */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                    Tanks Pickup
                  </span>
                  <input 
                    type="number"
                    id="order-tanks-pick"
                    value={editingOrder.tanks_to_bring}
                    onChange={(e) => setEditingOrder({...editingOrder, tanks_to_bring: parseInt(e.target.value) || 0})}
                    className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
                  />
                </div>
              </div>

              {/* Status Selector - Notch style */}
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-emerald-800 bg-white select-none z-10 font-sans">
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
                  className="block w-full px-3.5 py-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl focus:outline-none cursor-pointer font-bold relative"
                >
                  <option value="registered">Registered (Submitted)</option>
                  <option value="scheduled">Scheduled (Route Assigned)</option>
                  <option value="completed">Completed (Fulfill Data Locked)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Handover comments / Navigation note - Notch input */}
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                  Handover Comments / Navigation Note on Location
                </span>
                <input 
                  type="text"
                  id="order-location-note"
                  value={editingOrder.note || ''}
                  onChange={(e) => setEditingOrder({...editingOrder, note: e.target.value})}
                  className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
                />
              </div>
            </div>

            {/* HIGH-PRIORITY DATE & TIME PICKER PANEL FOR COMPLETED LOGISTICS */}
            {editingOrder.status === 'completed' && (
              <div className="bg-white border border-emerald-100 rounded-2xl p-6 space-y-5 animate-in slide-in-from-top-3 duration-150">
                <div className="border-b pb-2 flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-emerald-800 tracking-wider font-sans block">1. Fulfillment Clock & Calendar Details</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded">PRIORITY UX</span>
                </div>

                {/* Asking for TIME FIRST - Dropdowns with completely self-contained layouts */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                      <Clock size={12} className="text-emerald-700" /> Specify Pickup Time First *
                    </label>
                    <div className="flex gap-3 max-w-xs items-center font-mono">
                      {/* Hours selection */}
                      <select
                        value={pickupHour}
                        onChange={(e) => setPickupHour(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl text-sm font-extrabold focus:outline-none select-none text-center"
                      >
                        {Array.from({ length: 24 }).map((_, h) => {
                          const val = h.toString().padStart(2, '0');
                          return <option key={val} value={val}>{val} Hours</option>;
                        })}
                      </select>
                      
                      <span className="text-lg font-black text-emerald-800">:</span>
                      
                      {/* Minutes selection */}
                      <select
                        value={pickupMin}
                        onChange={(e) => setPickupMin(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl text-sm font-extrabold focus:outline-none select-none text-center"
                      >
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(val => (
                          <option key={val} value={val}>{val} Mins</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Toggle custom date - Date is secondary */}
                  <div className="pt-3 border-t border-gray-50 flex flex-col space-y-3.5">
                    <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl">
                      <div className="text-left">
                        <span className="text-xs font-bold text-gray-800 block">Override Standard Date Selection?</span>
                        <span className="text-[10px] text-gray-400 font-sans block">By default, order registers today's date context.</span>
                      </div>
                      
                      {/* iOS Toggle green switch */}
                      <button
                        type="button"
                        onClick={() => setUseCustomDate(!useCustomDate)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
                          useCustomDate ? 'bg-emerald-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-150 ease-in-out ${
                            useCustomDate ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Secondary Date dropdown elements if override toggled on */}
                    {useCustomDate && (
                      <div className="grid grid-cols-2 gap-3.5 max-w-sm pt-2 p-3 bg-slate-50 rounded-xl animate-in slide-in-from-top-1.5">
                        <div className="relative">
                          <span className="absolute -top-1.5 left-2 px-1 text-[8.5px] font-black text-gray-400 bg-slate-50 uppercase tracking-widest">Day</span>
                          <select
                            value={selectedDay}
                            onChange={(e) => setSelectedDay(e.target.value)}
                            className="block w-full px-3 py-2 bg-white border border-gray-205 focus:border-emerald-500 rounded-xl text-xs font-bold focus:outline-none"
                          >
                            {daysList.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>

                        <div className="relative">
                          <span className="absolute -top-1.5 left-2 px-1 text-[8.5px] font-black text-gray-400 bg-slate-50 uppercase tracking-widest">Month</span>
                          <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="block w-full px-3 py-2 bg-white border border-gray-205 focus:border-emerald-500 rounded-xl text-xs font-bold focus:outline-none"
                          >
                            {monthsList.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional actual logistical measurements */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t">
                  <div className="relative">
                    <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                      Actual Received (L) *
                    </span>
                    <input 
                      type="number"
                      required
                      id="actual-vol-liters"
                      value={editingOrder.qty_actual || ''}
                      onChange={(e) => setEditingOrder({...editingOrder, qty_actual: parseFloat(e.target.value) || 0})}
                      className="block w-full px-3.5 py-3 text-xs text-gray-950 bg-white border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                      Actual Placed Tanks *
                    </span>
                    <input 
                      type="number"
                      id="actual-tanks-left"
                      value={editingOrder.tanks_left_actual !== undefined ? editingOrder.tanks_left_actual : ''}
                      onChange={(e) => setEditingOrder({...editingOrder, tanks_left_actual: parseInt(e.target.value) || 0})}
                      className="block w-full px-3.5 py-3 text-xs text-gray-950 bg-white border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                    />
                  </div>

                  <div className="relative">
                    <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                      Actual Picked Tanks *
                    </span>
                    <input 
                      type="number"
                      id="actual-tanks-picked"
                      value={editingOrder.tanks_bring_actual !== undefined ? editingOrder.tanks_bring_actual : ''}
                      onChange={(e) => setEditingOrder({...editingOrder, tanks_bring_actual: parseInt(e.target.value) || 0})}
                      className="block w-full px-3.5 py-3 text-xs text-gray-950 bg-white border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Crew and Fleet Dispatch Assignments - Bottom of form */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5 pb-16">
              <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">2. Operations Vehicle Crew</span>
              
              {/* Driver select - Notch dropdown */}
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                  Assigned Fleet Driver *
                </span>
                <select
                  value={editingOrder.driver_id}
                  onChange={(e) => setEditingOrder({...editingOrder, driver_id: e.target.value})}
                  className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
                >
                  <option value="" disabled>--- SELECT DRIVER ---</option>
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
                  className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
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
                  Assigned Vehicle Plate Asset *
                </span>
                <select
                  value={editingOrder.truck_plate}
                  onChange={(e) => setEditingOrder({...editingOrder, truck_plate: e.target.value})}
                  className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
                >
                  <option value="" disabled>--- SELECT TRUCK PLATE ---</option>
                  {trucks.map(t => (
                    <option key={t.plate_number} value={t.plate_number}>{t.plate_number} ({t.model})</option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="space-y-6 text-left">
          {/* SEARCH & FILTERS CONTROLS */}
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
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-800 font-sans transition"
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

          {/* SPREADSHEET TABLE */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-700">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] text-gray-400 uppercase font-mono bg-slate-50 select-none">
                    <th className="py-3 px-4">Document #</th>
                    <th className="py-3 px-4">Supplier / Vendor</th>
                    <th className="py-3 px-4">Destination Storage</th>
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
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-950">
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
                            <span className="text-indigo-805 text-indigo-800 block font-bold">Placed: {ord.tanks_left_actual} | Picked: {ord.tanks_bring_actual}</span>
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
      {showSMSLogs && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                <MessageSquareCode className="text-emerald-700 font-bold" size={17} />
                SMS Logs (Fulfillment Dispatches)
              </h3>
              <button onClick={() => setShowSMSLogs(false)} className="text-gray-400 hover:text-gray-655 cursor-pointer p-1 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-gray-505 font-sans text-left">
              System notifications auto-delivered to accounting logs upon successful driver pickup sequence:
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {smsLogs.map(sms => (
                <div key={sms.id} className="p-3 bg-slate-50 border border-slate-105 rounded-xl space-y-1 text-xs text-left">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono">
                    <span>{sms.recipient}</span>
                    <span>{new Date(sms.date_time).toLocaleString('en-US')}</span>
                  </div>
                  <p className="font-medium text-gray-800 font-sans">{sms.message}</p>
                  <span className="text-[9px] bg-emerald-50 text-emerald-850 px-1.5 py-0.5 rounded font-mono font-bold w-fit block border border-emerald-100">
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
                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-250 text-gray-750 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            
            <div className="space-y-1.5 text-center">
              <h3 className="font-extrabold text-sm text-gray-950">Remove Order Log?</h3>
              <p className="text-xs text-gray-450 leading-relaxed font-sans">
                Are you sure you want to delete order dispatch invoice <strong>"#{deleteConfirmDocNum}"</strong>? This dispatch logistics sequence will be expunged.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2 select-none">
              <button 
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmDocNum(null);
                }} 
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
