import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronsLeft, X, Check } from 'lucide-react';

interface SlideToSignOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SlideToSignOutModal({ isOpen, onClose, onConfirm }: SlideToSignOutModalProps) {
  const [dragX, setDragX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  const trackRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const startClientXRef = useRef<number>(0);
  const currentDragXRef = useRef<number>(0);

  const PADDING = 4;
  const HANDLE_WIDTH = 48;

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

  const getMaxDistance = useCallback(() => {
    if (!trackRef.current) return 200;
    return Math.max(50, trackRef.current.clientWidth - HANDLE_WIDTH - PADDING * 2);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDragX(0);
      currentDragXRef.current = 0;
      setIsDragging(false);
      setIsConfirmed(false);
    }
  }, [isOpen]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isConfirmed) return;
    setIsDragging(true);
    // Dragging from right to left: moving left increases deltaX
    startClientXRef.current = e.clientX + dragX;
    currentDragXRef.current = dragX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isConfirmed) return;
    const maxDist = getMaxDistance();
    // Delta moving left: startClientXRef - e.clientX
    const newX = Math.min(Math.max(0, startClientXRef.current - e.clientX), maxDist);
    currentDragXRef.current = newX;
    setDragX(newX);
    // Do NOT trigger on move - only on release!
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const maxDist = getMaxDistance();
    // Only trigger sign out if user RELEASES near the left end (>= 82% of max track)
    if (currentDragXRef.current >= maxDist * 0.82) {
      setDragX(maxDist);
      setIsConfirmed(true);
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([35, 50, 35]);
        }
      } catch {}

      setTimeout(() => {
        onConfirm();
      }, 350);
    } else {
      // Slid back or released early: smoothly snap back to right
      setDragX(0);
      currentDragXRef.current = 0;
    }
  };

  const handlePointerCancel = () => {
    if (!isConfirmed) {
      setIsDragging(false);
      setDragX(0);
      currentDragXRef.current = 0;
    }
  };

  if (!isOpen) return null;

  const maxDist = getMaxDistance();
  const progressRatio = maxDist > 0 ? Math.min(1, dragX / maxDist) : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Window without corner bleeding or white outline border */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-sm bg-emerald-950 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col my-auto"
        >
          {/* Top Green Header matching Office Contacts modal */}
          <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800/60 rounded-t-3xl">
            <h3 className="text-sm font-black tracking-tight text-white leading-tight">
              გამოსვლა
            </h3>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white/90 transition cursor-pointer"
              title="დახურვა"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body Content */}
          <div className="bg-white rounded-b-3xl p-5 space-y-4">
            <p className="text-xs font-bold text-slate-700 text-center">
              ნამდვილად გსურთ პორტალიდან გამოსვლა?
            </p>

            {/* Slider matching SlideToConfirm design with slight red background */}
            <div
              ref={trackRef}
              className={`relative h-14 w-full rounded-2xl select-none overflow-hidden flex items-center p-1 border transition-colors ${
                isConfirmed
                  ? 'bg-rose-600 border-rose-700'
                  : 'bg-rose-50/80 border-rose-200/90 shadow-inner'
              }`}
              style={{ touchAction: 'none' }}
            >
              {/* Filled progress background expanding from the right */}
              <div
                className={`absolute right-0 top-0 bottom-0 rounded-2xl transition-all ${
                  isConfirmed ? 'bg-rose-600 w-full' : 'bg-rose-500/20'
                }`}
                style={{
                  width: isConfirmed ? '100%' : `${dragX + HANDLE_WIDTH + PADDING}px`,
                  transition: isDragging ? 'none' : 'width 0.25s ease-out',
                }}
              />

              {/* Centered prompt text */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none px-12"
                style={{
                  opacity: isConfirmed ? 0 : Math.max(0.12, 1 - progressRatio * 1.4),
                  transition: isDragging ? 'none' : 'opacity 0.2s ease-out',
                }}
              >
                <span className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-2">
                  <ChevronsLeft size={16} className="text-rose-600 animate-pulse stroke-[2.5]" />
                  გასვლა
                </span>
              </div>

              {/* Confirmed text */}
              {isConfirmed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white font-extrabold text-xs tracking-wider uppercase">
                  გამოსვლა...
                </div>
              )}

              {/* Drag handle (iOS-style release-to-trigger) */}
              <div
                ref={handleRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                style={{
                  right: `${dragX + PADDING}px`,
                  transition: isDragging ? 'none' : 'right 0.25s ease-out',
                }}
                className={`absolute top-1 bottom-1 w-12 rounded-xl flex items-center justify-center text-white shadow-md cursor-grab active:cursor-grabbing z-10 transition-colors ${
                  isConfirmed
                    ? 'bg-white text-rose-700 shadow-lg'
                    : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                }`}
              >
                {isConfirmed ? (
                  <Check size={20} className="stroke-[3]" />
                ) : (
                  <ChevronsLeft size={20} className="stroke-[2.5]" />
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
