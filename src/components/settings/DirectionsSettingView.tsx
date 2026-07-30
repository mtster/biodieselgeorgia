import React, { useState } from 'react';
import { Direction } from '../../types';
import { Plus, Route } from 'lucide-react';
import { FormInput } from '../FormInput';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import FormModal from '../FormModal';
import { t } from '../../utils/lang';

import { User } from '../../types';

import { checkDirectionDeletion } from '../../utils/deletionValidation';

interface Props {
  currentUser?: User;
  directions: Direction[];
  trucks?: any[];
  orders?: any[];
  onSaveDirection: (d: Direction) => void;
  onDeleteDirection: (id: string, name: string) => void;
  setDeleteAlertMessage?: (msg: string | null) => void;
  onBack: () => void;
}

export default function DirectionsSettingView({
  directions,
  trucks = [],
  orders = [],
  onSaveDirection,
  onDeleteDirection,
  setDeleteAlertMessage,
  onBack,
  currentUser
}: Props) {
  const canAddDirection = currentUser?.role === 'admin' || currentUser?.permissions?.['directions']?.includes('add');
  const canDeleteDirection = currentUser?.role === 'admin' || currentUser?.permissions?.['directions']?.includes('delete');

  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [directionNameInput, setDirectionNameInput] = useState('');
  
  // Custom Confirmation Dialog Overlay State
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [directionToDelete, setDirectionToDelete] = useState<{ id: string; name: string } | null>(null);

  const activeDirections = directions.filter(d => !d.is_deleted);

  const handleOpenDirection = (dir: Direction | null) => {
    setSelectedDirection(dir);
    setDirectionNameInput(dir ? dir.name : '');
    setShowConfirmDelete(false);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!directionNameInput.trim()) return;
    onSaveDirection({
      id: selectedDirection ? selectedDirection.id : '',
      name: directionNameInput.trim()
    });
    setIsModalOpen(false);
    setSelectedDirection(null);
  };

  const triggerDeleteDirection = () => {
    if (selectedDirection) {
      const errorMsg = checkDirectionDeletion(selectedDirection.id, selectedDirection.name, trucks, orders);
      if (errorMsg) {
        if (setDeleteAlertMessage) setDeleteAlertMessage(errorMsg);
        return;
      }
      setDirectionToDelete({ id: selectedDirection.id, name: selectedDirection.name });
      setShowConfirmDelete(true);
    }
  };

  const handleConfirmDeleteDirection = () => {
    if (directionToDelete) {
      onDeleteDirection(directionToDelete.id, directionToDelete.name);
      setIsModalOpen(false);
      setSelectedDirection(null);
      setDirectionToDelete(null);
      setShowConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 text-left">
      {/* 1. STANDARDIZED PAGE HEADER */}
      <PageHeader title={t("Directions")} />

      {/* Grid of Directions including the "+ Add New Window" */}
      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full">
        {activeDirections.map((dir) => {
          return (
            <button
              key={dir.id}
              onClick={() => handleOpenDirection(dir)}
              type="button"
              className="group bg-white p-5 rounded-2xl border border-gray-100 hover:border-emerald-600 hover:shadow-md transition-all duration-200 text-left cursor-pointer flex flex-col justify-between min-h-[140px]"
            >
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-xl bg-slate-50 text-emerald-800 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                  <Route size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-gray-800 font-sans tracking-tight leading-snug truncate">
                    {dir.name}
                  </h4>
                </div>
              </div>
            </button>
          );
        })}

        {/* Plus-Signed Add New Direction Window Card */}
        {canAddDirection && (
          <button
            onClick={() => handleOpenDirection(null)}
            type="button"
            className="bg-amber-50/10 border-2 border-dashed border-amber-500/20 hover:border-emerald-600/50 hover:bg-emerald-50/5 p-5 rounded-2xl lg:min-h-[140px] flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-gray-400 group-hover:bg-emerald-800 group-hover:text-white transition-all">
              <Plus size={20} />
            </div>
            <span className="text-xs font-black text-gray-500 group-hover:text-emerald-850 transition-colors mt-2">
              {t("Add New Direction")}
            </span>
          </button>
        )}
      </div>

      {/* Main detailed editor Modal */}
      <FormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedDirection ? t('Direction Details') : t('Create New Direction')}
        maxWidthClass="max-w-lg"
        onDelete={selectedDirection && canDeleteDirection ? triggerDeleteDirection : undefined}
        deleteLabel={t("Delete")}
        onCancel={() => setIsModalOpen(false)}
        onSave={handleSave}
        saveLabel={t("Save Changes")}
      >
        <div className="space-y-5">
          {/* Direction Name Form field */}
          <FormInput
            label={`${t("Direction")} *`}
            type="text"
            value={directionNameInput}
            onChange={(e) => setDirectionNameInput(e.target.value)}
            placeholder={t("e.g. East Route")}
          />
        </div>
      </FormModal>

      {/* Standardized Confirmation Overlay for Deleting Directions */}
      <ConfirmDeleteModal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={handleConfirmDeleteDirection}
        title={t("Delete Direction?")}
        message={
          <span>
            {t("Are you sure you want to delete direction")} <strong>"{directionToDelete?.name}"</strong>? {t("It will hide it from the UI immediately. This action is soft-deleted in the database.")}
          </span>
        }
      />

    </div>
  );
}
