import React from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';
import { t } from '../../utils/lang';

interface VehicleRecoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  plateNumber: string;
}

export default function VehicleRecoverModal({
  isOpen,
  onClose,
  onConfirm,
  plateNumber
}: VehicleRecoverModalProps) {
  if (!isOpen) return null;

  const modalNode = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
          <RotateCcw size={24} />
        </div>
        
        <div className="space-y-2 text-center">
          <h3 className="font-extrabold text-base text-gray-950">
            {t("Restore Deleted Vehicle")}
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed font-sans px-1">
            ამ სახელმწიფო ნომრით (<strong className="font-mono text-gray-900">{plateNumber}</strong>) ავტომობილი წარსულში წაშლილი იყო. გსურთ მისი აღდგენა?
          </p>
        </div>

        <div className="flex gap-2.5 pt-2 select-none">
          <button 
            type="button"
            onClick={onClose} 
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer active:scale-98"
          >
            {t("No")}
          </button>
          <button 
            type="button"
            onClick={onConfirm} 
            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-sm active:scale-98"
          >
            {t("Yes, Recover")}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}
