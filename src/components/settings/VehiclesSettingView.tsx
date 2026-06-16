import React, { useState } from 'react';
import { Vehicle, User } from '../../types';
import { Plus, Trash2, Truck as TruckIcon, X, ArrowLeft, HelpCircle } from 'lucide-react';

interface Props {
  trucks: Vehicle[];
  employees: User[];
  onSaveTruck: (t: Vehicle) => void;
  onDeleteTruck: (plate: string) => void;
  onBack: () => void;
}

export default function VehiclesSettingView({
  trucks,
  employees,
  onSaveTruck,
  onDeleteTruck,
  onBack
}: Props) {
  const [selectedTruck, setSelectedTruck] = useState<Vehicle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Field values
  const [tPlate, setTPlate] = useState('');
  const [tModel, setTModel] = useState('');
  const [tDriver, setTDriver] = useState('');
  const [tCompanion, setTCompanion] = useState('');

  // Confirmation state
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [truckToDelete, setTruckToDelete] = useState<string | null>(null);

  const activeTrucks = trucks.filter(t => !t.is_deleted);

  // Georgian plate conversion helper
  const ge2en: Record<string, string> = { 
    'ა':'A', 'ბ':'B', 'გ':'G', 'დ':'D', 'ე':'E', 'ვ':'V', 'ზ':'Z', 
    'თ':'T', 'ი':'I', 'კ':'K', 'ლ':'L', 'მ':'M', 'ნ':'N', 'ო':'O', 
    'პ':'P', 'ჟ':'J', 'რ':'R', 'ს':'S', 'ტ':'T', 'უ':'U', 'ფ':'F', 
    'ქ':'Q', 'ღ':'R', 'ყ':'Y', 'შ':'S', 'ჩ':'C', 'ც':'C', 'ძ':'Z', 
    'წ':'W', 'ჭ':'C', 'ხ':'X', 'ჯ':'J', 'ჰ':'H' 
  };

  const formatLicensePlate = (val: string) => {
    let mapped = val.toUpperCase().split('').map(c => ge2en[c] || c).join('');
    let clean = mapped.replace(/[^A-Z0-9]/g, '');
    let res = '';
    let let1 = clean.substring(0, 2).replace(/[^A-Z]/g, '');
    let num = clean.substring(let1.length, let1.length + 3).replace(/[^0-9]/g, '');
    let let2 = clean.substring(let1.length + num.length, let1.length + num.length + 2).replace(/[^A-Z]/g, '');
    
    if (let1) res += let1;
    if (let1.length === 2 && (num || val.endsWith('-'))) res += '-';
    if (num) res += num;
    if (num.length === 3 && (let2 || (val.endsWith('-') && clean.length === 5))) res += '-';
    if (let2) res += let2;
    return res;
  };

  const handleOpenTruck = (truck: Vehicle | null) => {
    setSelectedTruck(truck);
    setTPlate(truck ? truck.plate_number : '');
    setTModel(truck ? truck.model : '');
    setTDriver(truck ? truck.driver_id || '' : '');
    setTCompanion(truck ? truck.companion_id || '' : '');
    setShowConfirmDelete(false);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!tPlate.trim() || !tModel.trim()) {
      alert('Please enter license plate and model name.');
      return;
    }

    const driverObj = employees.find(e => e.id === tDriver);
    const companionObj = employees.find(e => e.id === tCompanion);

    onSaveTruck({
      plate_number: tPlate.trim(),
      model: tModel.trim(),
      driver_id: tDriver,
      driver_name: driverObj?.name || '',
      companion_id: tCompanion,
      companion_name: companionObj?.name || '',
      is_deleted: false
    });

    setIsModalOpen(false);
    setSelectedTruck(null);
  };

  const triggerDeleteTruck = () => {
    if (selectedTruck) {
      setTruckToDelete(selectedTruck.plate_number);
      setShowConfirmDelete(true);
    }
  };

  const handleConfirmDeleteTruck = () => {
    if (truckToDelete) {
      onDeleteTruck(truckToDelete);
      setIsModalOpen(false);
      setSelectedTruck(null);
      setTruckToDelete(null);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* 1. STANDARDIZED PAGE HEADER */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-4 bg-[#f8fafc]/95 backdrop-blur-md border-b border-gray-100 flex items-center justify-between gap-4 select-none text-left shadow-xs mb-6">
        <div className="flex items-center">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Vehicles</h2>
          </div>
        </div>
        <div />
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {activeTrucks.map((truck) => {
          const assignedDriver = employees.find(e => e.id === truck.driver_id)?.name || 'None';
          const assignedCompanion = employees.find(e => e.id === truck.companion_id)?.name || 'None';

          return (
            <button
              key={truck.plate_number}
              onClick={() => handleOpenTruck(truck)}
              type="button"
              className="group bg-white p-5 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-200 text-left cursor-pointer flex flex-col justify-between min-h-[150px]"
            >
              <div className="space-y-2.5 w-full">
                {/* Styled License Plate */}
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center border border-gray-400 bg-white rounded px-2 py-0.5 font-mono font-extrabold text-[11px] shadow-2xs">
                    <div className="w-1.5 h-3 bg-blue-700 mr-1 rounded-xs"></div>
                    <span className="text-gray-900 tracking-wider font-extrabold">{truck.plate_number}</span>
                  </div>
                  <div className="text-gray-400 group-hover:text-amber-800 transition-colors">
                    <TruckIcon size={16} />
                  </div>
                </div>

                <div>
                  <h4 className="font-extrabold text-sm text-gray-850 font-sans truncate">
                    {truck.model}
                  </h4>
                  <div className="text-[10px] text-gray-405 font-sans mt-1.5 space-y-0.5">
                    <p className="truncate">Driver: <strong className="text-gray-700">{assignedDriver}</strong></p>
                    <p className="truncate">Companion: <strong className="text-gray-650">{assignedCompanion}</strong></p>
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity mt-2 block">
                Manage Asset &rarr;
              </span>
            </button>
          );
        })}

        {/* Plus card */}
        <button
          onClick={() => handleOpenTruck(null)}
          type="button"
          className="bg-amber-50/10 border-2 border-dashed border-amber-500/20 hover:border-emerald-600/50 hover:bg-emerald-50/5 p-5 rounded-2xl lg:min-h-[150px] flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-800 group-hover:text-white transition-all">
            <Plus size={20} />
          </div>
          <span className="text-xs font-black text-gray-500 group-hover:text-emerald-850 transition-colors mt-2">
            Add New Vehicle
          </span>
        </button>
      </div>

      {/* Main modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border overflow-hidden p-6 relative flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                {selectedTruck ? 'Vehicle Specifications' : 'Add Vehicle to Fleet'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-450 hover:text-gray-700 cursor-pointer p-1 rounded-lg hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Fields */}
            <div className="space-y-4 py-1 flex-1">
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  License Plate Number *
                </span>
                <input 
                  type="text" 
                  value={tPlate}
                  onChange={(e) => setTPlate(formatLicensePlate(e.target.value))}
                  disabled={!!selectedTruck}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-mono transition-all bg-white text-gray-900 disabled:bg-slate-50 disabled:text-gray-500"
                  placeholder="e.g. AA-123-BB"
                />
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  Vehicle Brand / Model *
                </span>
                <input 
                  type="text" 
                  value={tModel}
                  onChange={(e) => setTModel(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900"
                  placeholder="e.g. Mercedes Sprinter"
                />
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  Assigned Default Driver *
                </span>
                <select
                  value={tDriver}
                  onChange={(e) => setTDriver(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900 cursor-pointer"
                >
                  <option value="" hidden></option>
                  {employees.filter(e => e.role === 'driver').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  Assigned Co-Driver / Companion
                </span>
                <select
                  value={tCompanion}
                  onChange={(e) => setTCompanion(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900 cursor-pointer"
                >
                  <option value="" hidden></option>
                  {employees.filter(e => e.role !== 'driver').map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer row */}
            <div className="border-t pt-4 mt-4 flex items-center justify-between shrink-0 select-none">
              {selectedTruck ? (
                <button
                  type="button"
                  onClick={triggerDeleteTruck}
                  className="flex items-center gap-1 p-2 text-xs font-bold text-red-650 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Delete Asset
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 hover:bg-slate-50 font-bold rounded-lg text-xs text-gray-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-black rounded-lg text-xs transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>

            {/* Confirmation Overlay popup */}
            {showConfirmDelete && (
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in duration-100 z-50">
                <div className="bg-white rounded-xl shadow-lg border p-5 max-w-xs w-full text-center space-y-4">
                  <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Decommission vehicle?</h5>
                    <p className="text-[11px] text-gray-450 mt-1.5 leading-snug">
                      Deleting truck <strong>{truckToDelete}</strong> will mark it as soft-deleted and prevent active log assignments.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowConfirmDelete(false)}
                      className="flex-1 py-1.5 border hover:bg-slate-50 text-xs font-bold text-gray-700 rounded-md transition"
                    >
                      No, Keep
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteTruck}
                      className="flex-1 py-1.5 bg-red-650 hover:bg-red-750 text-xs font-bold text-white rounded-md transition"
                    >
                      Yes, Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
