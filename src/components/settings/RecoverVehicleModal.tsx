import React from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';
import { t } from '../../utils/lang';

interface RecoverVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  plateNumber: string;
}

export default function RecoverVehicleModal({
  isOpen,
  onClose,
  onConfirm,
  plateNumber
}: RecoverVehicleModalProps) {
  if (!isOpen) return null;

  const modalNode = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-[120] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center">
          <RotateCcw size={24} />
        </div>
        
        <div className="space-y-2 text-center">
          <h3 className="font-extrabold text-sm text-gray-950">{t("Recover Deleted Vehicle")}</h3>
          
          <div className="py-1">
            <div className="inline-flex items-center border border-gray-400 bg-white rounded px-2.5 py-0.5 font-mono font-extrabold text-xs shadow-2xs">
              <div className="w-1.5 h-3 bg-blue-700 mr-1.5 rounded-xs"></div>
              <span className="text-gray-900 tracking-wider font-extrabold">{plateNumber}</span>
            </div>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed font-sans">
            {t("Vehicle with this license plate was deleted in the past. Do you want to recover it?")}
          </p>
        </div>

        <div className="flex gap-2.5 pt-2 select-none">
          <button 
            type="button"
            onClick={onClose} 
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            {t("No")}
          </button>
          <button 
            type="button"
            onClick={onConfirm} 
            className="flex-1 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={14} />
            {t("Yes, Recover")}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : null;
}
