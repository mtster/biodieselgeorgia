import React, { useState } from 'react';
import { Warehouse } from '../../types';
import { Plus, Trash2, Building, X } from 'lucide-react';
import { FormInput } from '../FormInput';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';

interface Props {
  warehouses: Warehouse[];
  onSaveWarehouse: (w: Warehouse) => void;
  onDeleteWarehouse: (id: string, name: string) => void;
  onBack: () => void;
}

export default function WarehousesSettingView({
  warehouses,
  onSaveWarehouse,
  onDeleteWarehouse,
  onBack
}: Props) {
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Confirmation modal state
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleOpenWarehouse = (warehouse: Warehouse | null) => {
    setSelectedWarehouse(warehouse);
    setNameInput(warehouse ? warehouse.name : '');
    setShowConfirmDelete(false);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!nameInput.trim()) {
      alert('Please enter a warehouse name.');
      return;
    }

    onSaveWarehouse({
      id: selectedWarehouse ? selectedWarehouse.id : '',
      name: nameInput.trim()
    });

    setIsModalOpen(false);
    setSelectedWarehouse(null);
  };

  const triggerDeleteWarehouse = () => {
    if (selectedWarehouse) {
      setWarehouseToDelete({ id: selectedWarehouse.id, name: selectedWarehouse.name });
      setShowConfirmDelete(true);
    }
  };

  const handleConfirmDeleteWarehouse = () => {
    if (warehouseToDelete) {
      onDeleteWarehouse(warehouseToDelete.id, warehouseToDelete.name);
      setIsModalOpen(false);
      setSelectedWarehouse(null);
      setWarehouseToDelete(null);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* Centralized Page Header */}
      <PageHeader title="Warehouses" />

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full">
        {warehouses.map((warehouse) => (
          <button
            key={warehouse.id}
            onClick={() => handleOpenWarehouse(warehouse)}
            type="button"
            className="group bg-white p-5 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-200 text-left cursor-pointer flex flex-col justify-between min-h-[140px]"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Building size={18} />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-gray-800 font-sans tracking-tight leading-snug truncate">
                  {warehouse.name}
                </h4>
                <p className="text-[10px] text-gray-400 font-sans mt-1">
                  Active Storage Unit
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
              Configure Cards &rarr;
            </span>
          </button>
        ))}

        {/* Plus-Signed Add New Warehouse Card */}
        <button
          onClick={() => handleOpenWarehouse(null)}
          type="button"
          className="bg-amber-50/10 border-2 border-dashed border-amber-500/20 hover:border-emerald-600/50 hover:bg-emerald-50/5 p-5 rounded-2xl lg:min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-800 group-hover:text-white transition-all">
            <Plus size={20} />
          </div>
          <span className="text-xs font-black text-gray-500 group-hover:text-emerald-850 transition-colors mt-2">
            Add New Warehouse
          </span>
        </button>
      </div>

      {/* Main editor Popup Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-200 overflow-hidden p-6 relative flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 shrink-0">
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
                {selectedWarehouse ? 'Warehouse Specifications' : 'Add Warehouse'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-750 cursor-pointer p-1 rounded-lg hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Input Fields */}
            <div className="space-y-4 py-1 flex-1 text-left">
              <FormInput
                label="Warehouse / Storage Facility Name *"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Tbilisi Central Depot"
              />
            </div>

            {/* Footer buttons row */}
            <div className="border-t border-slate-200 pt-4 mt-4 flex items-center justify-between shrink-0 select-none">
              {selectedWarehouse ? (
                <button
                  type="button"
                  onClick={triggerDeleteWarehouse}
                  className="flex items-center gap-1 p-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Delete Warehouse
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

            {/* Delete confirmation modal */}
            <ConfirmDeleteModal
              isOpen={showConfirmDelete}
              onClose={() => setShowConfirmDelete(false)}
              onConfirm={handleConfirmDeleteWarehouse}
              title="Delete warehouse?"
              message={
                <span>
                  Are you sure you want to permanently delete warehouse <strong>"{warehouseToDelete?.name}"</strong>? This action cannot be undone.
                </span>
              }
            />

          </div>
        </div>
      )}

    </div>
  );
}
