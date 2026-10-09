import React from 'react';
import { Order } from '../../types';
import { Plus } from 'lucide-react';
import DeleteButton from '../DeleteButton';
import { t } from '../../utils/lang';

interface OrdersViewHeaderActionsProps {
  editingOrder: Order | null;
  canDelete: boolean;
  canAdd: boolean;
  canAddComm: boolean;
  isFormSaving: boolean;
  selectedOrders: string[];
  smsLogsCount: number;
  handleSaveAndReminder: () => void;
  formRef: React.RefObject<any>;
  askDelete: (id: string, docNum: string) => void;
  loadSMSLogs: () => void;
  setShowSMSLogs: (b: boolean) => void;
  setShowBulkDeleteConfirm: (b: boolean) => void;
  setShowAssignDriverModal: (b: boolean) => void;
  setIsColModalOpen: (b: boolean) => void;
  startNew: () => void;
}

export const OrdersViewHeaderActions: React.FC<OrdersViewHeaderActionsProps> = ({
  editingOrder,
  canDelete,
  canAdd,
  canAddComm,
  isFormSaving,
  selectedOrders,
  smsLogsCount,
  handleSaveAndReminder,
  formRef,
  askDelete,
  loadSMSLogs,
  setShowSMSLogs,
  setShowBulkDeleteConfirm,
  setShowAssignDriverModal,
  setIsColModalOpen,
  startNew
}) => {
  if (editingOrder) {
    return (
      <>
        {canDelete && editingOrder.id && (
          <DeleteButton
            onClick={() => {
              askDelete(editingOrder.id, editingOrder.doc_number);
            }}
          />
        )}
        {canAddComm && (
          <button
            id="btn-order-save-and-reminder"
            type="button"
            onClick={handleSaveAndReminder}
            disabled={isFormSaving}
            className={`px-4 py-2 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 font-bold rounded-lg text-xs transition cursor-pointer select-none inline-flex items-center gap-1.5 ${isFormSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {t("Save and Reminder")}
          </button>
        )}
        <button 
          onClick={() => formRef.current?.fillDummy()}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-700 transition cursor-pointer select-none"
        >
          {t("Fill Dummy")}
        </button>
        <button 
          onClick={() => formRef.current?.save()}
          className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
        >
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
            if (val === 'sms_logs') {
              loadSMSLogs();
              setShowSMSLogs(true);
            } else if (val === 'delete' && canDelete && selectedOrders.length > 0) {
              setShowBulkDeleteConfirm(true);
            } else if (val === 'assign_driver' && selectedOrders.length > 0) {
              setShowAssignDriverModal(true);
            } else if (val === 'col_manager') {
              setIsColModalOpen(true);
            }
            e.target.value = '';
          }}
          className="px-3.5 py-2.5 pr-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-gray-200 cursor-pointer select-none focus:outline-none appearance-none font-sans"
        >
          <option value="" disabled hidden>{t("Actions")}</option>
          <option value="sms_logs">{t("SMS Logs")} ({smsLogsCount})</option>
          <option value="assign_driver" disabled={selectedOrders.length === 0}>
            {t("Assign Crew")} {selectedOrders.length > 0 ? `(${selectedOrders.length})` : ''}
          </option>
          {canDelete && (
            <option value="delete" disabled={!canDelete || selectedOrders.length === 0}>
              {t("Delete")} {selectedOrders.length > 0 ? `(${selectedOrders.length})` : ''}
            </option>
          )}
          <option value="col_manager">{t("Columns Manager")}</option>
        </select>
        <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
          ▼
        </span>
      </div>
      
      {canAdd && (
        <button 
          onClick={startNew}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition shadow-sm cursor-pointer select-none font-sans"
        >
          <Plus size={15} />
          {t("New Order")}
        </button>
      )}
    </>
  );
};
