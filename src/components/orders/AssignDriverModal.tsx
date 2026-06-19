import React, { useState, useEffect } from 'react';
import { Truck, User, Order, Vendor, Warehouse } from '../../types';

interface AssignDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (driverId: string, companionId: string, truckPlate: string) => void;
  orders: Order[];
  employees: User[];
  trucks: Truck[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
}

export default function AssignDriverModal({
  isOpen, onClose, onSave, orders, employees, trucks, suppliers, warehouses
}: AssignDriverModalProps) {
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedCompanionId, setSelectedCompanionId] = useState('');
  const [selectedTruckPlate, setSelectedTruckPlate] = useState('');

  // 1. Identify relevant warehouses
  const vendorIds = Array.from(new Set(orders.map(o => o.vendor_id)));
  const relevantWarehouseIds = Array.from(new Set(
    suppliers
      .filter(s => vendorIds.includes(s.id))
      .map(s => s.warehouse_id)
      .filter(Boolean) as string[]
  ));

  // 2. Filter drivers (Role 'driver') + check warehouse
  const drivers = employees.filter(e => e.role === 'driver' && 
    (relevantWarehouseIds.length === 0 || !e.warehouse_id || relevantWarehouseIds.includes(e.warehouse_id))
  );

  const companions = employees.filter(e => e.role === 'driver'); 

  useEffect(() => {
    if (selectedDriverId) {
      const truck = trucks.find(t => t.driver_id === selectedDriverId);
      if (truck) {
        setSelectedTruckPlate(truck.plate_number);
        setSelectedCompanionId(truck.companion_id || '');
      }
    }
  }, [selectedDriverId, trucks]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md border shadow-lg p-6 space-y-4">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Assign Driver ({orders.length} orders)</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase">Driver</label>
            <select 
              className="w-full mt-1 p-2 border rounded-xl text-sm"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
            >
              <option value="">Select Driver</option>
              {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {relevantWarehouseIds.length > 0 && (
                <p className="text-[10px] text-gray-400 mt-1">Filtered by applicable warehouse(s).</p>
            )}
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase">Vehicle</label>
            <select 
              className="w-full mt-1 p-2 border rounded-xl text-sm"
              value={selectedTruckPlate}
              onChange={(e) => setSelectedTruckPlate(e.target.value)}
            >
              <option value="">Select Vehicle</option>
              {trucks.map(t => <option key={t.plate_number} value={t.plate_number}>{t.model} ({t.plate_number})</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase">Companion</label>
            <select 
              className="w-full mt-1 p-2 border rounded-xl text-sm"
              value={selectedCompanionId}
              onChange={(e) => setSelectedCompanionId(e.target.value)}
            >
              <option value="">Select Companion</option>
              {companions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <button onClick={onClose} className="flex-1 py-2 border rounded-xl text-xs font-bold">Cancel</button>
          <button 
            onClick={() => {
              onSave(selectedDriverId, selectedCompanionId, selectedTruckPlate);
              onClose();
            }}
            className="flex-1 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold"
          >
            Assign
          </button>
        </div>
      </div>
    </div>
  );
}
