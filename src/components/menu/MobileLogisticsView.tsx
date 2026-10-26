import React, { useState, useEffect, useRef } from 'react';
import { User, Order, Vendor, Warehouse, Truck } from '../../types';
import { ClipboardList, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MobileLogisticsHeader } from '../mobile-logistics/MobileLogisticsHeader';
import { ActiveOrderCard } from '../mobile-logistics/ActiveOrderCard';
import { CompletedOrderCard } from '../mobile-logistics/CompletedOrderCard';
import { OrderCompletionModal } from '../mobile-logistics/OrderCompletionModal';
import { OrderSequenceModal } from '../logistics/OrderSequenceModal';
import { sortOrdersByRouteRank } from '../../utils/lexorank';
import { 
  cleanStr, normalizeText, findUserAssignedTruck, isVehicleMatchingUser, 
  checkOrderPickupDateIsToday, isOrderAssignedToVehicle, getDriverOrdersAndVendors 
} from '../../services/roleDataService';
import { resolveCityName, resolveDistrictName } from '../../services/lookupService';
import { onRealtimeDbChange } from '../../lib/realtime';

interface Props {
  currentUser: User;
  orders: Order[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  onSaveOrder: (order: Order) => void;
  onLogOut: () => void;
}

export default function MobileLogisticsView({
  currentUser, orders, suppliers, warehouses, employees, trucks, onSaveOrder, onLogOut
}: Props) {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showSequenceModal, setShowSequenceModal] = useState<boolean>(false);
  const [localOrders, setLocalOrders] = useState<Order[]>(orders);
  const [localSuppliers, setLocalSuppliers] = useState<Vendor[]>(suppliers);

  // Tracking unacknowledged incoming orders for this vehicle
  const [unacknowledgedOrders, setUnacknowledgedOrders] = useState<Order[]>([]);
  const [activeBanner, setActiveBanner] = useState<{
    count: number;
    vendorName: string;
    address: string;
  } | null>(null);

  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  useEffect(() => {
    setLocalSuppliers(suppliers);
  }, [suppliers]);

  // Comprehensive realtime sync plugged directly into MobileLogisticsView
  useEffect(() => {
    const unsub = onRealtimeDbChange(async (table) => {
      const t = (table || '').toLowerCase();
      if (t === 'orders' || t === 'vehicles' || t === 'trucks' || t === 'vendors' || t === 'vendor_contacts' || t === 'profiles' || t === 'users') {
        try {
          const { orders: freshOrders, suppliers: freshSuppliers } = await getDriverOrdersAndVendors(
            currentUser,
            trucks,
            employees,
            localSuppliers.length > 0 ? localSuppliers : suppliers
          );
          setLocalOrders(freshOrders);
          if (freshSuppliers && freshSuppliers.length > 0) {
            setLocalSuppliers(freshSuppliers);
          }
        } catch (err) {
          console.warn('Realtime refresh failed in MobileLogisticsView:', err);
        }
      }
    });

    // Auto-refresh when driver unlocks device or switches back to tab
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { orders: freshOrders, suppliers: freshSuppliers } = await getDriverOrdersAndVendors(
            currentUser,
            trucks,
            employees,
            localSuppliers.length > 0 ? localSuppliers : suppliers
          );
          setLocalOrders(freshOrders);
          if (freshSuppliers && freshSuppliers.length > 0) {
            setLocalSuppliers(freshSuppliers);
          }
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsub();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentUser, trucks, employees, suppliers]);

  const uEmail = currentUser.email || '';
  const uEmailPart = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;

  // Match user's assigned vehicle (truck)
  const myTruck = findUserAssignedTruck(currentUser, trucks);
  const userTrucks = trucks.filter(t => isVehicleMatchingUser(t, currentUser));
  if (myTruck && !userTrucks.some(ut => ut.id === myTruck.id)) {
    userTrucks.push(myTruck);
  }

