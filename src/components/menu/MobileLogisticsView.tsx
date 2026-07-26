import React, { useState } from 'react';
import { User, Order, Vendor, Warehouse, Truck } from '../../types';
import { ClipboardList } from 'lucide-react';
import { MobileLogisticsHeader } from '../mobile-logistics/MobileLogisticsHeader';
import { ActiveOrderCard } from '../mobile-logistics/ActiveOrderCard';
import { CompletedOrderCard } from '../mobile-logistics/CompletedOrderCard';
import { OrderCompletionModal } from '../mobile-logistics/OrderCompletionModal';

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

  // Helper function to sanitize a string for comparison
  const cleanStr = (str?: string) => str ? str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';

  const uEmail = currentUser.email || '';
  const uEmailPart = uEmail.includes('@') ? uEmail.split('@')[0] : uEmail;
  const uEmailClean = cleanStr(uEmailPart);
  const uNameClean = cleanStr(currentUser.name);
  const uPidClean = cleanStr(currentUser.personal_id);
  const uIdClean = cleanStr(currentUser.id);

  // Match user's assigned vehicle (truck)
  const myTruck = trucks.find(t => {
    if (!t) return false;

    // 1. Match by auth_user_id or vehicle id
    if (t.auth_user_id && t.auth_user_id === currentUser.id) return true;
    if (t.id && t.id === currentUser.id) return true;

    // 2. Match by driver_id or companion_id
    if (t.driver_id && (t.driver_id === currentUser.id || (currentUser.personal_id && t.driver_id === currentUser.personal_id))) return true;
    if (t.companion_id && (t.companion_id === currentUser.id || (currentUser.personal_id && t.companion_id === currentUser.personal_id))) return true;

    // 3. Match sanitized plate number
    const tPlateClean = cleanStr(t.plate_number);
    if (tPlateClean) {
      if (uEmailClean && (tPlateClean === uEmailClean || tPlateClean.includes(uEmailClean) || uEmailClean.includes(tPlateClean))) return true;
      if (uNameClean && (tPlateClean === uNameClean || tPlateClean.includes(uNameClean) || uNameClean.includes(tPlateClean))) return true;
      if (uPidClean && tPlateClean === uPidClean) return true;
      if (uIdClean && tPlateClean === uIdClean) return true;
    }

    return false;
  });

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
    const nameMatch = employees.find(e => e && e.name && e.name.toLowerCase() === trimmed.toLowerCase());
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

  // Filter orders assigned to this vehicle or driver or plate
  const myOrders = orders.filter(o => {
    if (!o || o.is_deleted) return false;

    // 1. Match by vehicle_id
    if (myTruck?.id && o.vehicle_id && o.vehicle_id === myTruck.id) return true;

    // 2. Match by truck_plate (sanitized comparison)
    const oPlateClean = cleanStr(o.truck_plate);
    if (oPlateClean) {
      if (myTruck?.plate_number && (cleanStr(myTruck.plate_number) === oPlateClean || cleanStr(myTruck.plate_number).includes(oPlateClean) || oPlateClean.includes(cleanStr(myTruck.plate_number)))) return true;
      if (uEmailClean && (oPlateClean === uEmailClean || oPlateClean.includes(uEmailClean) || uEmailClean.includes(oPlateClean))) return true;
      if (uNameClean && (oPlateClean === uNameClean || oPlateClean.includes(uNameClean) || uNameClean.includes(oPlateClean))) return true;
      if (uPidClean && oPlateClean === uPidClean) return true;
    }

    // 3. Match by driver_id or companion_id
    if (o.driver_id) {
      if (o.driver_id === currentUser.id || (currentUser.personal_id && o.driver_id === currentUser.personal_id)) return true;
      if (myTruck?.driver_id && o.driver_id === myTruck.driver_id) return true;
      if (driverObj?.id && o.driver_id === driverObj.id) return true;
    }
    if (o.companion_id) {
      if (o.companion_id === currentUser.id || (currentUser.personal_id && o.companion_id === currentUser.personal_id)) return true;
      if (myTruck?.companion_id && o.companion_id === myTruck.companion_id) return true;
      if (companionObj?.id && o.companion_id === companionObj.id) return true;
    }

    // 4. Match by driver_name or companion_name text
    if (o.driver_name && assignedDriverName !== 'არ არის მინიჭებული' && (cleanStr(o.driver_name) === cleanStr(assignedDriverName) || cleanStr(o.driver_name) === uNameClean)) return true;
    if (o.companion_name && assignedCompanionName !== 'არ არის მინიჭებული' && (cleanStr(o.companion_name) === cleanStr(assignedCompanionName) || cleanStr(o.companion_name) === uNameClean)) return true;

    return false;
  });

  const activeOrders = myOrders.filter(o => o.status === 'registered' || o.status === 'driver_assigned' || o.status === 'picked_up' || o.status === 'uncompleted');
  const completedOrders = myOrders.filter(o => o.status === 'completed');

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
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* Toggle active / completed */}
        <div className="flex bg-gray-200/70 p-1 rounded-xl shadow-inner">
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
                activeOrders.map(order => (
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
    </div>
  );
}
