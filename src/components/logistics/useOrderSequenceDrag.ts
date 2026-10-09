import React, { useState, useRef } from 'react';
import { Order } from '../../types';
import { FloatingDragState, VendorDisplayInfo } from './types';

interface UseOrderSequenceDragOptions {
  items: Order[];
  getVendorInfo: (order: Order) => VendorDisplayInfo;
  onMove: (fromIndex: number, targetInsertionIndex: number) => void;
}

export function useOrderSequenceDrag({
  items,
  getVendorInfo,
  onMove
}: UseOrderSequenceDragOptions) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchActiveIndex, setTouchActiveIndex] = useState<number | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [floatingDrag, setFloatingDrag] = useState<FloatingDragState | null>(null);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const touchActiveIdxRef = useRef<number | null>(null);
  const insertionIdxRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const capturedElRef = useRef<HTMLElement | null>(null);

  // Helper to geometrically determine target insertion gap from clientY
  const getInsertionIndexFromClientY = (clientY: number): number => {
    if (!listContainerRef.current) return 0;
    const rowElements = Array.from(
      listContainerRef.current.querySelectorAll<HTMLElement>('[data-order-index]')
    );
    if (rowElements.length === 0) return 0;

    for (let i = 0; i < rowElements.length; i++) {
      const rect = rowElements[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        return i; // Insert before row i
      }
    }
    return rowElements.length; // Insert after the last row
  };

  // Auto-scroll helper when dragging near top/bottom of scroll container
  const handleAutoScroll = (clientY: number) => {
    if (!listContainerRef.current) return;
    const containerRect = listContainerRef.current.getBoundingClientRect();
    const threshold = 60;
    if (clientY < containerRect.top + threshold) {
      const delta = Math.max(4, Math.min(18, (containerRect.top + threshold - clientY) / 2));
      listContainerRef.current.scrollTop -= delta;
    } else if (clientY > containerRect.bottom - threshold) {
      const delta = Math.max(4, Math.min(18, (clientY - (containerRect.bottom - threshold)) / 2));
      listContainerRef.current.scrollTop += delta;
    }
  };

  // HTML5 Drag Handlers (Desktop Mouse)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (touchActiveIdxRef.current !== null) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const insIdx = getInsertionIndexFromClientY(e.clientY);
    if (insIdx !== insertionIdxRef.current) {
      insertionIdxRef.current = insIdx;
      setInsertionIndex(insIdx);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIdx = draggedIndex;
    const toInsIdx = insertionIdxRef.current;
    if (fromIdx !== null && toInsIdx !== null) {
      onMove(fromIdx, toInsIdx);
    }
    setDraggedIndex(null);
    setInsertionIndex(null);
    insertionIdxRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setInsertionIndex(null);
    insertionIdxRef.current = null;
  };

  // Pointer Drag Handlers (Modern touch & mobile browsers)
  const handleGripPointerDown = (e: React.PointerEvent, idx: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget as HTMLElement;
    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch {}

    const rowEl = (targetEl.closest('[data-order-index]') as HTMLElement) || targetEl;
    const rect = rowEl.getBoundingClientRect();
    const grabOffsetY = e.clientY - rect.top;
    const order = items[idx];
    const info = getVendorInfo(order);

    pointerIdRef.current = e.pointerId;
    capturedElRef.current = targetEl;
    touchActiveIdxRef.current = idx;
    insertionIdxRef.current = idx;
    setTouchActiveIndex(idx);
    setInsertionIndex(idx);

    setFloatingDrag({
      index: idx,
      tradeName: info.tradeName,
      address: info.address,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      grabOffsetY: grabOffsetY > 0 && grabOffsetY < rect.height ? grabOffsetY : rect.height / 2,
      currentY: e.clientY
    });

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate?.(25); } catch {}
    }
  };

  const handleGripPointerMove = (e: React.PointerEvent) => {
    if (touchActiveIdxRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();

    handleAutoScroll(e.clientY);
    setFloatingDrag(prev => (prev ? { ...prev, currentY: e.clientY } : null));

    const insIdx = getInsertionIndexFromClientY(e.clientY);
    if (insIdx !== insertionIdxRef.current) {
      insertionIdxRef.current = insIdx;
      setInsertionIndex(insIdx);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.(12); } catch {}
      }
    }
  };

  const handleGripPointerUp = (e: React.PointerEvent) => {
    if (touchActiveIdxRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();

    const fromIdx = touchActiveIdxRef.current;
    const toInsIdx = insertionIdxRef.current;

    if (capturedElRef.current && pointerIdRef.current !== null) {
      try {
        capturedElRef.current.releasePointerCapture(pointerIdRef.current);
      } catch {}
    }

    pointerIdRef.current = null;
    capturedElRef.current = null;
    touchActiveIdxRef.current = null;
    insertionIdxRef.current = null;
    setTouchActiveIndex(null);
    setInsertionIndex(null);
    setFloatingDrag(null);

    if (fromIdx !== null && toInsIdx !== null) {
      onMove(fromIdx, toInsIdx);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.(35); } catch {}
      }
    }
  };

  const handleGripPointerCancel = () => {
    if (capturedElRef.current && pointerIdRef.current !== null) {
      try {
        capturedElRef.current.releasePointerCapture(pointerIdRef.current);
      } catch {}
    }
    pointerIdRef.current = null;
    capturedElRef.current = null;
    touchActiveIdxRef.current = null;
    insertionIdxRef.current = null;
    setTouchActiveIndex(null);
    setInsertionIndex(null);
    setFloatingDrag(null);
  };

  // Touch Fallback Handlers
  const handleTouchStart = (e: React.TouchEvent, idx: number) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;

    const targetEl = e.currentTarget as HTMLElement;
    const rowEl = (targetEl.closest('[data-order-index]') as HTMLElement) || targetEl;
    const rect = rowEl.getBoundingClientRect();
    const grabOffsetY = touch.clientY - rect.top;
    const order = items[idx];
    const info = getVendorInfo(order);

    touchActiveIdxRef.current = idx;
    insertionIdxRef.current = idx;
    setTouchActiveIndex(idx);
    setInsertionIndex(idx);

    setFloatingDrag({
      index: idx,
      tradeName: info.tradeName,
      address: info.address,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      grabOffsetY: grabOffsetY > 0 && grabOffsetY < rect.height ? grabOffsetY : rect.height / 2,
      currentY: touch.clientY
    });

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate?.(25); } catch {}
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchActiveIdxRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;

    handleAutoScroll(touch.clientY);
    setFloatingDrag(prev => (prev ? { ...prev, currentY: touch.clientY } : null));

    const insIdx = getInsertionIndexFromClientY(touch.clientY);
    if (insIdx !== insertionIdxRef.current) {
      insertionIdxRef.current = insIdx;
      setInsertionIndex(insIdx);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.(12); } catch {}
      }
    }
  };

  const handleTouchEnd = () => {
    const fromIdx = touchActiveIdxRef.current;
    const toInsIdx = insertionIdxRef.current;

    touchActiveIdxRef.current = null;
    insertionIdxRef.current = null;
    setTouchActiveIndex(null);
    setInsertionIndex(null);
    setFloatingDrag(null);

    if (fromIdx !== null && toInsIdx !== null) {
      onMove(fromIdx, toInsIdx);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate?.(35); } catch {}
      }
    }
  };

  const handleTouchCancel = () => {
    touchActiveIdxRef.current = null;
    insertionIdxRef.current = null;
    setTouchActiveIndex(null);
    setInsertionIndex(null);
    setFloatingDrag(null);
  };

  const resetDragState = () => {
    setDraggedIndex(null);
    setTouchActiveIndex(null);
    setInsertionIndex(null);
    setFloatingDrag(null);
    touchActiveIdxRef.current = null;
    insertionIdxRef.current = null;
  };

  return {
    draggedIndex,
    touchActiveIndex,
    insertionIndex,
    floatingDrag,
    listContainerRef,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleGripPointerDown,
    handleGripPointerMove,
    handleGripPointerUp,
    handleGripPointerCancel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    resetDragState
  };
}
