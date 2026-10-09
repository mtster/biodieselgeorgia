import React, { useState, useEffect } from 'react';
import { User, Order, Vendor, Warehouse, Truck } from '../../types';
import { ClipboardList, List } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { MobileLogisticsHeader } from '../mobile-logistics/MobileLogisticsHeader';
import { ActiveOrderCard } from '../mobile-logistics/ActiveOrderCard';
import { CompletedOrderCard } from '../mobile-logistics/CompletedOrderCard';
import { OrderCompletionModal } from '../mobile-logistics/OrderCompletionModal';
import { OrderSequenceModal } from '../logistics/OrderSequenceModal';
import { sortOrdersByRouteRank } from '../../utils/lexorank';
import { cleanStr, normalizeText, findUserAssignedTruck, isVehicleMatchingUser, checkOrderPickupDateIsToday, isOrderAssignedToVehicle } from '../../services/roleDataService';

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

  useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  const uEmail = currentUser.email || '';
  const uEmailPart = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
  const uEmailClean = cleanStr(uEmailPart);
  const uNameClean = cleanStr(currentUser.name);
  const uNameNorm = normalizeText(currentUser.name);
  const uPidClean = cleanStr(currentUser.personal_id);
  const uPlateClean = cleanStr((currentUser as any).plate_number);

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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="mobile-logistics-portal">
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
              className={`flex-1 py-2 text-xs font-extrabold rounded-lg transition tracking-tight cursor-pointer ${
                activeTab === 'active' 
                  ? 'bg-white text-emerald-900 shadow-sm border border-gray-100' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              აქტიური შეკვეთები ({activeOrders.length})
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
        {selectedOrder ? (
          <OrderCompletionModal
            selectedOrder={selectedOrder}
            supplier={suppliers.find(s => s.id === selectedOrder.vendor_id)}
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
                    supplier={suppliers.find(s => s.id === order.vendor_id)}
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
                    supplier={suppliers.find(s => s.id === order.vendor_id)}
                  />
                ))
              )
            )}
          </div>
        )}
      </main>

      {/* Reordering Modal (slides in from left) */}
      <AnimatePresence>
        {showSequenceModal && (
          <OrderSequenceModal
            isOpen={showSequenceModal}
            onClose={() => setShowSequenceModal(false)}
            orders={sequenceOrders}
            suppliers={suppliers}
            vehiclePlateText={vehiclePlateText}
            vehicleId={vehicleId}
            driverId={currentUser.id}
            dateStr={todayStr}
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
