import React, { ReactNode } from 'react';
import { X } from 'lucide-react';
import DeleteButton from './DeleteButton';
import { t } from '../utils/lang';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  onDelete?: () => void;
  deleteLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  onSave?: () => void;
  saveLabel?: string;
  maxWidthClass?: string; // e.g. "max-w-md", "max-w-sm", etc.
}

export default function FormModal({
  isOpen,
  onClose,
  title,
  children,
  onDelete,
  deleteLabel = 'Delete',
  onCancel,
  cancelLabel = 'Cancel',
  onSave,
  saveLabel = 'Save Changes',
  maxWidthClass = 'max-w-md',
}: FormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className={`bg-white rounded-2xl w-full ${maxWidthClass} shadow-xl border border-slate-200 overflow-hidden p-6 relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150`}>
        {/* Modal Header without border-b */}
        <div className="flex items-center justify-between pb-3 mb-4 shrink-0">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
            {t(title)}
          </h3>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-450 hover:text-gray-700 cursor-pointer p-1 rounded-lg hover:bg-slate-50 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 py-1 text-left">
          {children}
        </div>

        {/* Modal Bottom row without border-t */}
        <div className="pt-4 mt-4 flex items-center justify-between shrink-0 select-none">
          {onDelete ? (
            <div className="mr-auto select-none">
              <DeleteButton
                onClick={onDelete}
                label={t(deleteLabel)}
              />
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel || onClose}
              className="px-4 py-2 border border-gray-200 hover:bg-slate-50 font-bold rounded-lg text-xs text-gray-700 transition cursor-pointer select-none"
            >
              {t(cancelLabel)}
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-black rounded-lg text-xs transition cursor-pointer select-none"
              >
                {t(saveLabel)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
