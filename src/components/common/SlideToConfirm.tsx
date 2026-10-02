import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronsRight, Check } from 'lucide-react';

interface SlideToConfirmProps {
  text?: string;
  onConfirm: () => boolean | void; // Return false to cancel/reset slider if validation fails
  disabled?: boolean;
}

export function SlideToConfirm({
  text = 'დადასტურება',
  onConfirm,
  disabled = false,
}: SlideToConfirmProps) {
  const [dragX, setDragX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const currentDragXRef = useRef<number>(0);

  const PADDING = 4;
  const HANDLE_WIDTH = 48;

  const getMaxDistance = useCallback(() => {
    if (!trackRef.current) return 200;
    return Math.max(50, trackRef.current.clientWidth - HANDLE_WIDTH - PADDING * 2);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || isConfirmed) return;
    setIsDragging(true);
    startXRef.current = e.clientX - dragX;
    currentDragXRef.current = dragX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled || isConfirmed) return;
    const maxDist = getMaxDistance();
    const newX = Math.min(Math.max(0, e.clientX - startXRef.current), maxDist);
    currentDragXRef.current = newX;
    setDragX(newX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const maxDist = getMaxDistance();
    // If dragged at least 75% of the track, trigger confirmation
    if (currentDragXRef.current >= maxDist * 0.75) {
      setDragX(maxDist);
      setIsConfirmed(true);
      // Execute confirmation
      const result = onConfirm();
      if (result === false) {
        // Validation failed, reset slider
        setIsConfirmed(false);
        setDragX(0);
      }
    } else {
      // Snapped back
      setDragX(0);
    }
  };

  const handlePointerCancel = () => {
    if (!isConfirmed) {
      setIsDragging(false);
      setDragX(0);
    }
  };

  const maxDist = getMaxDistance();
  const progressRatio = maxDist > 0 ? Math.min(1, dragX / maxDist) : 0;

  return (
    <div
      ref={trackRef}
      className={`relative h-14 w-full rounded-2xl select-none overflow-hidden flex items-center p-1 border transition-colors ${
        disabled
          ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
          : isConfirmed
          ? 'bg-emerald-600 border-emerald-700'
          : 'bg-emerald-50/80 border-emerald-200/90 shadow-inner'
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Filled progress background */}
      <div
        className={`absolute left-0 top-0 bottom-0 rounded-2xl transition-all ${
          isConfirmed ? 'bg-emerald-600 w-full' : 'bg-emerald-500/20'
        }`}
        style={{
          width: isConfirmed ? '100%' : `${dragX + HANDLE_WIDTH + PADDING}px`,
          transition: isDragging ? 'none' : 'width 0.25s ease-out',
        }}
      />

      {/* Centered prompt text */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none px-14"
        style={{
          opacity: isConfirmed ? 0 : Math.max(0.15, 1 - progressRatio * 1.4),
          transition: isDragging ? 'none' : 'opacity 0.2s ease-out',
        }}
      >
        <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-2">
          {text}
          <ChevronsRight size={16} className="text-emerald-600 animate-pulse stroke-[2.5]" />
        </span>
      </div>

      {/* Confirmed text */}
      {isConfirmed && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-extrabold text-xs tracking-wider uppercase">
          დადასტურებულია
        </div>
      )}

      {/* Drag handle */}
      <div
        ref={handleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`absolute top-1 bottom-1 w-12 rounded-xl flex items-center justify-center text-white shadow-md cursor-grab active:cursor-grabbing z-10 transition-colors ${
          disabled
            ? 'bg-gray-300'
            : isConfirmed
            ? 'bg-white text-emerald-700 shadow-lg'
            : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
        }`}
        style={{
          left: `${PADDING}px`,
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.2s',
          touchAction: 'none',
        }}
      >
        {isConfirmed ? (
          <Check size={20} className="stroke-[3]" />
        ) : (
          <ChevronsRight size={22} className="stroke-[2.5]" />
        )}
      </div>
    </div>
  );
}
