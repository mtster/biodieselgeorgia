import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, GripVertical, Loader2, MapPin, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { Order, Vendor } from '../../types';
import { 
  getRankBetween, 
  generateInitialRanks, 
  rebalanceRanks, 
  shouldRebalance, 
  sortOrdersByRouteRank 
} from '../../utils/lexorank';
import { updateOrdersRouteRanks } from '../../services/orderService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface OrderSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  suppliers: Vendor[];
  vehiclePlateText?: string;
  vehicleId?: string;
  driverId?: string;
  dateStr?: string;
  onOrdersReordered: (newOrders: Order[]) => void;
}

const DropIndicatorLine: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return (
    <div className="py-1 -my-1 relative flex items-center justify-center z-20 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95">
      <div className="w-full flex items-center px-1">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-sm shadow-emerald-400/50 flex-shrink-0 ring-2 ring-emerald-200" />
        <div className="h-[3px] flex-1 bg-emerald-600 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-sm shadow-emerald-400/50 flex-shrink-0 ring-2 ring-emerald-200" />
      </div>
    </div>
  );
};

export const OrderSequenceModal: React.FC<OrderSequenceModalProps> = ({
  isOpen,
  onClose,
  orders,
  suppliers,
  vehiclePlateText,
  vehicleId,
  driverId,
  dateStr,
  onOrdersReordered
}) => {
  const [items, setItems] = useState<Order[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isOptimized, setIsOptimized] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Drag-and-drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchActiveIndex, setTouchActiveIndex] = useState<number | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null);
  const [floatingDrag, setFloatingDrag] = useState<{
    index: number;
    tradeName: string;
    address: string;
    width: number;
    height: number;
    left: number;
    top: number;
    grabOffsetY: number;
    currentY: number;
  } | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const touchActiveIdxRef = useRef<number | null>(null);
  const insertionIdxRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const capturedElRef = useRef<HTMLElement | null>(null);

  // Map vendors by id for fast coordinate & trade_name lookups
  const supplierMap = useRef<Map<string, Vendor>>(new Map());
  useEffect(() => {
    const map = new Map<string, Vendor>();
    suppliers.forEach(s => map.set(s.id, s));
    supplierMap.current = map;
  }, [suppliers]);

  // Track open state transition so parent updates don't reset state while open
  const wasOpenRef = useRef(false);

  // Initialize sorted items when opened
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const activeList = orders.filter(o => !o.is_deleted);
      let sorted = sortOrdersByRouteRank(activeList);
      
      // Ensure every order has a clean, reliable sequential route_rank
      const needsInit = sorted.some(o => !o.route_rank || !o.route_rank.startsWith('r_'));
      if (needsInit) {
        sorted = sorted.map((o, idx) => ({
          ...o,
          route_rank: `r_${String(idx + 1).padStart(4, '0')}`
        }));
        // Persist initial sequential ranks to DB and parent so ordering is immediately fixed
        const updates = sorted.map(o => ({ id: o.id, route_rank: o.route_rank! }));
        updateOrdersRouteRanks(updates).catch(console.error);
        onOrdersReordered(sorted);
      }

      setItems(sorted);
      setIsDirty(false);
      setIsOptimizing(false);
      setIsOptimized(false);
      setIsSaving(false);
      setInsertionIndex(null);
      insertionIdxRef.current = null;
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Resolve vendor info for an order (showing only trade name & address)
  const getVendorInfo = (order: Order) => {
    let supplier = order.vendor_id ? supplierMap.current.get(order.vendor_id) : null;
    if (!supplier && order.vendor_id) {
      supplier = suppliers.find(s => s.id === order.vendor_id || String(s.id).toLowerCase() === String(order.vendor_id).toLowerCase()) || null;
    }
    if (!supplier && (order as any).vendor) {
      supplier = (order as any).vendor;
    }
    const tradeName = supplier?.trade_name || supplier?.company_name || order.vendor_name || 'მომწოდებელი';
    const address = supplier?.address || order.address || [supplier?.city, supplier?.district].filter(Boolean).join(', ') || 'მისამართი მითითებული არ არის';
    
    const parseCoord = (val: any): number | null => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num;
    };

    const lat = parseCoord(supplier?.latitude ?? (order as any).latitude);
    const lon = parseCoord(supplier?.longitude ?? (order as any).longitude);
    return { tradeName, address, lat, lon };
  };

  /**
   * Reorder items array by placing item into target insertion gap,
   * then assigning fresh, strictly monotonic ranks to every order.
   * Instantly synchronizes with parent view and persists to database.
   */
  const handleMove = (fromIndex: number, targetInsertionIndex: number) => {
    if (fromIndex < 0 || fromIndex >= items.length) return;
    if (targetInsertionIndex < 0 || targetInsertionIndex > items.length) return;

    // Dropping in place next to self requires no change
    if (targetInsertionIndex === fromIndex || targetInsertionIndex === fromIndex + 1) {
      return;
    }

    const updated = [...items];
    const [movedItem] = updated.splice(fromIndex, 1);
    const destinationIndex = targetInsertionIndex > fromIndex ? targetInsertionIndex - 1 : targetInsertionIndex;
    updated.splice(destinationIndex, 0, movedItem);

    // Assign fresh, strictly monotonic ranks to all orders in the route
    const rankedOrders = updated.map((item, idx) => ({
      ...item,
      route_rank: `r_${String(idx + 1).padStart(4, '0')}`
    }));

    setItems(rankedOrders);
    setIsDirty(true);
    setIsOptimized(false);
    onOrdersReordered(rankedOrders);

    // Immediate background persistence to database
    const updates = rankedOrders.map(o => ({ id: o.id, route_rank: o.route_rank! }));
    updateOrdersRouteRanks(updates).catch(console.error);
  };

  /**
   * Quick swap helper for up/down arrow buttons
   */
  const handleSwap = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= items.length) return;
    if (toIndex < 0 || toIndex >= items.length) return;

    const updated = [...items];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    const rankedOrders = updated.map((item, idx) => ({
      ...item,
      route_rank: `r_${String(idx + 1).padStart(4, '0')}`
    }));

    setItems(rankedOrders);
    setIsDirty(true);
    setIsOptimized(false);
    onOrdersReordered(rankedOrders);

    const updates = rankedOrders.map(o => ({ id: o.id, route_rank: o.route_rank! }));
    updateOrdersRouteRanks(updates).catch(console.error);
  };

  /**
   * Auto-optimize route via Geoapify Route Planner (with local TSP fallback)
   */
  const handleAutoOptimize = async () => {
    if (isOptimizing || items.length <= 1) return;
    setIsOptimizing(true);

    try {
      // Default starting point: Liberty Square, Tbilisi [lon, lat] = [44.8015, 41.6934]
      let startLocation: [number, number] = [44.8015, 41.6934];
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              timeout: 2500, 
              maximumAge: 60000, 
              enableHighAccuracy: false 
            });
          });
          if (pos?.coords?.latitude && pos?.coords?.longitude) {
            startLocation = [pos.coords.longitude, pos.coords.latitude];
          }
        } catch {
          // Geolocation unavailable or permission denied; default to Liberty Square
        }
      }

      // Prepare stops with coordinates
      const stops = items.map(o => {
        const info = getVendorInfo(o);
        return {
          id: o.id,
          vendor_id: o.vendor_id,
          lat: info.lat,
          lon: info.lon,
          name: info.tradeName,
          address: info.address,
          status: o.status,
          order_date: o.order_date,
          vehicle_id: o.vehicle_id || vehicleId,
          truck_plate: o.truck_plate || vehiclePlateText,
          driver_id: o.driver_id || driverId
        };
      });

      const requestPayload = {
        orders: stops,
        vehicle_id: vehicleId,
        truck_plate: vehiclePlateText,
        driver_id: driverId,
        date: dateStr,
        start_location: startLocation
      };

      let orderedIds: string[] = [];

      // 1. Invoke Supabase Edge Function 'optimize-route'
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('optimize-route', {
            body: requestPayload
          });
          if (!fnErr && fnData?.optimized_order_ids && fnData.optimized_order_ids.length > 0) {
            orderedIds = fnData.optimized_order_ids;
          } else if (fnErr) {
            console.warn('Supabase Edge Function optimize-route error:', fnErr);
          }
        } catch (e: any) {
          console.warn('Edge function optimize-route invocation failed, trying server API:', e?.message);
        }
      }

      // 2. Fallback to Express server endpoint
      if (orderedIds.length === 0) {
        const res = await fetch('/api/optimize-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload)
        });

        if (!res.ok) {
          throw new Error('მარშრუტის ოპტიმიზაციის მოთხოვნა ვერ შესრულდა');
        }

        const data = await res.json();
        orderedIds = data.optimized_order_ids || [];
      }

      if (orderedIds.length > 0) {
        // Reorder items according to optimized order
        const itemMap = new Map(items.map(i => [i.id, i]));
        const reordered: Order[] = [];

        orderedIds.forEach(id => {
          const item = itemMap.get(id);
          if (item) {
            reordered.push(item);
            itemMap.delete(id);
          }
        });

        // Append any remaining items
        itemMap.forEach(item => reordered.push(item));

        // Assign fresh sequential route ranks to the optimal route
        const rankedOrders = reordered.map((o, idx) => ({
          ...o,
          route_rank: `r_${String(idx + 1).padStart(4, '0')}`
        }));

        setItems(rankedOrders);
        setIsDirty(true);
        setIsOptimized(true);
        onOrdersReordered(rankedOrders);

        const updates = rankedOrders.map(o => ({ id: o.id, route_rank: o.route_rank! }));
        updateOrdersRouteRanks(updates).catch(console.error);
      }
    } catch (err) {
      console.error('Auto optimize error:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  /**
   * Go back: writes to DB only if changes were made,
   * updates local state instantly for seamless UX.
   */
  const handleGoBack = async () => {
    if (isDirty) {
      setIsSaving(true);
      try {
        // Ensure every item has an explicit, sequential route rank
        const finalRanked = items.map((o, idx) => ({
          ...o,
          route_rank: o.route_rank || `r_${String(idx + 1).padStart(4, '0')}`
        }));

        // 1. Instantly update parent component state so driver sees new order without reload
        onOrdersReordered(finalRanked);

        // 2. Persist ranks to database in background
        const updates = finalRanked.map(o => ({
          id: o.id,
          route_rank: o.route_rank
        }));
        await updateOrdersRouteRanks(updates);
      } catch (err) {
        console.error('Failed saving route ranks to DB:', err);
      } finally {
        setIsSaving(false);
        onClose();
      }
    } else {
      // Nothing changed: 0 requests to database!
      onClose();
    }
  };

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
      handleMove(fromIdx, toInsIdx);
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

  // Pointer Drag Handlers (Standard across all modern mobile browsers & touch devices)
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

    // Update floating drag position so it follows the user's finger in real time
    setFloatingDrag(prev => prev ? { ...prev, currentY: e.clientY } : null);

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
      handleMove(fromIdx, toInsIdx);
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

  // Mobile Touch Fallbacks (for legacy environments without pointer capture)
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
    setFloatingDrag(prev => prev ? { ...prev, currentY: touch.clientY } : null);

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
      handleMove(fromIdx, toInsIdx);
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

  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 26, stiffness: 220 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col font-sans overflow-hidden"
    >
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-xs flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            id="btn-sequence-go-back"
            onClick={handleGoBack}
            disabled={isSaving}
            className="p-2 -ml-1 text-slate-700 hover:text-emerald-900 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-xs"
            title="უკან დაბრუნება"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin text-emerald-800" />
            ) : (
              <ArrowLeft size={20} className="stroke-[2.4]" />
            )}
          </button>
          <div>
            <h1 className="text-base font-extrabold text-slate-800 leading-tight">
              შეკვეთების თანმიმდევრობა
            </h1>
            <p className="text-[11px] font-medium text-slate-500">
              {vehiclePlateText ? `${vehiclePlateText} • ` : ''}დღის შეკვეთები ({items.length})
            </p>
          </div>
        </div>

        {/* Action badge or saving indicator */}
        {isSaving ? (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-100">
            <Loader2 size={12} className="animate-spin" />
            ინახება...
          </span>
        ) : isDirty ? (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/80">
            შეცვლილია
          </span>
        ) : null}
      </header>

      {/* Auto-Rearrange Action Bar */}
      <div className="bg-white/80 backdrop-blur-xs border-b border-gray-200/70 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="text-[11px] text-slate-600 font-medium">
          შეცვალეთ თანმიმდევრობა ან გამოიყენეთ ავტომატური მარშრუტის ოპტიმიზაცია
        </div>
        <button
          id="btn-auto-optimize-route"
          onClick={handleAutoOptimize}
          disabled={isOptimizing || isOptimized || isSaving || items.length <= 1}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition select-none cursor-pointer shadow-xs ${
            isOptimized
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white'
          } ${isOptimizing ? 'opacity-80 cursor-wait' : ''}`}
          title={isOptimized ? 'მარშრუტი უკვე ოპტიმიზებულია სისტემის მიერ' : 'Geoapify ოპტიმალური მარშრუტის დალაგება'}
        >
          {isOptimizing ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>ლაგდება...</span>
            </>
          ) : isOptimized ? (
            <>
              <Check size={13} className="stroke-[2.5]" />
              <span>დალაგებულია</span>
            </>
          ) : (
            <span>მარშრუტის ოპტიმიზაცია</span>
          )}
        </button>
      </div>

      {/* Reorderable List Body */}
      <div 
        ref={listContainerRef}
        className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-2.5"
      >
        {items.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 text-slate-500 text-xs font-medium mt-4">
            დღევანდელი დღისთვის ამ მანქანაზე აქტიური შეკვეთები არ მოიძებნა.
          </div>
        ) : (
          (() => {
            const activeDragIdx = touchActiveIndex !== null ? touchActiveIndex : draggedIndex;

            return (
              <>
                {/* Top insertion line indicator (gap 0, before first order) */}
                <DropIndicatorLine active={activeDragIdx !== null && insertionIndex === 0} />

                {items.map((order, idx) => {
                  const info = getVendorInfo(order);
                  const isDragging = draggedIndex === idx;
                  const isTouchActive = touchActiveIndex === idx;

                  return (
                    <React.Fragment key={order.id}>
                      <div
                        data-order-index={idx}
                        draggable={touchActiveIndex === null}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        className={`bg-white rounded-2xl border transition-all duration-150 p-3 flex items-center justify-between gap-3 shadow-xs select-none ${
                          isDragging || isTouchActive 
                            ? 'opacity-35 border-dashed border-2 border-slate-300 bg-slate-50/70 scale-[0.98]' 
                            : 'border-gray-200/90 hover:border-slate-300'
                        }`}
                      >
                        {/* Left: Sequence Number & Info */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center flex-shrink-0 border transition-colors ${
                            isTouchActive || isDragging
                              ? 'bg-slate-200 text-slate-500 border-slate-300' 
                              : 'bg-slate-100 text-slate-700 border-slate-200/60'
                          }`}>
                            {idx + 1}
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
                              disabled={idx === 0}
                              onClick={() => handleSwap(idx, idx - 1)}
                              className={`p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ${
                                idx === 0 ? 'opacity-20 cursor-not-allowed' : ''
                              }`}
                              title="ზემოთ აწევა"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === items.length - 1}
                              onClick={() => handleSwap(idx, idx + 1)}
                              className={`p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ${
                                idx === items.length - 1 ? 'opacity-20 cursor-not-allowed' : ''
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
                            onPointerDown={(e) => handleGripPointerDown(e, idx)}
                            onPointerMove={handleGripPointerMove}
                            onPointerUp={handleGripPointerUp}
                            onPointerCancel={handleGripPointerCancel}
                            onTouchStart={(e) => handleTouchStart(e, idx)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onTouchCancel={handleTouchCancel}
                          >
                            <GripVertical size={20} className="stroke-[2.4]" />
                          </div>
                        </div>
                      </div>

                      {/* Insertion line indicator below this order (gap idx + 1) */}
                      <DropIndicatorLine active={activeDragIdx !== null && insertionIndex === idx + 1} />
                    </React.Fragment>
                  );
                })}
              </>
            );
          })()
        )}
      </div>

      {/* Floating Drag Cue - Follows the user's finger in real-time on mobile */}
      {floatingDrag && (
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
      )}
    </motion.div>
  );
};
