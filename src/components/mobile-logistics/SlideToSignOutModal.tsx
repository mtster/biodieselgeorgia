import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, X, Check, LogOut, ShieldAlert } from 'lucide-react';

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

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen]);

  const updateDimensions = useCallback(() => {
    if (trackRef.current) {
      const trackWidth = trackRef.current.clientWidth;
      const knobWidth = 50;
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
        navigator.vibrate([35, 50, 35]);
      }
    } catch {}

    setTimeout(() => {
      onConfirm();
    }, 400);
  };

  if (!isOpen) return null;

  const progress = maxDragRef.current > 0 ? Math.min(dragOffset / maxDragRef.current, 1) : 0;

  return (
    <AnimatePresence>
      {/* Vertically and horizontally centered on ALL screens including mobile */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col my-auto"
        >
          {/* Sleek App-Themed Header */}
          <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-850 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800/60 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-300 shadow-xs">
                <LogOut size={15} />
              </div>
              <h3 className="text-sm font-black tracking-tight text-white leading-tight">
                სისტემიდან გამოსვლა
              </h3>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white/90 transition cursor-pointer"
              title="დახურვა"
            >
              <X size={15} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center space-y-1">
              <p className="text-xs font-bold text-slate-800">
                ნამდვილად გსურთ პორტალიდან გამოსვლა?
              </p>
              <p className="text-[11px] text-slate-500 font-medium">
                დასადასტურებლად გაასრიალეთ ქვედა ღილაკი მარცხნივ
              </p>
            </div>

            {/* Sleek Right-to-Left Slider Track */}
            <div
              ref={trackRef}
              className="relative h-13 w-full bg-slate-900 rounded-2xl p-1.5 flex items-center overflow-hidden shadow-inner border border-slate-800/80 select-none touch-none"
            >
              {/* Dynamic Fill (Expands from right to left) */}
              <div
                className="absolute top-1.5 bottom-1.5 right-1.5 bg-gradient-to-l from-rose-600 via-rose-500 to-amber-600 rounded-xl transition-all duration-75"
                style={{
                  width: `${dragOffset + 50}px`
                }}
              />

              {/* Instruction Text & Animated Chevrons */}
              <div
                className={`absolute inset-0 flex items-center justify-start pl-4 pointer-events-none transition-opacity duration-150 ${
                  progress > 0.45 ? 'opacity-15' : 'opacity-100'
                }`}
              >
                <div className="flex items-center gap-1.5 text-white/90 text-xs font-black tracking-tight">
                  <div className="flex items-center -space-x-1.5 text-rose-300 animate-pulse">
                    <ChevronLeft size={16} />
                    <ChevronLeft size={16} />
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
                  transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
                className={`absolute right-1.5 top-1.5 bottom-1.5 w-11 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg select-none transition-colors ${
                  isConfirmed
                    ? 'bg-emerald-500 text-white shadow-emerald-500/50'
                    : progress > 0.6
                    ? 'bg-white text-rose-600 shadow-rose-900/30'
                    : 'bg-white text-slate-800 shadow-md'
                }`}
              >
                {isConfirmed ? (
                  <Check size={18} className="animate-scale-in" />
                ) : (
                  <ChevronLeft size={20} className="animate-pulse" />
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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
