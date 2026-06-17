import React, { useState } from 'react';
import { City, District } from '../../types';
import { Plus, Trash2, MapPin, X, Building } from 'lucide-react';
import { FormInput } from '../FormInput';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';

interface Props {
  cities: City[];
  districts: District[];
  onSaveCity: (c: City) => void;
  onDeleteCity: (id: string, name: string) => void;
  onSaveDistrict: (d: District) => void;
  onDeleteDistrict: (id: string, name: string) => void;
  onBack: () => void;
}

export default function CitiesSettingView({
  cities,
  districts,
  onSaveCity,
  onDeleteCity,
  onSaveDistrict,
  onDeleteDistrict,
  onBack
}: Props) {
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cityNameInput, setCityNameInput] = useState('');
  
  // Inline actions inside City detailed modal
  const [newDistrictName, setNewDistrictName] = useState('');
  
  // Custom Confirmation Dialog Overlay State
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<{ id: string; name: string } | null>(null);

  const activeCities = cities.filter(c => !c.is_deleted);

  const handleOpenCity = (city: City | null) => {
    setSelectedCity(city);
    setCityNameInput(city ? city.name : '');
    setNewDistrictName('');
    setShowConfirmDelete(false);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!cityNameInput.trim()) return;
    onSaveCity({
      id: selectedCity ? selectedCity.id : '',
      name: cityNameInput.trim()
    });
    setIsModalOpen(false);
    setSelectedCity(null);
  };

  const triggerDeleteCity = () => {
    if (selectedCity) {
      setCityToDelete({ id: selectedCity.id, name: selectedCity.name });
      setShowConfirmDelete(true);
    }
  };

  const handleConfirmDeleteCity = () => {
    if (cityToDelete) {
      onDeleteCity(cityToDelete.id, cityToDelete.name);
      setIsModalOpen(false);
      setSelectedCity(null);
      setCityToDelete(null);
      setShowConfirmDelete(false);
    }
  };

  const handleAddDistrict = () => {
    if (!selectedCity || !newDistrictName.trim()) return;
    onSaveDistrict({
      id: '',
      city_id: selectedCity.id,
      name: newDistrictName.trim()
    });
    setNewDistrictName('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* 1. STANDARDIZED PAGE HEADER */}
      <PageHeader title="Cities" />

      {/* Grid of Cities including the "+ Add New Window" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-6xl">
        {activeCities.map((city) => {
          const count = districts.filter(d => d.city_id === city.id).length;
          return (
            <button
              key={city.id}
              onClick={() => handleOpenCity(city)}
              type="button"
              className="group bg-white p-5 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-200 text-left cursor-pointer flex flex-col justify-between min-h-[140px]"
            >
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-slate-50 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                  <MapPin size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-gray-800 font-sans tracking-tight leading-snug truncate">
                    {city.name}
                  </h4>
                  <p className="text-[11px] font-mono text-gray-450 mt-1">
                    {count} {count === 1 ? 'District' : 'Districts'} Active
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                Configure Cards &rarr;
              </span>
            </button>
          );
        })}

        {/* Plus-Signed Add New City Window Card */}
        <button
          onClick={() => handleOpenCity(null)}
          type="button"
          className="bg-amber-50/10 border-2 border-dashed border-amber-500/20 hover:border-emerald-600/50 hover:bg-emerald-50/5 p-5 rounded-2xl lg:min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-800 group-hover:text-white transition-all">
            <Plus size={20} />
          </div>
          <span className="text-xs font-black text-gray-500 group-hover:text-emerald-850 transition-colors mt-2">
            Add New City
          </span>
        </button>
      </div>

      {/* Main detailed editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border overflow-hidden p-6 relative flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                {selectedCity ? 'City Details' : 'Create New City'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-450 hover:text-gray-700 cursor-pointer p-1 rounded-lg hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1">
              {/* City Name Form field */}
              <FormInput
                label="City Name *"
                type="text"
                value={cityNameInput}
                onChange={(e) => setCityNameInput(e.target.value)}
                placeholder="e.g. Tbilisi"
              />

              {/* Districts inline sub-management if City exists */}
              {selectedCity && (
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="text-[11px] font-black uppercase text-gray-400 tracking-wider">
                    Associated Districts & Neighborhoods
                  </h4>

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newDistrictName}
                      onChange={(e) => setNewDistrictName(e.target.value)}
                      placeholder="New district name..."
                      className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 bg-white"
                    />
                    <button 
                      onClick={handleAddDistrict}
                      type="button"
                      className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-950 transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pt-1">
                    {districts.filter(d => d.city_id === selectedCity.id).map(d => (
                      <div key={d.id} className="p-2 bg-white border border-gray-100 rounded-lg flex items-center justify-between text-xs sm:px-3">
                        <span className="font-bold text-gray-750">{d.name}</span>
                        <button 
                          onClick={() => onDeleteDistrict(d.id, d.name)}
                          type="button"
                          className="p-1 hover:text-red-650 rounded text-gray-400 hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {districts.filter(d => d.city_id === selectedCity.id).length === 0 && (
                      <p className="text-[10px] text-gray-405 font-sans italic text-center py-2">
                        No districts registered yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom row */}
            <div className="border-t pt-4 mt-4 flex items-center justify-between shrink-0 select-none">
              {selectedCity ? (
                <button
                  type="button"
                  onClick={triggerDeleteCity}
                  className="flex items-center gap-1 p-2 text-xs font-bold text-red-650 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Delete City
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

            {/* Standardized Confirmation Overlay for Deleting Cities */}
            <ConfirmDeleteModal
              isOpen={showConfirmDelete}
              onClose={() => setShowConfirmDelete(false)}
              onConfirm={handleConfirmDeleteCity}
              title="Delete City?"
              message={
                <span>
                  Are you sure you want to delete city <strong>"{cityToDelete?.name}"</strong>? It will hide it from the UI immediately. This action is soft-deleted in the database.
                </span>
              }
            />

          </div>
        </div>
      )}

    </div>
  );
}
