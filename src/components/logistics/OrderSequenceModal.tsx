import React, { useState, useEffect } from 'react';
import { Order, Vendor } from '../../types';
import { 
  X, GripVertical, ChevronUp, ChevronDown, Check, 
  MapPin, AlertCircle, Sparkles, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { 
  rebalanceRanks, 
  getRankBetween, 
  sortOrdersByRouteRank 
} from '../../utils/lexorank';
import { resolveCityName, resolveDistrictName } from '../../services/lookupService';

export interface OrderSequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  suppliers: Vendor[];
  vehiclePlateText?: string;
  vehicleId?: string;
  driverId?: string;
  dateStr?: string;
  newOrderIds?: string[] | Set<string>;
  onOrdersReordered?: (reorderedOrders: Order[]) => void;
}

/**
 * Checks whether an order has before_leaving_base flag set to true in its notes column.
 */
function isBeforeLeavingBase(order: Order): boolean {
  if (!order || !order.notes) return false;
  try {
    if (typeof order.notes === 'string') {
      if (order.notes.includes('before_leaving_base')) {
        const parsed = JSON.parse(order.notes);
        if (parsed?.before_leaving_base === true || parsed?.before_leaving_base === 'true' || parsed?.before_leaving_base === 1) {
          return true;
        }
      }
      if (order.notes.toLowerCase().includes('"before_leaving_base": true') || order.notes.toLowerCase().includes('"before_leaving_base":true')) {
        return true;
      }
    } else if (typeof order.notes === 'object') {
      const obj = order.notes as any;
      if (obj.before_leaving_base === true || obj.before_leaving_base === 'true' || obj.before_leaving_base === 1) {
        return true;
      }
    }
  } catch {
    // If not valid JSON, check raw text
    if (typeof order.notes === 'string' && order.notes.includes('before_leaving_base')) {
      return true;
    }
  }
  return false;
}