  // Helper to match an employee from employees list
  const findEmp = (idOrName?: string) => {
    if (!idOrName || !idOrName.trim()) return undefined;
    const trimmed = idOrName.trim();
    
    // 1. Exact ID match
    const exactMatch = employees.find(e => 
      e && (
        (e.id && e.id.toLowerCase() === trimmed.toLowerCase()) || 
        (e.personal_id && e.personal_id.toLowerCase() === trimmed.toLowerCase())
      )
    );
    if (exactMatch) return exactMatch;

    // 2. Exact name match
    const nameMatch = employees.find(e => e && e.name && normalizeText(e.name) === normalizeText(trimmed));
    if (nameMatch) return nameMatch;

    // 3. Name or email match if not a UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (!isUuid) {
      const targetClean = cleanStr(trimmed);
      if (targetClean.length >= 2) {
        return employees.find(e => {
          if (!e) return false;
          if (e.name && cleanStr(e.name) === targetClean) return true;
          if (e.email && cleanStr(e.email.split('@')[0]) === targetClean) return true;
          return false;
        });
      }
    }
    return undefined;
  };

  const driverObj = findEmp(myTruck?.driver_id) || findEmp(myTruck?.driver_name);
  const companionObj = findEmp(myTruck?.companion_id) || findEmp(myTruck?.companion_name);

  let assignedDriverName = driverObj?.name || myTruck?.driver_name;
  if (!assignedDriverName && myTruck?.driver_id) {
    if (!myTruck.driver_id.includes('-') && myTruck.driver_id.length < 20) {
      assignedDriverName = myTruck.driver_id;
    }
  }
  if (!assignedDriverName && (myTruck?.driver_id === currentUser.id || myTruck?.driver_id === currentUser.personal_id)) {
    assignedDriverName = currentUser.name;
  }
  if (!assignedDriverName) assignedDriverName = 'არ არის მინიჭებული';

  let assignedCompanionName = companionObj?.name || myTruck?.companion_name;
  if (!assignedCompanionName && myTruck?.companion_id) {
    if (!myTruck.companion_id.includes('-') && myTruck.companion_id.length < 20) {
      assignedCompanionName = myTruck.companion_id;
    }
  }
  if (!assignedCompanionName && (myTruck?.companion_id === currentUser.id || myTruck?.companion_id === currentUser.personal_id)) {
    assignedCompanionName = currentUser.name;
  }
  if (!assignedCompanionName) assignedCompanionName = 'არ არის მინიჭებული';

  const vehiclePlateText = myTruck?.plate_number || (uEmailPart ? uEmailPart.toUpperCase() : '') || currentUser.name || '';
  const vehicleId = myTruck?.id || '';

  // Strict current date helper for Asia/Tbilisi timezone
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date());

  const isTodayOrder = (o: Order): boolean => {
    return checkOrderPickupDateIsToday(o, todayStr);
  };

  // Filter orders assigned specifically to this vehicle (or driver) and with pickup date set as current date
  const myOrders = localOrders.filter(o => {
    if (!o || o.is_deleted) return false;
    if (!isTodayOrder(o)) return false;
    return isOrderAssignedToVehicle(o, currentUser, trucks);
  });

  const activeOrders = myOrders.filter(o => o.status === 'registered' || o.status === 'driver_assigned' || o.status === 'picked_up' || o.status === 'uncompleted');
  const sortedActiveOrders = sortOrdersByRouteRank(activeOrders);
  const completedOrders = myOrders.filter(o => o.status === 'completed');

  // Rearrangement page: shows exactly the same orders as active orders page
  const sequenceOrders = sortedActiveOrders;

  // Detect incoming orders dynamically for notification banner & unacknowledged count
  useEffect(() => {
    const currentActiveIds = new Set(activeOrders.map(o => o.id));

    // 1. Prune known IDs that are no longer active for this vehicle.
    // This allows re-notifying if an order is unassigned and then re-assigned!
    for (const id of Array.from(knownOrderIdsRef.current)) {
      if (!currentActiveIds.has(id)) {
        knownOrderIdsRef.current.delete(id);
      }
    }

    // 2. Prune unacknowledged orders: remove any order that was unassigned from this vehicle
    setUnacknowledgedOrders(prev => {
      const filtered = prev.filter(o => currentActiveIds.has(o.id));
      if (filtered.length === 0 && prev.length > 0) {
        setActiveBanner(null);
      }
      return filtered;
    });

    // 3. Initial load: memorize existing orders so we don't spam banner on first open
    if (!initialLoadDoneRef.current) {
      activeOrders.forEach(o => knownOrderIdsRef.current.add(o.id));
      initialLoadDoneRef.current = true;
      return;
    }

    // 4. Identify genuine incoming newly assigned orders
    const incoming = activeOrders.filter(o => !knownOrderIdsRef.current.has(o.id));
    if (incoming.length > 0) {
      incoming.forEach(o => knownOrderIdsRef.current.add(o.id));
      setUnacknowledgedOrders(prev => {
        const combined = [...incoming, ...prev].filter(o => currentActiveIds.has(o.id));
        const unique = Array.from(new Map(combined.map(o => [o.id, o])).values());

        const latest = incoming[0];
        const activeSuppliers = localSuppliers.length > 0 ? localSuppliers : suppliers;
        const supplierObj = activeSuppliers.find(s => s.id === latest.vendor_id);
        const vendorName = supplierObj?.trade_name || supplierObj?.company_name || latest.vendor_name || 'მომწოდებელი';
        const resolvedCity = resolveCityName(supplierObj?.city || latest.city);
        const resolvedDistrict = resolveDistrictName(supplierObj?.district || latest.district);
        const addressParts = [resolvedCity, resolvedDistrict, supplierObj?.address || latest.address].filter(Boolean);
        const address = addressParts.length > 0 ? addressParts.join(', ') : 'მისამართი მითითებული არ არის';

        setActiveBanner({
          count: unique.length,
          vendorName,
          address
        });

        return unique;
      });
    }
  }, [activeOrders, localSuppliers, suppliers]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY !== null) {
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (deltaY < -25) {
        // Swiped up: dismiss banner
        setActiveBanner(null);
      }
      setTouchStartY(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'registered': return 'რეგისტრირებული';
      case 'driver_assigned': return 'მძღოლი მინიჭებულია';
      case 'picked_up': return 'წაღებულია';
      case 'uncompleted': return 'შეუსრულებელი';
      case 'completed': return 'დასრულებული';
      case 'cancelled': return 'გაუქმებული';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative" id="mobile-logistics-portal">
      {/* Sleek Modern Whitish Incoming Order Notification Banner (Persists until swiped up or tapped) */}
      <AnimatePresence>
        {activeBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            drag="y"
            dragConstraints={{ top: -100, bottom: 0 }}
            dragElastic={{ top: 0.5, bottom: 0.05 }}
            onDragEnd={(_, info) => {
              if (info.offset.y < -25 || info.velocity.y < -150) {
                setActiveBanner(null);
              }
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="fixed top-3 left-4 right-4 z-[90] max-w-md mx-auto touch-pan-y"
          >
            <div 
              onClick={() => {
                setShowSequenceModal(true);
                setActiveBanner(null);
              }}
              className="bg-white text-slate-800 px-4 py-3 rounded-2xl shadow-2xl border border-slate-200/90 cursor-pointer flex items-center justify-between gap-3 select-none active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center flex-shrink-0 self-center shadow-xs">
                  <ClipboardList size={18} className="text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black tracking-wide text-emerald-800 uppercase">
                      {activeBanner.count > 1 ? `${activeBanner.count} ახალი შეკვეთა` : 'ახალი შეკვეთა'}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate leading-snug">
                    {activeBanner.vendorName}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate leading-snug">
                    {activeBanner.address}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center pl-1 text-slate-400 flex-shrink-0">
                <span className="text-[10px] font-semibold text-slate-400">↑ აწიეთ</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <MobileLogisticsHeader
        currentUser={currentUser}
        vehiclePlateText={vehiclePlateText}
        assignedDriverName={assignedDriverName}
        assignedCompanionName={assignedCompanionName}
        onLogOut={onLogOut}
      />

      {/* Primary list space */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]">
        {/* Toggle active / completed and sequence order button */}
        <div className="flex items-center gap-2">
          <button
            id="btn-open-order-sequence"
            onClick={() => setShowSequenceModal(true)}
            className="w-10 h-9.5 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-emerald-900 rounded-xl border border-gray-200/90 shadow-xs transition flex items-center justify-center cursor-pointer select-none flex-shrink-0"
            title="შეკვეთების თანმიმდევრობა"
          >
            <List size={20} className="stroke-[2.3]" />
          </button>

          <div className="flex-1 flex bg-gray-200/70 p-1 rounded-xl shadow-inner">
            <button
              onClick={() => { setActiveTab('active'); setSelectedOrder(null); }}
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition tracking-tight cursor-pointer relative flex items-center justify-center gap-1.5 ${
                activeTab === 'active' 
                  ? 'bg-white text-emerald-900 shadow-sm border border-gray-100' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>აქტიური შეკვეთები ({activeOrders.length})</span>
              {unacknowledgedOrders.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-black leading-none bg-emerald-600 text-white rounded-full shadow-xs animate-pulse">
                  {unacknowledgedOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('completed'); setSelectedOrder(null); }}
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition tracking-tight cursor-pointer ${
                activeTab === 'completed' 
                  ? 'bg-white text-emerald-900 shadow-sm border border-gray-100' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              დასრულებული ({completedOrders.length})
            </button>
          </div>
        </div>

        {/* Current task form if an order is selected */}
        {(() => {
          const activeSuppliers = localSuppliers.length > 0 ? localSuppliers : suppliers;
          return selectedOrder ? (
            <OrderCompletionModal
              selectedOrder={selectedOrder}
              supplier={activeSuppliers.find(s => s.id === selectedOrder.vendor_id)}
              currentUser={currentUser}
              vehiclePlateText={vehiclePlateText}
              onClose={() => setSelectedOrder(null)}
              onSaveOrder={onSaveOrder}
            />
          ) : (
            <div className="space-y-3">
              {activeTab === 'active' ? (
                activeOrders.length === 0 ? (
                  <div className="text-center bg-white border border-dashed rounded-2xl py-12 p-5 text-gray-400 space-y-2">
                    <ClipboardList size={30} className="mx-auto text-gray-300" />
                    <p className="text-xs font-medium">თქვენთვის მინიჭებული აქტიური შეკვეთები არ არის.</p>
                  </div>
                ) : (
                  sortedActiveOrders.map(order => (
                    <ActiveOrderCard
                      key={order.id}
                      order={order}
                      supplier={activeSuppliers.find(s => s.id === order.vendor_id)}
                      getStatusLabel={getStatusLabel}
                      onSelectOrder={setSelectedOrder}
                    />
                  ))
                )
              ) : (
                completedOrders.length === 0 ? (
                  <div className="text-center bg-white border border-dashed rounded-2xl py-12 p-5 text-gray-400 space-y-2">
                    <ClipboardList size={30} className="mx-auto text-gray-300" />
                    <p className="text-xs font-medium">თქვენს ანგარიშზე დასრულებული შეკვეთები ჯერ არ არის.</p>
                  </div>
                ) : (
                  completedOrders.map(order => (
                    <CompletedOrderCard
                      key={order.id}
                      order={order}
                      supplier={activeSuppliers.find(s => s.id === order.vendor_id)}
                    />
                  ))
                )
              )}
            </div>
          );
        })()}
      </main>

      {/* Reordering Modal (slides in from left) */}
      <AnimatePresence>
        {showSequenceModal && (
          <OrderSequenceModal
            isOpen={showSequenceModal}
            onClose={() => {
              setShowSequenceModal(false);
              // Leaving the reordering modal confirms driver has acknowledged and ordered the new stops
              setUnacknowledgedOrders([]);
              setActiveBanner(null);
            }}
            orders={sequenceOrders}
            suppliers={localSuppliers.length > 0 ? localSuppliers : suppliers}
            vehiclePlateText={vehiclePlateText}
            vehicleId={vehicleId}
            driverId={currentUser.id}
            dateStr={todayStr}
            newOrderIds={unacknowledgedOrders.map(o => o.id)}
            onOrdersReordered={(reorderedItems) => {
              const reorderedMap = new Map(reorderedItems.map(i => [i.id, i]));
              setLocalOrders(prev => {
                const rest = prev.filter(o => !reorderedMap.has(o.id));
                return [...reorderedItems, ...rest];
              });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
