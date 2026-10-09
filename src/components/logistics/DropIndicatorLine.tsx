import React from 'react';

interface DropIndicatorLineProps {
  active: boolean;
}

export const DropIndicatorLine: React.FC<DropIndicatorLineProps> = ({ active }) => {
  if (!active) return null;

  return (
    <div className="py-1 -my-1 relative flex items-center justify-center z-20 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95">
      <div className="w-full flex items-center px-1">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-sm shadow-emerald-400/50 flex-shrink-0 ring-2 ring-emerald-200" />
        <div className="h-[3px] flex-1 bg-emerald-600 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-sm shadow-emerald-400/50 flex-shrink-0 ring-2 ring-emerald-200" />
      </div>
    </div>
  );
};
