import React from 'react';
import { Vendor } from '../../types';
import { Plus } from 'lucide-react';
import DeleteButton from '../DeleteButton';
import { t } from '../../utils/lang';

interface VendorsViewHeaderActionsProps {
  editingVendor: Vendor | null;
  isNew: boolean;
  isFormSaving: boolean;
  canAdd: boolean;
  canDelete: boolean;
  canAddOrder: boolean;
  selectedVendors: string[];
  handleSaveAndOrder: () => void;
  formRef: React.RefObject<any>;
  askDelete: (id: string, tradeName: string) => void;
  setIsImporting: (b: boolean) => void;
  setShowBulkDeleteConfirm: (b: boolean) => void;
  setIsColModalOpen: (b: boolean) => void;
  setShowGeolocationModal: (b: boolean) => void;
  startNew: () => void;
}

export const VendorsViewHeaderActions: React.FC<VendorsViewHeaderActionsProps> = ({
  editingVendor,
  isNew,
  isFormSaving,
  canAdd,
  canDelete,
  canAddOrder,
  selectedVendors,
  handleSaveAndOrder,
  formRef,
  askDelete,
  setIsImporting,
  setShowBulkDeleteConfirm,
  setIsColModalOpen,
  setShowGeolocationModal,
  startNew
}) => {
  if (editingVendor) {
    return (
      <>
        {canAddOrder && (
          <button
            id="btn-vendor-save-and-order"
            type="button"
            onClick={handleSaveAndOrder}
            disabled={isFormSaving}
            className={`px-4 py-2 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 font-bold rounded-lg text-xs transition cursor-pointer select-none inline-flex items-center gap-1.5 ${isFormSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {t("Save and Order")}
          </button>
        )}
        {isNew && (
          <button 
            onClick={() => formRef.current?.fillDummy()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer select-none"
          >
            {t("Fill Dummy")}
          </button>
        )}
        {canDelete && !isNew && (
          <DeleteButton
            onClick={() => askDelete(editingVendor.id, editingVendor.trade_name)}
          />
        )}
        <button 
          onClick={() => !isFormSaving && formRef.current?.save()}
          disabled={isFormSaving}
          className={`px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer select-none inline-flex items-center gap-1.5 ${isFormSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isFormSaving && (
            <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {t("Save")}
        </button>
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <select
          value=""
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'import') {
              setIsImporting(true);
            } else if (val === 'delete' && selectedVendors.length > 0) {
              setShowBulkDeleteConfirm(true);
            } else if (val === 'col_manager') {
              setIsColModalOpen(true);
            } else if (val === 'geolocation') {
              setShowGeolocationModal(true);
            }
            e.target.value = '';
          }}
          className="px-3.5 py-2.5 pr-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-gray-200 cursor-pointer select-none focus:outline-none appearance-none font-sans"
        >
          <option value="" disabled hidden>{t("Actions")}</option>
          <option value="import" disabled={!canAdd}>{t("Import")}</option>
          <option value="delete" disabled={!canDelete || selectedVendors.length === 0}>
            {t("Delete")} {selectedVendors.length > 0 ? `(${selectedVendors.length})` : ''}
          </option>
          <option value="col_manager">{t("Columns Manager")}</option>
          <option value="geolocation">გეოკოდინგი</option>
        </select>
        <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
          ▼
        </span>
      </div>
      
      {canAdd && (
        <button 
          id="btn-add-new-vendor"
          onClick={startNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 active:bg-emerald-950 transition-all duration-150 cursor-pointer shadow-sm select-none"
        >
          <Plus size={15} />
          {t("Add Supplier")}
        </button>
      )}
    </>
  );
};
