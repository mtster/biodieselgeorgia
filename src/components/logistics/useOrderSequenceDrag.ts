import { useState, useRef, useEffect, useCallback } from 'react';
import { Order } from '../../types';
import { FloatingDragState, VendorDisplayInfo } from './types';

interface UseOrderSequenceDragProps {
  items: Order[];
  getVendorInfo: (order: Order) => VendorDisplayInfo;
  onMove: (fromIndex: number, toIndex: number) => void;
}

export function useOrderSequenceDrag({
  items,
  getVendorInfo,
  onMove
}: UseOrderSequenceDragProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchActiveIndex, setTouchActiveIndex] = useState<number | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [floatingDrag, setFloatingDrag] = useState<FloatingDragState | null>(null);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef(items);
  const activeDragIdxRef = useRef<number | null>(null);
  const insertionIdxRef = useRef<number | null>(null);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const getInsertionIndexFromClientY = useCallback((clientY: number): number => {
    if (!listContainerRef.current) return 0;
    const rowElements = Array.from(
      listContainerRef.current.querySelectorAll<HTMLElement>('[data-order-index]')
    );
    if (rowElements.length === 0) return 0;

    for (let i = 0; i < rowElements.length; i++) {
      const rect = rowElements[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) {
        return i;
      }
    }
    return rowElements.length;
  }, []);

  const handleAutoScroll = useCallback((clientY: number) => {
    if (!listContainerRef.current) return;
    const containerRect = listContainerRef.current.getBoundingClientRect();
    const threshold = 50;
    if (clientY < containerRect.top + threshold) {
      const delta = Math.max(3, Math.min(15, (containerRect.top + threshold - clientY) / 2));
      listContainerRef.current.scrollTop -= delta;
    } else if (clientY > containerRect.bottom - threshold) {
      const delta = Math.max(3, Math.min(15, (clientY - (containerRect.bottom - threshold)) / 2));
      listContainerRef.current.scrollTop += delta;
    }
  }, []);

  // Rock-solid pointer drag system for mobile devices and desktops
  const handleGripPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    e.stopPropagation();

    const targetEl = e.currentTarget as HTMLElement;
    const rowEl = (targetEl.closest('[data-order-index]') as HTMLElement) || targetEl;
    const rect = rowEl.getBoundingClientRect();
    const grabOffsetY = e.clientY - rect.top;

    const currentItems = itemsRef.current;
    const order = currentItems[idx];
    if (!order) return;

    const info = getVendorInfo(order);

    activeDragIdxRef.current = idx;
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

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (activeDragIdxRef.current === null) return;
      moveEvent.preventDefault();
      handleAutoScroll(moveEvent.clientY);

      setFloatingDrag(prev => prev ? { ...prev, currentY: moveEvent.clientY } : null);

      const insIdx = getInsertionIndexFromClientY(moveEvent.clientY);
      if (insIdx !== insertionIdxRef.current) {
        insertionIdxRef.current = insIdx;
        setInsertionIndex(insIdx);
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const fromIdx = activeDragIdxRef.current;
      const toInsIdx = insertionIdxRef.current;

      activeDragIdxRef.current = null;
      insertionIdxRef.current = null;
      setTouchActiveIndex(null);
      setInsertionIndex(null);
      setFloatingDrag(null);

      if (fromIdx !== null && toInsIdx !== null && fromIdx !== toInsIdx && fromIdx + 1 !== toInsIdx) {
        onMoveRef.current(fromIdx, toInsIdx);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate?.(30); } catch {}
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [getVendorInfo, getInsertionIndexFromClientY, handleAutoScroll]);

  // Desktop HTML5 drag/drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (activeDragIdxRef.current !== null) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const insIdx = getInsertionIndexFromClientY(e.clientY);
    if (insIdx !== insertionIdxRef.current) {
      insertionIdxRef.current = insIdx;
      setInsertionIndex(insIdx);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const fromIdx = draggedIndex;
    const toInsIdx = insertionIdxRef.current;
    if (fromIdx !== null && toInsIdx !== null && fromIdx !== toInsIdx && fromIdx + 1 !== toInsIdx) {
      onMoveRef.current(fromIdx, toInsIdx);
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
    handleGripPointerDown
  };
}
