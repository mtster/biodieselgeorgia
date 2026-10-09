import React from 'react';
import { Trash2 } from 'lucide-react';
import { t } from '../../utils/lang';

interface OrderBulkDeleteModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function OrderBulkDeleteModal({
  isOpen,
  selectedCount,
  onClose,
  onConfirm
}: OrderBulkDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm border shadow-lg p-6 space-y-4 text-center">
        <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto">
          <Trash2 size={24} />
        </div>
        <div>
          <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">
            {t("Confirm Bulk Orders Deleted")}
          </h4>
          <p className="text-[11.5px] text-gray-455 mt-2 font-sans leading-normal">
            {t("Are you sure you want to soft delete")} <strong>{selectedCount} {t("selected orders")}</strong>? {t("They will hide from the UI immediately.")}
          </p>
        </div>
        <div className="flex gap-2 font-sans pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border hover:bg-slate-50 text-xs font-bold text-gray-600 rounded-xl cursor-pointer"
          >
            {t("No, Keep Them")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-black text-white rounded-xl cursor-pointer"
          >
            {t("Yes, Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
