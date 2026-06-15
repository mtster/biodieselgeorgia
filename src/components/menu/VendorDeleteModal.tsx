import React from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  vendorName: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function VendorDeleteModal({ vendorName, onClose, onConfirm }: Props) {
  if (!vendorName) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
          <Trash2 size={24} />
        </div>
        
        <div className="space-y-1.5 text-center">
          <h3 className="font-extrabold text-sm text-gray-950">Remove Supplier / Vendor?</h3>
          <p className="text-xs text-gray-450 leading-relaxed font-sans">
            Are you sure you want to delete supplier <strong>"{vendorName}"</strong>? This registration sequence will be hidden and marked deleted.
          </p>
        </div>

        <div className="flex gap-2.5 pt-2 select-none">
          <button 
            onClick={onClose} 
            className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button 
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
