import React from 'react';

interface TooltipItem {
  key: string;
  author: string;
  date: string;
  content: string;
}

interface VendorsTooltipProps {
  items: TooltipItem[];
  rect: { top: number; left: number; width: number; height: number } | null;
}

export default function VendorsTooltip({ items, rect }: VendorsTooltipProps) {
  if (!items.length || !rect) return null;

  const tooltipWidth = 320;
  const estimatedLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
  const maxLeft = typeof window !== 'undefined' ? window.innerWidth - tooltipWidth - 16 : 800;
  const clampedLeft = Math.max(16, Math.min(estimatedLeft, maxLeft));

  return (
    <div 
      style={{
        position: 'fixed',
        top: rect.top < 220 
          ? `${rect.top + rect.height + 8}px` 
          : `${rect.top - 8}px`,
        left: `${clampedLeft}px`,
        ...(rect.top >= 220 ? { transform: 'translateY(-100%)' } : {})
      }}
      className="w-80 bg-white border border-slate-200 text-slate-800 rounded-xl p-3.5 shadow-xl text-[12px] leading-relaxed z-50 space-y-2 pointer-events-none select-none transition-all duration-150"
    >
      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 select-text">
        {items.map(item => (
          <div key={item.key} className="border-b border-gray-100 last:border-0 pb-1.5 last:pb-0 font-sans">
            <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mb-0.5 font-sans">
              <span className="text-emerald-800 font-sans">{item.author}</span>
              <span>{item.date}</span>
            </div>
            <p className="font-sans text-gray-750 break-words">{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
