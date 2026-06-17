import React from 'react';
import { Trash2 } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: React.ReactNode;
  itemName?: string;
}

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  message,
  itemName
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="mx-auto w-12 h-12 bg-red-50 text-red-655 rounded-full flex items-center justify-center">
          <Trash2 size={24} />
        </div>
        
        <div className="space-y-1.5 text-center">
          <h3 className="font-extrabold text-sm text-gray-950">{title}</h3>
          <div className="text-xs text-gray-500 leading-relaxed font-sans">
            {message ? (
              message
            ) : itemName ? (
              <span>
                Are you sure you want to delete <strong>"{itemName}"</strong>? This action is irreversible.
              </span>
            ) : (
              <span>Are you sure you want to delete this item? This action is irreversible.</span>
            )}
          </div>
        </div>

        <div className="flex gap-2.5 pt-2 select-none">
          <button 
            type="button"
            onClick={onClose} 
            className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={onConfirm} 
            className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
