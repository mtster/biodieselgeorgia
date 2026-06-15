import React from 'react';
import { FileSpreadsheet, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  importText: string;
  setImportText: (text: string) => void;
  onImport: () => void;
}

export default function VendorImportModal({ isOpen, onClose, importText, setImportText, onImport }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
          <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
            <FileSpreadsheet className="text-emerald-700" size={16} />
            Import Data from Excel File
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <p className="text-[11px] text-gray-550 leading-relaxed font-sans text-left">
          Copy and paste columns directly from Excel (Format: <strong>Trade Name, Legal Name, Identification Code</strong> separated by TAB or commas).
        </p>

        <textarea 
          rows={8}
          placeholder="e.g. Traditional Georgian Biodiesel, Bio-Petrol LLC, 204857392"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
        ></textarea>

        <div className="flex items-center justify-end gap-2.5 select-none font-sans">
          <button 
            onClick={onClose} 
            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Cancel
          </button>
          <button 
            onClick={onImport}
            className="px-5 py-1.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-955 text-white rounded-xl text-xs font-black transition inline-flex items-center gap-1 cursor-pointer"
          >
            Launch Import
          </button>
        </div>
      </div>
    </div>
  );
}
