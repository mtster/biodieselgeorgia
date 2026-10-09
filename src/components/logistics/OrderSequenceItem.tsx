import React from 'react';
import { ChevronUp, ChevronDown, GripVertical, MapPin } from 'lucide-react';
import { Order } from '../../types';
import { VendorDisplayInfo } from './types';

interface OrderSequenceItemProps {
  order: Order;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  isTouchActive: boolean;
  info: VendorDisplayInfo;
  onSwap: (fromIndex: number, toIndex: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onPointerDown: (e: React.PointerEvent, index: number) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onTouchStart: (e: React.TouchEvent, index: number) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
}

export const OrderSequenceItem: React.FC<OrderSequenceItemProps> = ({
  order,
  index,
  isFirst,
  isLast,
  isDragging,
  isTouchActive,
  info,
  onSwap,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel
}) => {
  return (
    <div
      data-order-index={index}
      draggable={!isTouchActive}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-2xl border transition-all duration-150 p-3 flex items-center justify-between gap-3 shadow-xs select-none ${
        isDragging || isTouchActive
          ? 'opacity-35 border-dashed border-2 border-slate-300 bg-slate-50/70 scale-[0.98]'
          : 'border-gray-200/90 hover:border-slate-300'
      }`}
    >
      {/* Left: Sequence Number & Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center flex-shrink-0 border transition-colors ${
            isTouchActive || isDragging
              ? 'bg-slate-200 text-slate-500 border-slate-300'
              : 'bg-slate-100 text-slate-700 border-slate-200/60'
          }`}
        >
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-800 text-xs truncate">
              {info.tradeName}
            </span>
            {(isTouchActive || isDragging) && (
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-extrabold flex-shrink-0">
                არჩეულია
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
            <MapPin size={11} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{info.address}</span>
          </div>
        </div>
      </div>

      {/* Right: Quick Move Buttons & Drag Grip */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Subtle step buttons for touch ease */}
        <div className="flex flex-col gap-0.5 mr-1">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onSwap(index, index - 1)}
            className={`p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ${
              isFirst ? 'opacity-20 cursor-not-allowed' : ''
            }`}
            title="ზემოთ აწევა"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onSwap(index, index + 1)}
            className={`p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ${
              isLast ? 'opacity-20 cursor-not-allowed' : ''
            }`}
            title="ქვემოთ ჩამოწევა"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Drag Grip Handle - Supports both Mouse & Touch drag on 6-dot icon */}
        <div
          className={`p-2.5 rounded-xl transition cursor-grab active:cursor-grabbing flex items-center justify-center touch-none select-none ${
            isTouchActive
              ? 'bg-emerald-100 text-emerald-800'
              : 'text-slate-400 hover:text-slate-700 active:text-emerald-700 hover:bg-slate-100 active:bg-emerald-50'
          }`}
          style={{ touchAction: 'none' }}
          title="გადაადგილება"
          onPointerDown={(e) => onPointerDown(e, index)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onTouchStart={(e) => onTouchStart(e, index)}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchCancel}
        >
          <GripVertical size={20} className="stroke-[2.4]" />
        </div>
      </div>
    </div>
  );
};
