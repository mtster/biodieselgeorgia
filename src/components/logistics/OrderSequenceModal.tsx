import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Order, Vendor } from '../../types';
import { sortOrdersByRouteRank } from '../../utils/lexorank';
import { updateOrdersRouteRanks } from '../../services/orderService';
import { OrderSequenceModalProps, VendorDisplayInfo } from './types';
import { OrderSequenceHeader } from './OrderSequenceHeader';
import { OrderSequenceList } from './OrderSequenceList';
import { FloatingOrderDragPreview } from './FloatingOrderDragPreview';
import { useOrderSequenceDrag } from './useOrderSequenceDrag';
import { optimizeRouteStops } from './routeOptimization';

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
   * Reorder items array by placing item into target insertion gap
   */
  const handleMove = (fromIndex: number, targetInsertionIndex: number) => {
    if (fromIndex < 0 || fromIndex >= items.length) return;
    if (targetInsertionIndex < 0 || targetInsertionIndex > items.length) return;
    if (targetInsertionIndex === fromIndex || targetInsertionIndex === fromIndex + 1) return;

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
   * Auto-optimize route
   */
  const handleAutoOptimize = async () => {
    if (isOptimizing || items.length <= 1) return;
    setIsOptimizing(true);

    try {
      const orderedIds = await optimizeRouteStops({
        items,
        vehicleId,
        vehiclePlateText,
        driverId,
        dateStr,
        getVendorInfo
      });

      if (orderedIds && orderedIds.length > 0) {
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

      <OrderSequenceList
        items={items}
        draggedIndex={draggedIndex}
        touchActiveIndex={touchActiveIndex}
        insertionIndex={insertionIndex}
        listContainerRef={listContainerRef}
        getVendorInfo={getVendorInfo}
        handleSwap={handleSwap}
        handleDragStart={handleDragStart}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        handleDragEnd={handleDragEnd}
        handleGripPointerDown={handleGripPointerDown}
        handleGripPointerMove={handleGripPointerMove}
        handleGripPointerUp={handleGripPointerUp}
        handleGripPointerCancel={handleGripPointerCancel}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        handleTouchCancel={handleTouchCancel}
      />

      <FloatingOrderDragPreview floatingDrag={floatingDrag} />
    </motion.div>
  );
};