export function OrderSequenceModal({
  isOpen,
  onClose,
  orders,
  suppliers,
  vehiclePlateText,
  newOrderIds,
  onOrdersReordered
}: OrderSequenceModalProps) {
  const [items, setItems] = useState<Order[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (orders && orders.length > 0) {
      setItems(sortOrdersByRouteRank(orders));
    } else {
      setItems([]);
    }
  }, [orders]);

  if (!isOpen) return null;

  const isOrderNew = (orderId: string): boolean => {
    if (!newOrderIds) return false;
    if (newOrderIds instanceof Set) {
      return newOrderIds.has(orderId);
    }
    return Array.isArray(newOrderIds) && newOrderIds.includes(orderId);
  };

  /**
   * Persists newly assigned LexoRank ranks to database
   */
  const saveRanks = async (updatedOrders: Order[]) => {
    setIsSaving(true);
    try {
      const updates = updatedOrders.map(order => 
        supabase
          .from('orders')
          .update({ route_rank: order.route_rank })
          .eq('id', order.id)
      );
      await Promise.allSettled(updates);
      if (onOrdersReordered) {
        onOrdersReordered(updatedOrders);
      }
    } catch (err) {
      console.error('Failed to save route ranks to database:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const moveOrder = async (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= items.length || fromIdx === toIdx) return;

    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    // Calculate new LexoRank for the moved item or rebalance if needed
    let finalRank: string;
    const prevRank = toIdx > 0 ? reordered[toIdx - 1]?.route_rank : null;
    const nextRank = toIdx < reordered.length - 1 ? reordered[toIdx + 1]?.route_rank : null;

    finalRank = getRankBetween(prevRank, nextRank);

    // If collisions or invalid rank, cleanly rebalance entire set
    let finalItems: Order[];
    if (!finalRank || finalRank === prevRank || finalRank === nextRank) {
      finalItems = rebalanceRanks(reordered);
    } else {
      reordered[toIdx] = { ...moved, route_rank: finalRank };
      finalItems = reordered;
    }

    setItems(finalItems);
    await saveRanks(finalItems);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      return;
    }
    await moveOrder(draggedIdx, targetIndex);
    setDraggedIdx(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-start bg-slate-900/60 backdrop-blur-xs font-sans">
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-md h-full bg-slate-50 flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 text-white p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] flex items-center justify-between shadow-md">
          <div className="space-y-0.5">
            <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>შეკვეთების თანმიმდევრობა</span>
              {isSaving && (
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium animate-pulse">
                  ინახება...
                </span>
              )}
            </h2>
            <p className="text-xs text-emerald-200/90 font-mono font-bold">
              {vehiclePlateText ? `ავტომობილი: ${vehiclePlateText}` : 'დღის მარშრუტი'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
            title="დახურვა"
          >
            <X size={18} />
          </button>
        </div>

        {/* Legend / Status Helper */}
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
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

        {/* List of Orders */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {items.length === 0 ? (
            <div className="text-center bg-white border border-dashed rounded-2xl py-12 p-5 text-gray-400 space-y-2 mt-4">
              <Building2 size={32} className="mx-auto text-gray-300" />
              <p className="text-xs font-medium">გადანომრვისთვის აქტიური შეკვეთები არ არის.</p>
            </div>
          ) : (
            items.map((order, index) => {
              const supplier = suppliers.find(s => s.id === order.vendor_id);
              const vendorName = supplier?.trade_name || supplier?.company_name || order.vendor_name || 'მომწოდებელი';
              const resolvedCity = resolveCityName(supplier?.city || order.city);
              const resolvedDistrict = resolveDistrictName(supplier?.district || order.district);
              const addressParts = [resolvedCity, resolvedDistrict, supplier?.address || order.address].filter(Boolean);
              const address = addressParts.length > 0 ? addressParts.join(', ') : 'მისამართი მითითებული არ არის';

              const beforeBase = isBeforeLeavingBase(order);
              const isNew = isOrderNew(order.id);

              // Distinct visual styling according to priority:
              // 1. before_leaving_base: slight red background
              // 2. isNew: slight green background
              // 3. standard: clean white card
              let cardBgClasses = 'bg-white border-slate-200/90 text-slate-800 shadow-xs hover:border-slate-300';
              if (beforeBase) {
                cardBgClasses = 'bg-red-50/90 border-red-200/90 text-red-950 shadow-xs';
              } else if (isNew) {
                cardBgClasses = 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs ring-1 ring-emerald-300/60';
              }

              return (
                <div
                  key={order.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`rounded-2xl p-3 border transition-all select-none flex items-center gap-3 relative ${cardBgClasses}`}
                >
                  {/* Sequence Badge */}
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                    beforeBase 
                      ? 'bg-red-200 text-red-900' 
                      : isNew 
                        ? 'bg-emerald-200 text-emerald-900' 
                        : 'bg-slate-100 text-slate-700'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Drag Handle */}
                  <div 
                    className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 flex-shrink-0"
                    title="გადაადგილება"
                  >
                    <GripVertical size={18} />
                  </div>

                  {/* Order Details */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-black text-slate-900 truncate">
                        {vendorName}
                      </span>
                      {beforeBase && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-red-100 text-red-700 border border-red-200 flex-shrink-0">
                          <AlertCircle size={10} />
                          ბაზიდან გასვლამდე
                        </span>
                      )}
                      {isNew && !beforeBase && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex-shrink-0 animate-pulse">
                          <Sparkles size={10} />
                          ახალი
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                      <MapPin size={11} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{address}</span>
                    </p>
                  </div>

                  {/* Up / Down Controls for one-tap mobile reordering */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveOrder(index, index - 1)}
                      className={`w-7 h-6 rounded-lg flex items-center justify-center transition border ${
                        index === 0 
                          ? 'opacity-25 cursor-not-allowed border-transparent text-slate-300' 
                          : 'bg-white hover:bg-slate-100 active:bg-slate-200 border-slate-200 text-slate-700'
                      }`}
                      title="ზემოთ აწევა"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === items.length - 1}
                      onClick={() => moveOrder(index, index + 1)}
                      className={`w-7 h-6 rounded-lg flex items-center justify-center transition border ${
                        index === items.length - 1 
                          ? 'opacity-25 cursor-not-allowed border-transparent text-slate-300' 
                          : 'bg-white hover:bg-slate-100 active:bg-slate-200 border-slate-200 text-slate-700'
                      }`}
                      title="ქვემოთ დაწევა"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <button
            onClick={onClose}
            className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            <Check size={18} />
            <span>თანმიმდევრობის დადასტურება</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
