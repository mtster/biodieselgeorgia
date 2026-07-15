import React, { useState } from 'react';
import { City, District, Truck, User } from '../../types';
import { t } from '../../utils/lang';
import { 
  Plus, Trash2, Check, X, Truck as TruckIcon, 
  MapPin, Landmark, Settings 
} from 'lucide-react';

interface Props {
  cities: City[];
  districts: District[];
  trucks: Truck[];
  employees: User[];
  currentEmployee: User;
  onSaveCity: (c: City) => void;
  onDeleteCity: (id: string, name: string) => void;
  onSaveDistrict: (d: District) => void;
  onDeleteDistrict: (id: string, name: string) => void;
  onSaveTruck: (t: Truck) => void;
  onDeleteTruck: (plate: string) => void;
  forcedTab?: string;
}

export default function LookupsView({
  cities, districts, trucks, employees, currentEmployee,
  onSaveCity, onDeleteCity, onSaveDistrict, onDeleteDistrict,
  onSaveTruck, onDeleteTruck, forcedTab
}: Props) {
  // Tabs locally within lookups
  const [activeTab, setActiveTab] = useState<'cities' | 'trucks'>('cities');

  const currentTab = forcedTab || activeTab;

  // Input helpers
  const [newCityName, setNewCityName] = useState('');
  
  const [newDistName, setNewDistName] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');

  const [tPlate, setTPlate] = useState('');
  const [tModel, setTModel] = useState('');
  const [tDriver, setTDriver] = useState('');
  const [tCompanion, setTCompanion] = useState('');

  const ge2en: Record<string, string> = { 'ა':'A', 'ბ':'B', 'გ':'G', 'დ':'D', 'ე':'E', 'ვ':'V', 'ზ':'Z', 'თ':'T', 'ი':'I', 'კ':'K', 'ლ':'L', 'მ':'M', 'ნ':'N', 'ო':'O', 'პ':'P', 'ჟ':'J', 'რ':'R', 'ს':'S', 'ტ':'T', 'უ':'U', 'ფ':'F', 'ქ':'Q', 'ღ':'R', 'ყ':'Y', 'შ':'S', 'ჩ':'C', 'ც':'C', 'ძ':'Z', 'წ':'W', 'ჭ':'C', 'ხ':'X', 'ჯ':'J', 'ჰ':'H' };

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

  const handleAddCity = () => {
    if (!newCityName.trim()) return;
    onSaveCity({ id: '', name: newCityName });
    setNewCityName('');
  };

  const handleAddDistrict = () => {
    if (!newDistName.trim() || !selectedCityId) {
      alert('Please select a city and specify the district name');
      return;
    }
    onSaveDistrict({ id: '', city_id: selectedCityId, name: newDistName });
    setNewDistName('');
  };

  const handleAddTruck = () => {
    if (!tPlate.trim() || !tModel.trim()) {
      alert('Please enter vehicle license plate and model');
      return;
    }

    const driverObj = employees.find(e => e.id === tDriver);
    const companionObj = employees.find(e => e.id === tCompanion);

    onSaveTruck({
      plate_number: tPlate.trim(),
      model: tModel,
      driver_id: tDriver,
      driver_name: driverObj?.name || '',
      companion_id: tCompanion,
      companion_name: companionObj?.name || ''
    });

    setTPlate('');
    setTModel('');
    setTDriver('');
    setTCompanion('');
  };

  return (
    <div className="space-y-6 pt-4 md:pt-6" id="lookups-view-panel">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 font-sans">
            {currentTab === 'cities' ? 'Cities & Districts' : 'Vehicles Fleet'}
          </h2>
        </div>

        {/* Tab switchers */}
        {!forcedTab && (
          <div className="flex bg-gray-100 p-1 rounded-xl border font-sans">
            <button 
              onClick={() => setActiveTab('cities')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'cities' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-550'
              }`}
            >
              Geographic Directory
            </button>
            <button 
              onClick={() => setActiveTab('trucks')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'trucks' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-550'
              }`}
            >
              Vehicles
            </button>
          </div>
        )}
      </div>

      {currentTab === 'cities' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
          
          {/* Cities Card */}
          <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
              <MapPin size={16} className="text-emerald-700 font-bold" />
              Cities
            </h3>

            {/* Save City inline form */}
            <div className="flex gap-2 items-end">
              <div className="relative flex-1">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  New City Name
                </span>
                <input 
                  id="input-new-city"
                  type="text" 
                  value={newCityName}
                  onChange={(e) => setNewCityName(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900"
                />
              </div>
              <button 
                onClick={handleAddCity}
                className="px-4 py-3 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition cursor-pointer shrink-0"
              >
                Add
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {cities.map((city) => (
                <div key={city.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800">{city.name}</span>
                  <button 
                    onClick={() => onDeleteCity(city.id, city.name)}
                    className="p-1 hover:text-red-600 hover:bg-white rounded text-gray-400 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Districts/Neighborhoods Card */}
          <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
              <Landmark size={16} className="text-emerald-700 font-bold" />
              Districts / Neighborhoods
            </h3>

            {/* Save District inline form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  City Select
                </span>
                <select
                  value={selectedCityId}
                  onChange={(e) => setSelectedCityId(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900 cursor-pointer"
                >
                  <option value="">-- Select City --</option>
                  {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  New District Name
                </span>
                <input 
                  id="input-new-district"
                  type="text" 
                  value={newDistName}
                  onChange={(e) => setNewDistName(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900"
                />
              </div>
              <button 
                onClick={handleAddDistrict}
                className="bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition cursor-pointer py-3"
              >
                Add District
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {districts.map((dist) => {
                const cityObj = cities.find(c => c.id === dist.city_id);
                return (
                  <div key={dist.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs animate-fade-in">
                    <div>
                      <span className="font-bold text-gray-800">{dist.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono block">City: {cityObj ? cityObj.name : 'Unknown'}</span>
                    </div>
                    <button 
                      onClick={() => onDeleteDistrict(dist.id, dist.name)}
                      className="p-1 hover:text-red-630 hover:bg-white rounded text-gray-400 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      ) : (
        /* Trucks vehicle directory CRUD */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
          
          {/* Add form */}
          <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4 h-fit">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
              <TruckIcon size={16} className="text-emerald-700 font-bold" />
              Register Vehicle Asset
            </h3>

            <div className="space-y-4 pt-1">
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  License Plate *
                </span>
                <input 
                  type="text" 
                  value={tPlate}
                  onChange={(e) => setTPlate(formatLicensePlate(e.target.value))}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-mono transition-all bg-white text-gray-900"
                />
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  Brand / Model *
                </span>
                <input 
                  type="text" 
                  value={tModel}
                  onChange={(e) => setTModel(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900"
                />
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  Driver
                </span>
                <select
                  value={tDriver}
                  onChange={(e) => setTDriver(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900 cursor-pointer"
                >
                  <option value="">-- Select Driver --</option>
                  {employees.filter(e => e.role === 'driver').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-gray-400">
                  Co-Driver / Companion
                </span>
                <select
                  value={tCompanion}
                  onChange={(e) => setTCompanion(e.target.value)}
                  className="block w-full px-3.5 py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 font-sans transition-all bg-white text-gray-900 cursor-pointer"
                >
                  <option value="">-- Select Companion --</option>
                  {employees.filter(e => e.role !== 'driver').map(e => {
                    const translatedRole = e.role === 'admin' ? t('Admin') :
                      e.role === 'manager' ? t('Purchasing Group Leader') :
                      e.role === 'warehouse_manager' ? t('Logistics Manager') :
                      e.role === 'assistant' ? t('Purchasing Manager') :
                      e.role === 'driver' ? t('Logistics/Driver') :
                      e.role === 'vendor' ? t('Operator') : e.role;
                    return (
                      <option key={e.id} value={e.id}>{e.name} ({translatedRole})</option>
                    );
                  })}
                </select>
              </div>

              <button 
                onClick={handleAddTruck}
                className="w-full py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition cursor-pointer"
              >
                Add / Update Vehicle
              </button>
            </div>
          </div>

          {/* List display */}
          <div className="lg:col-span-2 bg-white border p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-sm font-black text-gray-800">Registered Vehicles</h3>

            <div className="divide-y divide-gray-50">
              {trucks.map((truck) => (
                <div key={truck.plate_number} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded text-xs">
                      {truck.plate_number}
                    </span>
                    <span className="font-semibold text-gray-800 ml-2">{truck.model}</span>
                    <p className="text-[10px] text-gray-400 font-sans mt-1">
                      Assigned Driver: <strong className="text-gray-650">{employees.find(e => e.id === truck.driver_id)?.name || 'None'}</strong> • Companion: {employees.find(e => e.id === truck.companion_id)?.name || 'None'}
                    </p>
                  </div>
                  <button 
                    onClick={() => onDeleteTruck(truck.plate_number)}
                    className="p-1 px-2.5 hover:text-red-650 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))}

              {trucks.length === 0 && (
                <div className="text-center py-12 text-gray-400 italic text-xs">
                  No vehicles are registered.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
