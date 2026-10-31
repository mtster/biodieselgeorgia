import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, X, Check } from 'lucide-react';

interface SlideToSignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SlideToSignOutModal({ isOpen, onClose, onConfirm }: SlideToSignOutModalProps) {
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const maxDragRef = useRef<number>(200);

  const updateDimensions = useCallback(() => {
    if (trackRef.current) {
      const trackWidth = trackRef.current.clientWidth;
      const knobWidth = 48;
      maxDragRef.current = Math.max(trackWidth - knobWidth - 8, 120);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDragOffset(0);
      setIsDragging(false);
      setIsConfirmed(false);
      const timer = setTimeout(updateDimensions, 100);
      window.addEventListener('resize', updateDimensions);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateDimensions);
      };
    }
  }, [isOpen, updateDimensions]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isConfirmed) return;
    setIsDragging(true);
    startXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isConfirmed) return;
    const deltaX = startXRef.current - e.clientX;
    const clamped = Math.max(0, Math.min(deltaX, maxDragRef.current));
    setDragOffset(clamped);

    if (clamped >= maxDragRef.current * 0.88) {
      triggerSuccess();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging || isConfirmed) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (dragOffset >= maxDragRef.current * 0.88) {
      triggerSuccess();
    } else {
      setDragOffset(0);
    }
  };

  const triggerSuccess = () => {
    setIsConfirmed(true);
    setDragOffset(maxDragRef.current);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
    } catch {}

    setTimeout(() => {
      onConfirm();
    }, 380);
  };

  if (!isOpen) return null;

  const progress = maxDragRef.current > 0 ? Math.min(dragOffset / maxDragRef.current, 1) : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-xs bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 leading-tight">
              გამოსვლა
            </h3>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-500 transition cursor-pointer"
              title="დახურვა"
            >
              <X size={15} />
            </button>
          </div>

          <p className="text-xs text-slate-600 font-medium text-center py-1">
            ნამდვილად გსურთ სისტემიდან გამოსვლა?
          </p>

          {/* Right-to-Left Slider Track */}
          <div
            ref={trackRef}
            className="relative h-12 w-full bg-slate-100 rounded-xl p-1 flex items-center overflow-hidden border border-slate-200/90 select-none touch-none"
          >
            {/* Dynamic Fill (Expands from right to left) */}
            <div
              className="absolute top-1 bottom-1 right-1 bg-rose-500 rounded-lg transition-all duration-75"
              style={{
                width: `${dragOffset + 48}px`
              }}
            />

            {/* Instruction Text & Animated Arrows */}
            <div
              className={`absolute inset-0 flex items-center justify-start pl-3.5 pointer-events-none transition-opacity duration-150 ${
                progress > 0.4 ? 'opacity-20' : 'opacity-100'
              }`}
            >
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold">
                <div className="flex items-center -space-x-1 text-slate-400">
                  <ChevronLeft size={14} />
                  <ChevronLeft size={14} />
                </div>
                <span>გაასრიალეთ მარცხნივ</span>
              </div>
            </div>

            {/* Slider Knob */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                transform: `translateX(-${dragOffset}px)`,
                transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
              }}
              className={`absolute right-1 top-1 bottom-1 w-11 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing shadow-xs select-none transition-colors ${
                isConfirmed
                  ? 'bg-emerald-500 text-white'
                  : progress > 0.5
                  ? 'bg-white text-rose-600 shadow-md'
                  : 'bg-white text-slate-700 shadow-xs'
              }`}
            >
              {isConfirmed ? (
                <Check size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
            </div>
          </div>

          {/* Cancel Button */}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer select-none"
          >
            გაუქმება
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
