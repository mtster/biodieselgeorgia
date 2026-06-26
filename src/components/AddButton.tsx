import React from 'react';
import { t } from '../utils/lang';
import { Plus } from 'lucide-react';

interface AddButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
  className?: string;
  disabled?: boolean;
}

export default function AddButton({
  onClick,
  label,
  className = '',
  disabled = false,
}: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-700 font-semibold rounded-lg transition inline-flex items-center gap-1 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <Plus size={12} /> {t(label)}
    </button>
  );
}
