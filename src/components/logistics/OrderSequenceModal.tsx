import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Order, Vendor } from '../../types';
import { sortOrdersByRouteRank } from '../../utils/lexorank';
import { updateOrdersRouteRanks } from '../../services/orderService';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { OrderSequenceModalProps, VendorDisplayInfo } from './types';
import { OrderSequenceHeader } from './OrderSequenceHeader';
import { OrderSequenceItem } from './OrderSequenceItem';
import { DropIndicatorLine } from './DropIndicatorLine';
import { FloatingOrderDragPreview } from './FloatingOrderDragPreview';
import { useOrderSequenceDrag } from './useOrderSequenceDrag';

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
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  // Resolve vendor info for an order (showing only trade name & address)
  const getVendorInfo = (order: Order): VendorDisplayInfo => {
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
   */
  const handleMove = (fromIndex: number, targetInsertionIndex: number) => {
    if (fromIndex < 0 || fromIndex >= items.length) return;
    if (targetInsertionIndex < 0 || targetInsertionIndex > items.length) return;

    if (targetInsertionIndex === fromIndex || targetInsertionIndex === fromIndex + 1) {
      return;
    }

    const updated = [...items];
    const [movedItem] = updated.splice(fromIndex, 1);
    const destinationIndex = targetInsertionIndex > fromIndex ? targetInsertionIndex - 1 : targetInsertionIndex;
    updated.splice(destinationIndex, 0, movedItem);

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

  // Drag and drop hook
  const {
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
    handleTouchCancel
  } = useOrderSequenceDrag({
    items,
    getVendorInfo,
    onMove: handleMove
  });

  /**
   * Auto-optimize route via Geoapify Route Planner (with local TSP fallback)
   */
  const handleAutoOptimize = async () => {
    if (isOptimizing || items.length <= 1) return;
    setIsOptimizing(true);

    try {
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
        } catch {}
      }

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

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: fnData, error: fnErr } = await supabase.functions.invoke('optimize-route', {
            body: requestPayload
          });
          if (!fnErr && fnData?.optimized_order_ids && fnData.optimized_order_ids.length > 0) {
            orderedIds = fnData.optimized_order_ids;
          }
        } catch (e: any) {
          console.warn('Edge function optimize-route failed, trying express API:', e?.message);
        }
      }

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
        const itemMap = new Map(items.map(i => [i.id, i]));
        const reordered: Order[] = [];

        orderedIds.forEach(id => {
          const item = itemMap.get(id);
          if (item) {
            reordered.push(item);
            itemMap.delete(id);
          }
        });

        itemMap.forEach(item => reordered.push(item));

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
        const finalRanked = items.map((o, idx) => ({
          ...o,
          route_rank: o.route_rank || `r_${String(idx + 1).padStart(4, '0')}`
        }));

        onOrdersReordered(finalRanked);

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
      onClose();
    }
  };

  if (!isOpen) return null;

  const activeDragIdx = touchActiveIndex !== null ? touchActiveIndex : draggedIndex;

  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 26, stiffness: 220 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col font-sans overflow-hidden"
    >
      <OrderSequenceHeader
        vehiclePlateText={vehiclePlateText}
        orderCount={items.length}
        isSaving={isSaving}
        isDirty={isDirty}
        isOptimizing={isOptimizing}
        isOptimized={isOptimized}
        onGoBack={handleGoBack}
        onAutoOptimize={handleAutoOptimize}
      />

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
          <>
            {/* Top insertion line indicator (gap 0, before first order) */}
            <DropIndicatorLine active={activeDragIdx !== null && insertionIndex === 0} />

            {items.map((order, idx) => {
              const info = getVendorInfo(order);
              const isDragging = draggedIndex === idx;
              const isTouchActive = touchActiveIndex === idx;

              return (
                <React.Fragment key={order.id}>
                  <OrderSequenceItem
                    order={order}
                    index={idx}
                    isFirst={idx === 0}
                    isLast={idx === items.length - 1}
                    isDragging={isDragging}
                    isTouchActive={isTouchActive}
                    info={info}
                    onSwap={handleSwap}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    onPointerDown={handleGripPointerDown}
                    onPointerMove={handleGripPointerMove}
                    onPointerUp={handleGripPointerUp}
                    onPointerCancel={handleGripPointerCancel}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                  />

                  {/* Insertion line indicator below this order (gap idx + 1) */}
                  <DropIndicatorLine active={activeDragIdx !== null && insertionIndex === idx + 1} />
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* Floating Drag Cue - Follows user's finger in real-time on mobile */}
      <FloatingOrderDragPreview floatingDrag={floatingDrag} />
    </motion.div>
  );
};
