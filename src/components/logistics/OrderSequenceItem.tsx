import React from 'react';
import { ChevronUp, ChevronDown, GripVertical, MapPin, AlertCircle } from 'lucide-react';
import { Order } from '../../types';
import { VendorDisplayInfo } from './types';

export function isBeforeLeavingBase(order: Order): boolean {
  if (!order) return false;
  if ((order as any).before_leaving_base === true || (order as any).before_leaving_base === 'true') {
    return true;
  }
  const rawNotes = (order as any).notes;
  if (!rawNotes) return false;

  if (Array.isArray(rawNotes)) {
    return rawNotes.some(n => Boolean(n && (n.before_leaving_base === true || n.before_leaving_base === 'true' || n.before_leaving_base === 1)));
  }

  if (typeof rawNotes === 'object') {
    if (rawNotes.before_leaving_base === true || rawNotes.before_leaving_base === 'true') return true;
    if (Array.isArray(rawNotes.notes)) {
      return rawNotes.notes.some((n: any) => Boolean(n && (n.before_leaving_base === true || n.before_leaving_base === 'true')));
    }
  }

  if (typeof rawNotes === 'string') {
    try {
      const parsed = JSON.parse(rawNotes);
      if (Array.isArray(parsed)) {
        return parsed.some(n => Boolean(n && (n.before_leaving_base === true || n.before_leaving_base === 'true' || n.before_leaving_base === 1)));
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.before_leaving_base === true || parsed.before_leaving_base === 'true') return true;
        if (Array.isArray(parsed.notes)) {
          return parsed.notes.some((n: any) => Boolean(n && (n.before_leaving_base === true || n.before_leaving_base === 'true')));
        }
      }
    } catch {}
    if (rawNotes.includes('before_leaving_base') && (rawNotes.includes('true') || rawNotes.includes('1'))) {
      return true;
    }
  }

  return false;
}

interface OrderSequenceItemProps {
  order: Order;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  isDragging: boolean;
  isTouchActive: boolean;
  isNew?: boolean;
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
  isNew = false,
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
  const beforeBase = isBeforeLeavingBase(order);

  // Background and badge colors according to hierarchy:
  // 1. before_leaving_base: slight red background
  // 2. isNew: slight green background
  // 3. standard: clean white card
  let cardBg = 'bg-white border-gray-200/90 hover:border-slate-300';
  let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200/60';

  if (beforeBase) {
    cardBg = 'bg-red-50/90 border-red-200/90 text-red-950 shadow-xs';
    badgeBg = 'bg-red-200 text-red-900 border-red-300';
  } else if (isNew) {
    cardBg = 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs';
    badgeBg = 'bg-emerald-200 text-emerald-900 border-emerald-300';
  }

  if (isDragging || isTouchActive) {
    cardBg = 'opacity-35 border-dashed border-2 border-slate-300 bg-slate-50/70 scale-[0.98]';
    badgeBg = 'bg-slate-200 text-slate-500 border-slate-300';
  }

  return (
    <div
      data-order-index={index}
      draggable={!isTouchActive}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`rounded-2xl border transition-all duration-150 p-3 flex items-center justify-between gap-3 shadow-xs select-none ${cardBg}`}
    >
      {/* Left: Sequence Number & Info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center flex-shrink-0 border transition-colors ${badgeBg}`}
        >
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900 text-xs truncate">
              {info.tradeName}
            </span>
            {beforeBase && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-red-100 text-red-700 border border-red-200 flex-shrink-0">
                <AlertCircle size={10} />
                ბაზიდან გასვლამდე
              </span>
            )}
            {isNew && !beforeBase && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/80 flex-shrink-0">
                ახალი
              </span>
            )}
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

      {/* Right: Quick Move Buttons & Right-most 6-dot Drag Grip */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Subtle step buttons for touch ease */}
        <div className="flex flex-col gap-0.5">
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

        {/* 6-dot Drag Grip Handle on the right-most edge */}
        <div
          className={`p-2.5 rounded-xl transition cursor-grab active:cursor-grabbing flex items-center justify-center touch-none select-none ${
            isTouchActive
              ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-300'
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
