import React from 'react';
import { Check, Minus } from 'lucide-react';

interface SelectAllHeaderCheckboxProps {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function SelectAllHeaderCheckbox({
  allSelected,
  someSelected,
  onToggle,
  disabled = false
}: SelectAllHeaderCheckboxProps) {
  return (
    <div 
      onClick={(e) => e.stopPropagation()} 
      className="flex items-center justify-center w-full h-full bg-transparent"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`w-[19px] h-[19px] rounded-[5px] border-[1.4px] flex items-center justify-center p-0 shrink-0 mx-auto cursor-pointer transition-all duration-150 ${
          disabled
            ? 'opacity-40 cursor-not-allowed border-gray-250 bg-gray-50'
            : allSelected
            ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
            : someSelected
            ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-2xs'
            : 'border-slate-400 bg-white hover:border-slate-600 hover:bg-slate-50 shadow-2xs'
        }`}
      >
        {allSelected ? (
          <Check size={14} strokeWidth={3.5} className="block shrink-0 translate-y-[0.5px]" />
        ) : someSelected ? (
          <Minus size={14} strokeWidth={3.5} className="block shrink-0" />
        ) : null}
      </button>
    </div>
  );
}
