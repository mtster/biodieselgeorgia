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
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchDraggedIdx = useRef<number | null>(null);

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
      
      // If none of the orders have route_rank yet, initialize initial ranks
      if (sorted.length > 0 && sorted.every(o => !o.route_rank)) {
        sorted = rebalanceRanks(sorted);
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
   * Reorder items array and calculate new Lexorank
   */
  const handleMove = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= items.length) return;

    const updated = [...items];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);

    // Compute new Lexorank for moved item
    const prevRank = toIndex > 0 ? updated[toIndex - 1].route_rank : null;
    const nextRank = toIndex < updated.length - 1 ? updated[toIndex + 1].route_rank : null;
    const newRank = getRankBetween(prevRank, nextRank);

    updated[toIndex] = {
      ...updated[toIndex],
      route_rank: newRank
    };

    // Redundancy and safe upper-limit check
    // If ranks grow too long (>= 16 chars) due to frequent drag-and-drops in the same spot,
    // rebalance ranks back to clean base strings preserving current sequence
    let finalItems = updated;
    if (shouldRebalance(updated.map(i => i.route_rank))) {
      finalItems = rebalanceRanks(updated);
    }

    setItems(finalItems);
    setIsDirty(true);
    // User manual rearrangement re-enables the auto-optimization button
    setIsOptimized(false);
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

        // Assign fresh initial Lexoranks to the optimal route
        const freshRanks = generateInitialRanks(reordered.length);
        const rankedOrders = reordered.map((o, idx) => ({
          ...o,
          route_rank: freshRanks[idx]
        }));

        setItems(rankedOrders);
        setIsDirty(true);
        setIsOptimized(true);
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
        // 1. Instantly update parent component state so driver sees new order without reload
        onOrdersReordered(items);

        // 2. Persist Lexoranks to database in background
        const updates = items.map(o => ({
          id: o.id,
          route_rank: o.route_rank || ''
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

  // HTML5 Drag Handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent or native ghost
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      handleMove(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
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
      <div className="flex-1 overflow-y-auto p-4 max-w-md mx-auto w-full space-y-2.5">
        {items.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 text-slate-500 text-xs font-medium mt-4">
            დღევანდელი დღისთვის ამ მანქანაზე აქტიური შეკვეთები არ მოიძებნა.
          </div>
        ) : (
          items.map((order, idx) => {
            const info = getVendorInfo(order);
            const isDragging = draggedIndex === idx;
            const isDragOver = dragOverIndex === idx;

            return (
              <div
                key={order.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-white rounded-2xl border transition-all duration-150 p-3 flex items-center justify-between gap-3 shadow-xs select-none ${
                  isDragging ? 'opacity-40 border-dashed border-emerald-400 scale-[0.98]' : 'border-gray-200/90'
                } ${isDragOver ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-400/30' : 'hover:border-slate-300'}`}
              >
                {/* Left: Sequence Number & Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center flex-shrink-0 border border-slate-200/60">
                    {idx + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 text-xs truncate">
                      {info.tradeName}
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
                      onClick={() => handleMove(idx, idx - 1)}
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
                      onClick={() => handleMove(idx, idx + 1)}
                      className={`p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ${
                        idx === items.length - 1 ? 'opacity-20 cursor-not-allowed' : ''
                      }`}
                      title="ქვემოთ ჩამოწევა"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Drag Grip Handle */}
                  <div 
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 active:text-emerald-700 hover:bg-slate-100 active:bg-emerald-50 transition cursor-grab active:cursor-grabbing flex items-center justify-center touch-none"
                    title="გადაადგილება"
                  >
                    <GripVertical size={19} className="stroke-[2.2]" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
