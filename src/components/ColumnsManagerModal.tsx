import React, { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Plus, Check } from 'lucide-react';
import { t } from '../utils/lang';

export interface ManagedColumn {
  id: string;
  label: string;
  visible: boolean;
  isCustom?: boolean;
}

interface ColumnsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ManagedColumn[];
  onSave: (updated: ManagedColumn[]) => void;
  storageKey: string;
  defaultColumns: ManagedColumn[];
}

export default function ColumnsManagerModal({
  isOpen,
  onClose,
  columns,
  onSave,
  storageKey,
  defaultColumns
}: ColumnsManagerModalProps) {
  const [tempColumns, setTempColumns] = useState<ManagedColumn[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Custom Column adding states
  const [isAdding, setIsAdding] = useState(false);
  const [newColName, setNewColName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTempColumns([...columns]);
      setIsAdding(false);
      setNewColName('');
    }
  }, [isOpen, columns]);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  if (!isOpen) return null;

  const toggleVisibility = (id: string) => {
    setTempColumns(prev =>
      prev.map(col => (col.id === id ? { ...col, visible: !col.visible } : col))
    );
  };

  const handleSaveCustomColumn = () => {
    if (!newColName || !newColName.trim()) {
      setIsAdding(false);
      return;
    }
    const colName = newColName.trim();
    const formattedId = 'custom_' + colName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
    const newCol: ManagedColumn = {
      id: formattedId,
      label: colName,
      visible: true,
      isCustom: true
    };
    setTempColumns(prev => [...prev, newCol]);
    setNewColName('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveCustomColumn();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewColName('');
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const reordered = [...tempColumns];
    const item = reordered.splice(draggedIndex, 1)[0];
    reordered.splice(index, 0, item);
    setDraggedIndex(index);
    setTempColumns(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    onSave(tempColumns);
    onClose();
  };

  const handleResetToDefault = () => {
    // Revert Columns settings to defaults where everything is toggled on and naturally arranged
    const resetList = defaultColumns.map(col => ({
      ...col,
      visible: true
    }));
    setTempColumns(resetList);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-gray-100 p-6 flex flex-col max-h-[85vh]">
        
        {/* Header - Columns Manager */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest font-sans">
              {t("Columns Manager")}
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-650 cursor-pointer p-1 rounded-lg hover:bg-slate-50 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Add New Column Component (Always visible at top) */}
        <div className="mb-4 shrink-0">
          {isAdding ? (
            <div className="flex items-center gap-2 p-2 border-2 border-dashed border-emerald-300 rounded-xl bg-slate-50">
              <input
                ref={inputRef}
                type="text"
                placeholder={t("Enter column name...")}
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={handleSaveCustomColumn}
                className="p-1.5 bg-emerald-700 text-white hover:bg-emerald-850 rounded-lg cursor-pointer transition flex items-center justify-center shrink-0"
                title={t("Add Column") || "Add Column"}
              >
                <Check size={14} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => { setIsAdding(false); setNewColName(''); }}
                className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg cursor-pointer transition flex items-center justify-center shrink-0"
                title={t("Cancel") || "Cancel"}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-slate-50/50 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition text-gray-500 hover:text-emerald-750"
            >
              <Plus size={16} />
              <span className="text-xs font-bold leading-none font-sans">{t("Add New Column")}</span>
            </button>
          )}
        </div>

        {/* Scrollable list of columns */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-text">
          {tempColumns.map((col, idx) => {
            const isDragging = draggedIndex === idx;
            return (
              <div
                key={col.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between p-3 border rounded-xl bg-white transition ${
                  isDragging ? 'border-dashed border-emerald-500 bg-emerald-50/10' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-650 p-0.5">
                    <GripVertical size={16} />
                  </div>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleVisibility(col.id)}
                    className="w-4 h-4 text-emerald-600 border-gray-350 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className={`text-xs font-semibold font-sans ${col.visible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                    {t(col.label)}
                    {col.isCustom && <span className="ml-1.5 text-[8px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded font-mono uppercase">custom</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Reset to Defaults on left and action buttons on right */}
        <div className="border-t border-gray-100 pt-4 mt-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-4 py-2 border border-gray-200 hover:bg-slate-50 font-bold rounded-lg text-xs text-gray-700 transition cursor-pointer"
          >
            {t("Default")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 hover:bg-slate-50 font-bold rounded-lg text-xs text-gray-700 transition cursor-pointer"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg text-xs transition cursor-pointer"
            >
              {t("Save Changes")}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
