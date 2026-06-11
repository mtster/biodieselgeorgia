import React, { useState } from 'react';
import { City, District, Truck, Employee } from '../types';
import { 
  Plus, Trash2, Check, X, Truck as TruckIcon, 
  MapPin, Landmark, Settings 
} from 'lucide-react';

interface Props {
  cities: City[];
  districts: District[];
  trucks: Truck[];
  employees: Employee[];
  currentEmployee: Employee;
  onSaveCity: (c: City) => void;
  onDeleteCity: (id: string, name: string) => void;
  onSaveDistrict: (d: District) => void;
  onDeleteDistrict: (id: string, name: string) => void;
  onSaveTruck: (t: Truck) => void;
  onDeleteTruck: (plate: string) => void;
}

export default function LookupsView({
  cities, districts, trucks, employees, currentEmployee,
  onSaveCity, onDeleteCity, onSaveDistrict, onDeleteDistrict,
  onSaveTruck, onDeleteTruck
}: Props) {
  // Tabs locally within lookups
  const [activeTab, setActiveTab] = useState<'cities' | 'trucks'>('cities');

  // Input helpers
  const [newCityName, setNewCityName] = useState('');
  
  const [newDistName, setNewDistName] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');

  const [tPlate, setTPlate] = useState('');
  const [tModel, setTModel] = useState('');
  const [tDriver, setTDriver] = useState('');
  const [tCompanion, setTCompanion] = useState('');

  const handleAddCity = () => {
    if (!newCityName.trim()) return;
    onSaveCity({ id: '', name: newCityName });
    setNewCityName('');
  };

  const handleAddDistrict = () => {
    if (!newDistName.trim() || !selectedCityId) {
      alert('გთხოვთ აირჩიოთ ქალაქი და მიუთითოთ უბანი');
      return;
    }
    onSaveDistrict({ id: '', city_id: selectedCityId, name: newDistName });
    setNewDistName('');
  };

  const handleAddTruck = () => {
    if (!tPlate.trim() || !tModel.trim()) {
      alert('შეავსეთ მანქანის ნომერი და მოდელი');
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
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">ცნობარები და კონფიგურაცია</h2>
          <p className="text-xs text-gray-500 mt-1">ქალაქების, უბნების, სპეციალური ლოკაციების და სატრანსპორტო საშუალებების მართვა.</p>
        </div>

        {/* Tab switchers */}
        <div className="flex bg-gray-100 p-1 rounded-xl border">
          <button 
            onClick={() => setActiveTab('cities')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'cities' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-550'
            }`}
          >
            გეოგრაფიული ცნობარი
          </button>
          <button 
            onClick={() => setActiveTab('trucks')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'trucks' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-550'
            }`}
          >
            მანქანები
          </button>
        </div>
      </div>

      {activeTab === 'cities' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Cities Card */}
          <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
              <MapPin size={16} className="text-emerald-700" />
              ქალაქები
            </h3>

            {/* Save City inline form */}
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="ახალი ქალაქის დასახელება..."
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
              />
              <button 
                onClick={handleAddCity}
                className="px-3 py-1.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition"
              >
                დამატება
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {cities.map((city) => (
                <div key={city.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800">{city.name}</span>
                  <button 
                    onClick={() => onDeleteCity(city.id, city.name)}
                    className="p-1 hover:text-red-630 hover:bg-white rounded text-gray-400"
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
              <Landmark size={16} className="text-emerald-700" />
              უბნები / რაიონები
            </h3>

            {/* Save District inline form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              >
                <option value="">-- აირჩიეთ ქალაქი --</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input 
                type="text" 
                placeholder="ახალი უბანი..."
                value={newDistName}
                onChange={(e) => setNewDistName(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
              />
              <button 
                onClick={handleAddDistrict}
                className="bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition"
              >
                უბნის დამატება
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {districts.map((dist) => {
                const cityObj = cities.find(c => c.id === dist.city_id);
                return (
                  <div key={dist.id} className="p-3 bg-slate-50 border rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-gray-800">{dist.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono block">ქალაქი: {cityObj ? cityObj.name : 'უცნობი'}</span>
                    </div>
                    <button 
                      onClick={() => onDeleteDistrict(dist.id, dist.name)}
                      className="p-1 hover:text-red-630 hover:bg-white rounded text-gray-400"
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Add form */}
          <div className="bg-white border p-5 rounded-2xl shadow-xs space-y-4 h-fit">
            <h3 className="text-sm font-black text-gray-800 flex items-center gap-1.5">
              <TruckIcon size={16} className="text-emerald-700" />
              სატრანსპორტო აქტივის რეგისტრაცია
            </h3>

            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">სახელმწიფო ნომერი *</label>
                <input 
                  type="text" 
                  placeholder="მაგ: BB-777-GG"
                  value={tPlate}
                  onChange={(e) => setTPlate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">მოდელი / მარკა *</label>
                <input 
                  type="text" 
                  placeholder="მაგ: Mercedes-Benz Sprinter"
                  value={tModel}
                  onChange={(e) => setTModel(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">მძღოლი მომხმარებელი</label>
                <select
                  value={tDriver}
                  onChange={(e) => setTDriver(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="">-- აირჩიეთ მძღოლი --</option>
                  {employees.filter(e => e.role === 'driver').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-semibold block mb-0.5">თანმხლები მომხმარებელი</label>
                <select
                  value={tCompanion}
                  onChange={(e) => setTCompanion(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="">-- აირჩიეთ თანმხლები --</option>
                  {employees.filter(e => e.role === 'companion').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleAddTruck}
                className="w-full py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition"
              >
                მანქანის დამატება / განახლება
              </button>
            </div>
          </div>

          {/* List display */}
          <div className="lg:col-span-2 bg-white border p-5 rounded-2xl shadow-xs space-y-4">
            <h3 className="text-sm font-black text-gray-800">დარეგისტრირებული ავტომობილები</h3>

            <div className="divide-y divide-gray-50">
              {trucks.map((truck) => (
                <div key={truck.plate_number} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded text-xs">
                      {truck.plate_number}
                    </span>
                    <span className="font-semibold text-gray-800 ml-2">{truck.model}</span>
                    <p className="text-[10px] text-gray-400 font-sans mt-1">
                      მიმაგრებული მძღოლი: <strong className="text-gray-600">{truck.driver_name || 'არ არის'}</strong> • თანმხლები: {truck.companion_name || 'არ არის'}
                    </p>
                  </div>
                  <button 
                    onClick={() => onDeleteTruck(truck.plate_number)}
                    className="p-1 px-2.5 hover:text-red-630 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs"
                  >
                    წაშლა
                  </button>
                </div>
              ))}

              {trucks.length === 0 && (
                <div className="text-center py-12 text-gray-400 italic text-xs">
                  მანქანები ჩანაწერებში არ ფიქსირდება.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
