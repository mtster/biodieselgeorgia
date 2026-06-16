import React from 'react';
import { Order, Vendor, Warehouse, User, Truck, OrderStatus } from '../../types';
import { ShieldAlert, Clock } from 'lucide-react';
import SupplierAutocomplete from './SupplierAutocomplete';

interface OrderFormFieldsProps {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  vendorSearch: string;
  setVendorSearch: (v: string) => void;
  showVendorSuggestions: boolean;
  setShowVendorSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  pickupHour: string;
  setPickupHour: (h: string) => void;
  pickupMin: string;
  setPickupMin: (m: string) => void;
  useCustomDate: boolean;
  setUseCustomDate: (u: boolean) => void;
  selectedDay: string;
  setSelectedDay: (d: string) => void;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  daysList: string[];
  monthsList: { value: string; name: string }[];
}

export default function OrderFormFields({
  editingOrder,
  setEditingOrder,
  fieldErrors,
  setFieldErrors,
  suppliers,
  warehouses,
  employees,
  trucks,
  vendorSearch,
  setVendorSearch,
  showVendorSuggestions,
  setShowVendorSuggestions,
  pickupHour,
  setPickupHour,
  pickupMin,
  setPickupMin,
  useCustomDate,
  setUseCustomDate,
  selectedDay,
  setSelectedDay,
  selectedMonth,
  setSelectedMonth,
  daysList,
  monthsList
}: OrderFormFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
        <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Core Transaction Details</span>
        
        {/* Supplier Autocomplete Input - Notch styling */}
        <SupplierAutocomplete 
          vendorSearch={vendorSearch}
          setVendorSearch={setVendorSearch}
          showVendorSuggestions={showVendorSuggestions}
          setShowVendorSuggestions={setShowVendorSuggestions}
          setEditingOrder={setEditingOrder}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          suppliers={suppliers}
        />

        {/* Destination storage dropdown */}
        <div className="relative">
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.warehouse_id ? 'text-red-500' : 'text-gray-400'}`}>
            Base Destination Warehouse *
          </span>
          <select
            value={editingOrder.warehouse_id}
            onChange={(e) => {
              setEditingOrder(prev => prev ? { ...prev, warehouse_id: e.target.value } : null);
              if (fieldErrors.warehouse_id) setFieldErrors(prev => ({ ...prev, warehouse_id: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
              fieldErrors.warehouse_id 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          >
            <option value="" disabled></option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          {fieldErrors.warehouse_id && (
            <p className="text-[10px] text-red-655 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.warehouse_id}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Document ID */}
          <div className="relative">
            <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.doc_number ? 'text-red-500' : 'text-gray-400'}`}>
              Document Dispatch ID *
            </span>
            <input 
              type="text"
              value={editingOrder.doc_number}
              onChange={(e) => {
                setEditingOrder(prev => prev ? { ...prev, doc_number: e.target.value } : null);
                if (fieldErrors.doc_number) setFieldErrors(prev => ({ ...prev, doc_number: '' }));
              }}
              className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-mono font-bold transition-all ${
                fieldErrors.doc_number 
                  ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-955' 
                  : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
              }`}
            />
            {fieldErrors.doc_number && (
              <p className="text-[10px] text-red-655 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                {fieldErrors.doc_number}
              </p>
            )}
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
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.qty_actual ? 'text-red-500' : 'text-gray-400'}`}>
                Actual Received (L) *
              </span>
              <input 
                type="number"
                required
                value={editingOrder.qty_actual || ''}
                onChange={(e) => {
                  setEditingOrder(prev => prev ? { ...prev, qty_actual: parseFloat(e.target.value) || 0 } : null);
                  if (fieldErrors.qty_actual) setFieldErrors(prev => ({ ...prev, qty_actual: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none font-mono ${
                  fieldErrors.qty_actual 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-655 text-red-955' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 bg-white text-gray-955'
                }`}
              />
              {fieldErrors.qty_actual && (
                <p className="text-[10px] text-red-655 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.qty_actual}
                </p>
              )}
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
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.driver_id ? 'text-red-500' : 'text-gray-400'}`}>
            Assigned Fleet Driver *
          </span>
          <select
            value={editingOrder.driver_id}
            onChange={(e) => {
              setEditingOrder(prev => prev ? { ...prev, driver_id: e.target.value } : null);
              if (fieldErrors.driver_id) setFieldErrors(prev => ({ ...prev, driver_id: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
              fieldErrors.driver_id 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          >
            <option value="" disabled></option>
            {employees.filter(e => e.role === 'driver').map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          {fieldErrors.driver_id && (
            <p className="text-[10px] text-red-655 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.driver_id}
            </p>
          )}
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
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.truck_plate ? 'text-red-500' : 'text-gray-400'}`}>
            Assigned Vehicle Plate Asset *
          </span>
          <select
            value={editingOrder.truck_plate}
            onChange={(e) => {
              setEditingOrder(prev => prev ? { ...prev, truck_plate: e.target.value } : null);
              if (fieldErrors.truck_plate) setFieldErrors(prev => ({ ...prev, truck_plate: '' }));
            }}
            className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
              fieldErrors.truck_plate 
                ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
            }`}
          >
            <option value="" disabled></option>
            {trucks.map(t => (
              <option key={t.plate_number} value={t.plate_number}>{t.plate_number} ({t.model})</option>
            ))}
          </select>
          {fieldErrors.truck_plate && (
            <p className="text-[10px] text-red-655 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.truck_plate}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
