import React, { useState, useEffect, useRef } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { rebalanceRanks, sortOrdersByRouteRank } from '../../utils/lexorank';
import { resolveCityName, resolveDistrictName } from '../../services/lookupService';
import { Order, Vendor } from '../../types';
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
  newOrderIds,
  onOrdersReordered
}) => {
  const [items, setItems] = useState<Order[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isOptimized, setIsOptimized] = useState<boolean>(false);

  // Initialize items ONLY when modal opens to prevent resetting state on outside re-renders
  useEffect(() => {
    if (isOpen) {
      setItems(sortOrdersByRouteRank(orders || []));
      setIsDirty(false);
      setIsOptimized(false);
    }
  }, [isOpen]);

  // Vendor display info resolution helper
  const getVendorInfo = (order: Order): VendorDisplayInfo => {
    const s = suppliers.find(sup => sup.id === order.vendor_id);
    const tradeName = s?.trade_name || s?.company_name || order.vendor_name || 'მომწოდებელი';
    const city = resolveCityName(s?.city || order.city);
    const district = resolveDistrictName(s?.district || order.district);
    const addressParts = [city, district, s?.address || order.address].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(', ') : 'მისამართი მითითებული არ არის';
    const lat = s?.latitude ?? order.latitude ?? null;
    const lon = s?.longitude ?? order.longitude ?? null;

    return { tradeName, address, lat, lon };
  };

  /**
   * Local swap of adjacent items - triggers immediately in state
   */
  const handleSwap = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return;
    setItems(prevItems => {
      const updated = [...prevItems];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setIsDirty(true);
  };

  /**
   * Local move from drag & drop - triggers immediately in state
   */
  const handleMove = (fromIndex: number, toInsertionIndex: number) => {
    if (fromIndex === toInsertionIndex || fromIndex + 1 === toInsertionIndex) return;
    setItems(prevItems => {
      const updated = [...prevItems];
      const [moved] = updated.splice(fromIndex, 1);
      const targetIdx = fromIndex < toInsertionIndex ? toInsertionIndex - 1 : toInsertionIndex;
      updated.splice(targetIdx, 0, moved);
      return updated;
    });
    setIsDirty(true);
  };

  // Modern touch & pointer drag system for mobile devices
  const dragHook = useOrderSequenceDrag({
    items,
    getVendorInfo,
    onMove: handleMove
  });

  /**
   * Auto-optimize route via Geoapify through optimize-route edge function
   */
  const handleAutoOptimize = async () => {
    if (items.length <= 1 || isOptimizing) return;
    setIsOptimizing(true);
    try {
      const optimizedIds = await optimizeRouteStops({
        items,
        vehicleId,
        vehiclePlateText,
        driverId,
        dateStr,
        getVendorInfo
      });

      if (optimizedIds && optimizedIds.length > 0) {
        const idMap = new Map(items.map(i => [i.id, i]));
        const reordered = optimizedIds
          .map(id => idMap.get(id))
          .filter(Boolean) as Order[];

        // Include any order that wasn't in the returned list
        const missing = items.filter(i => !optimizedIds.includes(i.id));
        const finalOrdered = [...reordered, ...missing];

        setItems(finalOrdered);
        setIsDirty(true);
        setIsOptimized(true);
      }
    } catch (e: any) {
      console.warn('Auto optimization notice:', e?.message || e);
    } finally {
      setIsOptimizing(false);
    }
  };

  /**
   * ONLY when user clicks the bottom submission button do we persist LexoRanks to the database
   */
  const handleSaveAndConfirm = async () => {
    if (items.length === 0) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      // Rebalance and compute fresh LexoRanks for all items in the list
      const rebalanced = rebalanceRanks(items);

      // Perform updates to Supabase orders table
      const updates = rebalanced.map(order =>
        supabase
          .from('orders')
          .update({ route_rank: order.route_rank })
          .eq('id', order.id)
      );

      await Promise.allSettled(updates);

      if (onOrdersReordered) {
        onOrdersReordered(rebalanced);
      }
      setIsDirty(false);
      onClose();
    } catch (err) {
      console.error('Failed to save route ranks to database:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-start bg-slate-900/60 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-md h-full bg-slate-50 flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header with Geoapify Auto-Optimization Button */}
        <OrderSequenceHeader
          vehiclePlateText={vehiclePlateText}
          orderCount={items.length}
          isSaving={isSaving}
          isDirty={isDirty}
          isOptimizing={isOptimizing}
          isOptimized={isOptimized}
          onGoBack={onClose}
          onAutoOptimize={handleAutoOptimize}
        />

        {/* Legend / Status Helper */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-red-100 border border-red-300 inline-block" />
              <span>ბაზიდან გასვლამდე</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-100 border border-emerald-400 inline-block" />
              <span>ახალი დამატებული</span>
            </div>
          </div>
          <span className="font-semibold text-slate-600">{items.length} ობიექტი</span>
        </div>

        {/* Touch & Mouse Drag Reorder List */}
        <OrderSequenceList
          items={items}
          draggedIndex={dragHook.draggedIndex}
          touchActiveIndex={dragHook.touchActiveIndex}
          insertionIndex={dragHook.insertionIndex}
          newOrderIds={newOrderIds}
          listContainerRef={dragHook.listContainerRef}
          getVendorInfo={getVendorInfo}
          handleSwap={handleSwap}
          handleDragStart={dragHook.handleDragStart}
          handleDragOver={dragHook.handleDragOver}
          handleDrop={dragHook.handleDrop}
          handleDragEnd={dragHook.handleDragEnd}
          handleGripPointerDown={dragHook.handleGripPointerDown}
        />

        {/* Floating preview for mobile touch drag */}
        <FloatingOrderDragPreview floatingDrag={dragHook.floatingDrag} />

        {/* Bottom Submission Action Bar */}
        <div className="p-4 bg-white border-t border-slate-200 pb-[max(1rem,env(safe-area-inset-bottom,0px))] flex-shrink-0">
          <button
            type="button"
            id="btn-confirm-sequence-submission"
            disabled={isSaving}
            onClick={handleSaveAndConfirm}
            className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer select-none ${
              isDirty 
                ? 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white ring-2 ring-emerald-500/40' 
                : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>ინახება...</span>
              </>
            ) : (
              <>
                <Check size={18} />
                <span>თანმიმდევრობის დადასტურება</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
