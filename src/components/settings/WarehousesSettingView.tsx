import React, { useState } from 'react';
import { Warehouse } from '../../types';
import { Plus, Trash2, Building, X } from 'lucide-react';
import { FormInput } from '../FormInput';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import FormModal from '../FormModal';
import { t } from '../../utils/lang';

import { User } from '../../types';

import { checkWarehouseDeletion } from '../../utils/deletionValidation';

interface Props {
  currentUser?: User;
  warehouses: Warehouse[];
  vendors?: any[];
  orders?: any[];
  trucks?: any[];
  onSaveWarehouse: (w: Warehouse) => void;
  onDeleteWarehouse: (id: string, name: string) => void;
  setDeleteAlertMessage?: (msg: string | null) => void;
  onBack: () => void;
}

export default function WarehousesSettingView({
  warehouses,
  vendors = [],
  orders = [],
  trucks = [],
  onSaveWarehouse,
  onDeleteWarehouse,
  setDeleteAlertMessage,
  onBack,
  currentUser
}: Props) {
  const canAddWarehouse = currentUser?.role === 'admin' || currentUser?.permissions?.['warehouses']?.includes('add');
  const canDeleteWarehouse = currentUser?.role === 'admin' || currentUser?.permissions?.['warehouses']?.includes('delete');

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
      const errorMsg = checkWarehouseDeletion(selectedWarehouse.id, selectedWarehouse.name, vendors, orders, trucks);
      if (errorMsg) {
        if (setDeleteAlertMessage) setDeleteAlertMessage(errorMsg);
        return;
      }
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
      <PageHeader title={t("Warehouses")} />

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
                  {t("Active Storage Unit")}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
              {t("Configure Cards")} &rarr;
            </span>
          </button>
        ))}

        {/* Plus-Signed Add New Warehouse Card */}
        {canAddWarehouse && (
          <button
            onClick={() => handleOpenWarehouse(null)}
            type="button"
            className="bg-amber-50/10 border-2 border-dashed border-amber-500/20 hover:border-emerald-600/50 hover:bg-emerald-50/5 p-5 rounded-2xl lg:min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-800 group-hover:text-white transition-all">
              <Plus size={20} />
            </div>
            <span className="text-xs font-black text-gray-500 group-hover:text-emerald-850 transition-colors mt-2">
              {t("Add New Warehouse")}
            </span>
          </button>
        )}
      </div>

      {/* Main editor Popup Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedWarehouse ? t('Warehouse Specifications') : t('Add Warehouse')}
        maxWidthClass="max-w-md"
        onDelete={selectedWarehouse && canDeleteWarehouse ? triggerDeleteWarehouse : undefined}
        deleteLabel={t("Delete")}
        onCancel={() => setIsModalOpen(false)}
        onSave={handleSave}
        saveLabel={t("Save Changes")}
      >
        <div className="space-y-4">
          <FormInput
            label={`${t("Warehouse / Storage Facility Name")} *`}
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={t("e.g. Tbilisi Central Depot")}
          />
        </div>
      </FormModal>

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={handleConfirmDeleteWarehouse}
        title={t("Delete warehouse?")}
        message={
          <span>
            {t("Are you sure you want to permanently delete warehouse")} <strong>"{warehouseToDelete?.name}"</strong>? {t("This action cannot be undone.")}
          </span>
        }
      />

    </div>
  );
}
