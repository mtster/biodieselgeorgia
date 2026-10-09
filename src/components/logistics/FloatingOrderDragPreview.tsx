import React from 'react';
import { GripVertical, MapPin } from 'lucide-react';
import { FloatingDragState } from './types';

interface FloatingOrderDragPreviewProps {
  floatingDrag: FloatingDragState | null;
}

export const FloatingOrderDragPreview: React.FC<FloatingOrderDragPreviewProps> = ({ floatingDrag }) => {
  if (!floatingDrag) return null;

  return (
    <div
      className="fixed pointer-events-none z-50 transition-none select-none"
      style={{
        left: `${floatingDrag.left}px`,
        top: `${floatingDrag.currentY - floatingDrag.grabOffsetY}px`,
        width: `${floatingDrag.width}px`,
        height: `${floatingDrag.height}px`,
        transform: 'scale(1.03) rotate(-1deg)',
        filter: 'drop-shadow(0 20px 25px rgba(0, 0, 0, 0.22)) drop-shadow(0 8px 10px rgba(0, 0, 0, 0.12))'
      }}
    >
      <div className="w-full h-full bg-white rounded-2xl border-2 border-emerald-600 ring-4 ring-emerald-400/40 p-3 flex items-center justify-between gap-3 shadow-2xl">
        {/* Left: Sequence Number & Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center flex-shrink-0 bg-emerald-700 text-white border border-emerald-800 shadow-sm">
            {floatingDrag.index + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 text-xs truncate">
                {floatingDrag.tradeName}
              </span>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-extrabold flex-shrink-0 animate-pulse">
                გადაადგილება...
              </span>
            </div>
            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
              <MapPin size={11} className="text-slate-400 flex-shrink-0" />
              <span className="truncate">{floatingDrag.address}</span>
            </div>
          </div>
        </div>

        {/* Right: Grip Handle in active dragging state */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="p-2.5 rounded-xl bg-emerald-700 text-white ring-4 ring-emerald-300 shadow-md flex items-center justify-center">
            <GripVertical size={20} className="stroke-[2.4]" />
          </div>
        </div>
      </div>
    </div>
  );
};
