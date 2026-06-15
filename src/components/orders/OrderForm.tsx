import React, { useState, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../../types';
import { ShieldAlert, Clock } from 'lucide-react';

interface Props {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  currentEmployee: User;
  onSave: (order: Order) => void;
  onCancel: () => void;
}

export default function OrderForm({
  editingOrder,
  setEditingOrder,
  suppliers,
  warehouses,
  employees,
  trucks,
  currentEmployee,
  onSave,
  onCancel
}: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Time & Date states for Priority UX
  const [pickupHour, setPickupHour] = useState('12');
  const [pickupMin, setPickupMin] = useState('00');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  // Search state for autocomplete select
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

  // Sync custom time picker fields when editingOrder changes
  useEffect(() => {
    if (editingOrder.pickup_date_time) {
      try {
        const d = new Date(editingOrder.pickup_date_time);
        if (!isNaN(d.getTime())) {
          setPickupHour(d.getHours().toString().padStart(2, '0'));
          setPickupMin(d.getMinutes().toString().padStart(2, '0'));
          setSelectedDay(d.getDate().toString());
          setSelectedMonth((d.getMonth() + 1).toString());
          
          const today = new Date();
          if (d.toDateString() !== today.toDateString()) {
            setUseCustomDate(true);
          } else {
            setUseCustomDate(false);
          }
        }
      } catch (e) {
        // Fallback
      }
    } else {
      setPickupHour('12');
      setPickupMin('00');
      setUseCustomDate(false);
      setSelectedDay(new Date().getDate().toString());
      setSelectedMonth((new Date().getMonth() + 1).toString());
    }
  }, [editingOrder.id, editingOrder.status]);

  // Pre-fill vendorSearch term
  useEffect(() => {
    const vendorObj = suppliers.find(s => s.id === editingOrder.vendor_id);
    setVendorSearch(vendorObj ? vendorObj.trade_name : '');
  }, [editingOrder.vendor_id, suppliers]);

  const handleSaveAll = () => {
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

    // Build pickup date/time ISO values if completed
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
      operator_name: operatorObj?.name || currentEmployee.name,
      driver_name: driverObj?.name || '',
      companion_name: companionObj?.name || ''
    };

    onSave(final);
  };

  const daysList = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
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
    <div className="animate-in fade-in duration-200 max-w-2xl text-left" id="orders-form-panel">
      {errorMessage && (
        <div className="mb-5 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-sans font-medium">
          <ShieldAlert size={14} className="text-red-650" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Save & Cancel Quick Action Bar (Floating UX Style inside view) */}
      <div className="mb-4 flex items-center justify-end gap-2 sm:hidden">
        <button 
          onClick={onCancel}
          className="px-3.5 py-1.5 bg-white border border-gray-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-gray-750 transition"
        >
          Cancel
        </button>
        <button 
          onClick={handleSaveAll}
          className="px-4 py-1.5 bg-emerald-808 bg-emerald-800 text-white rounded-xl text-xs font-black transition"
        >
          Save
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
          <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Core Transaction Details</span>
          
          {/* Supplier Autocomplete Input - Notch styling */}
          <div className="relative" id="vendor-autocomplete-container">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
              Supplier / Vendor Restaurant *
            </span>
            <input
              type="text"
              placeholder=""
              value={vendorSearch}
              onChange={(e) => {
                setVendorSearch(e.target.value);
                setShowVendorSuggestions(true);
                if (e.target.value === '') {
                  setEditingOrder(prev => prev ? { ...prev, vendor_id: '' } : null);
                }
              }}
              onFocus={() => setShowVendorSuggestions(true)}
              className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans relative"
            />
            
            {showVendorSuggestions && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setShowVendorSuggestions(false)} 
                />
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-30 divide-y divide-gray-50">
                  {suppliers
                    .filter(s => {
                      const searchStr = vendorSearch.toLowerCase();
                      return s.trade_name.toLowerCase().includes(searchStr) || 
                             s.company_name.toLowerCase().includes(searchStr) || 
                             s.id_code.toLowerCase().includes(searchStr);
                    })
                    .map(s => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setEditingOrder(prev => prev ? { ...prev, vendor_id: s.id } : null);
                          setVendorSearch(s.trade_name);
                          setShowVendorSuggestions(false);
                        }}
                        className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer text-left transition duration-100"
                      >
                        <p className="text-xs font-bold text-gray-800">{s.trade_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.company_name} (ID: {s.id_code})</p>
                      </div>
                    ))
                  }
                  {suppliers.filter(s => {
                    const searchStr = vendorSearch.toLowerCase();
                    return s.trade_name.toLowerCase().includes(searchStr) || 
                           s.company_name.toLowerCase().includes(searchStr) || 
                           s.id_code.toLowerCase().includes(searchStr);
                  }).length === 0 && (
                    <div className="px-3.5 py-3 text-xs text-gray-400 italic">No suppliers found matching "{vendorSearch}"</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Destination storage dropdown */}
          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
              Base Destination Warehouse *
            </span>
            <select
              value={editingOrder.warehouse_id}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, warehouse_id: e.target.value } : null)}
              className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
            >
              <option value="" disabled></option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Document ID */}
            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Document Dispatch ID *
              </span>
              <input 
                type="text"
                value={editingOrder.doc_number}
                onChange={(e) => setEditingOrder(prev => prev ? { ...prev, doc_number: e.target.value } : null)}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono font-bold transition-all"
              />
            </div>

            {/* Dispatch Date */}
            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Order Dispatch Date *
              </span>
              <input 
                type="date"
                value={editingOrder.order_date}
                onChange={(e) => setEditingOrder(prev => prev ? { ...prev, order_date: e.target.value } : null)}
                className="block w-full px-3.5 py-3 text-xs text-gray-955 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Planned Volume */}
            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Planned QTY (L)
              </span>
              <input 
                type="number"
                value={editingOrder.qty_requested || ''}
                onChange={(e) => setEditingOrder(prev => prev ? { ...prev, qty_requested: parseFloat(e.target.value) || 0 } : null)}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>

            {/* Tanks dropoff */}
            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Tanks Dropoff
              </span>
              <input 
                type="number"
                value={editingOrder.tanks_to_leave}
                onChange={(e) => setEditingOrder(prev => prev ? { ...prev, tanks_to_leave: parseInt(e.target.value) || 0 } : null)}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>

            {/* Tanks pickup */}
            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Tanks Pickup
              </span>
              <input 
                type="number"
                value={editingOrder.tanks_to_bring}
                onChange={(e) => setEditingOrder(prev => prev ? { ...prev, tanks_to_bring: parseInt(e.target.value) || 0 } : null)}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>
          </div>

          {/* Status Selector */}
          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-emerald-800 bg-white select-none z-10 font-sans">
              Fulfillment Status *
            </span>
            <select
              value={editingOrder.status}
              onChange={(e) => {
                const statusVal = e.target.value as OrderStatus;
                setEditingOrder(prev => prev ? {
                  ...prev,
                  status: statusVal,
                  pickup_date_time: statusVal === 'completed' ? new Date().toISOString() : undefined
                } : null);
              }}
              className="block w-full px-3.5 py-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl focus:outline-none cursor-pointer font-bold relative"
            >
              <option value="registered">Registered (Submitted)</option>
              <option value="scheduled">Scheduled (Route Assigned)</option>
              <option value="completed">Completed (Fulfill Data Locked)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Handover comments */}
          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
              Handover Comments / Navigation Note on Location
            </span>
            <input 
              type="text"
              value={editingOrder.note || ''}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, note: e.target.value } : null)}
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

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5">
                  <Clock size={12} className="text-emerald-700" /> Specify Pickup Time First *
                </label>
                <div className="flex gap-3 max-w-xs items-center font-mono">
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

              <div className="pt-3 border-t border-gray-50 flex flex-col space-y-3.5">
                <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl">
                  <div className="text-left">
                    <span className="text-xs font-bold text-gray-800 block">Override Standard Date Selection?</span>
                    <span className="text-[10px] text-gray-400 font-sans block">By default, order registers today's date context.</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setUseCustomDate(!useCustomDate)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
                      useCustomDate ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-155 ease-in-out ${
                        useCustomDate ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t">
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                  Actual Received (L) *
                </span>
                <input 
                  type="number"
                  required
                  value={editingOrder.qty_actual || ''}
                  onChange={(e) => setEditingOrder(prev => prev ? { ...prev, qty_actual: parseFloat(e.target.value) || 0 } : null)}
                  className="block w-full px-3.5 py-3 text-xs text-gray-955 bg-white border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                  Actual Placed Tanks *
                </span>
                <input 
                  type="number"
                  value={editingOrder.tanks_left_actual !== undefined ? editingOrder.tanks_left_actual : ''}
                  onChange={(e) => setEditingOrder(prev => prev ? { ...prev, tanks_left_actual: parseInt(e.target.value) || 0 } : null)}
                  className="block w-full px-3.5 py-3 text-xs text-gray-955 bg-white border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                />
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                  Actual Picked Tanks *
                </span>
                <input 
                  type="number"
                  value={editingOrder.tanks_bring_actual !== undefined ? editingOrder.tanks_bring_actual : ''}
                  onChange={(e) => setEditingOrder(prev => prev ? { ...prev, tanks_bring_actual: parseInt(e.target.value) || 0 } : null)}
                  className="block w-full px-3.5 py-3 text-xs text-gray-955 bg-white border border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Crew and Fleet Dispatch Assignments */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5 pb-16">
          <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">2. Operations Vehicle Crew</span>
          
          {/* Driver select */}
          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
              Assigned Fleet Driver *
            </span>
            <select
              value={editingOrder.driver_id}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, driver_id: e.target.value } : null)}
              className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
            >
              <option value="" disabled></option>
              {employees.filter(e => e.role === 'driver').map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          {/* Co-Driver helper select */}
          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
              Operations Dispatcher / Co-Driver Helper
            </span>
            <select
              value={editingOrder.companion_id}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, companion_id: e.target.value } : null)}
              className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
            >
              <option value=""></option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
              ))}
            </select>
          </div>

          {/* Truck asset */}
          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
              Assigned Vehicle Plate Asset *
            </span>
            <select
              value={editingOrder.truck_plate}
              onChange={(e) => setEditingOrder(prev => prev ? { ...prev, truck_plate: e.target.value } : null)}
              className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
            >
              <option value="" disabled></option>
              {trucks.map(t => (
                <option key={t.plate_number} value={t.plate_number}>{t.plate_number} ({t.model})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Floating Actions for desktop/large screens */}
        <div className="hidden sm:flex items-center justify-end gap-3 pt-4 border-t border-gray-100 pb-12 select-none">
          <button 
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 font-bold rounded-xl text-xs text-gray-700 transition"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs transition-all"
          >
            Save Order
          </button>
        </div>
      </div>
    </div>
  );
}
