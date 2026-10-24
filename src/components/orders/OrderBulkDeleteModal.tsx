import React from 'react';
import { Trash2 } from 'lucide-react';
import { t } from '../../utils/lang';

interface OrderBulkDeleteModalProps {
  isOpen: boolean;
  selectedCount?: number;
  vendorName?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function OrderBulkDeleteModal({
  isOpen,
  selectedCount = 0,
  vendorName,
  onClose,
  onConfirm
}: OrderBulkDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-sm border border-gray-100 shadow-xl p-6 space-y-4 text-center animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <Trash2 size={24} className="text-red-600" />
        </div>
        <div className="space-y-2">
          <h4 className="text-base font-bold text-gray-900 tracking-normal leading-snug">
            {vendorName ? t("Delete Order") : t("Confirm Bulk Orders Deleted")}
          </h4>
          <p className="text-xs text-gray-500 font-sans leading-relaxed">
            {vendorName ? (
              <span>
                დარწმუნებული ხართ, რომ გსურთ{' '}
                <strong className="font-semibold text-gray-800">"{vendorName}"</strong>
                -ს შეკვეთის წაშლა? {t("This action cannot be undone.")}
              </span>
            ) : (
              <span>
                {t("Are you sure you want to delete")}{' '}
                <strong className="font-semibold text-gray-800">
                  {selectedCount} {t("selected orders")}
                </strong>
                ? {t("This action cannot be undone.")}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2.5 font-sans pt-2 select-none">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            {t("No, Keep Them")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            {t("Yes, Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

