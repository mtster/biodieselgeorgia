import React from 'react';
import { t } from '../utils/lang';

interface SaveButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export default function SaveButton({
  onClick,
  label = 'Save',
  className = '',
  disabled = false,
}: SaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl text-xs transition cursor-pointer select-none flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {t(label)}
    </button>
  );
}
