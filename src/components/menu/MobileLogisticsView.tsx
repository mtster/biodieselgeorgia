import React, { useState } from 'react';
import { User, Order, Vendor, Warehouse, Truck } from '../../types';
import { formatDateTime } from '../../utils/lang';
import { 
  LogOut, Leaf, Phone, MapPin, Navigation, 
  CheckCircle2, ClipboardList, Fuel, Package, TruckIcon, AlertCircle 
} from 'lucide-react';

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

  // Form states for pickup completion
  const [qtyActual, setQtyActual] = useState<string>('');
  const [tanksLeftActual, setTanksLeftActual] = useState<string>('');
  const [tanksBringActual, setTanksBringActual] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Find user's truck if applicable
  const myTruck = trucks.find(t => t.driver_id === currentUser.id);

  // Filter orders assigned to this driver
  const myOrders = orders.filter(o => o.driver_id === currentUser.id);
  const activeOrders = myOrders.filter(o => o.status === 'registered' || o.status === 'driver_assigned' || o.status === 'picked_up');
  const completedOrders = myOrders.filter(o => o.status === 'completed');

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setQtyActual(order.qty_requested.toString());
    setTanksLeftActual(order.tanks_to_leave.toString());
    setTanksBringActual(order.tanks_to_bring.toString());
    setNote(order.note || '');
    setFormError('');
  };

  const handleCompletePickup = () => {
    if (!selectedOrder) return;
    const liters = parseFloat(qtyActual);
    const left = parseInt(tanksLeftActual, 10);
    const brought = parseInt(tanksBringActual, 10);

    if (isNaN(liters) || liters <= 0) {
      setFormError('Please enter a valid amount of actual collected liters');
      return;
    }
    if (isNaN(left) || left < 0 || isNaN(brought) || brought < 0) {
      setFormError('Tanks counts must be positive integers');
      return;
    }

    const updatedOrder: Order = {
      ...selectedOrder,
      fact_qty: liters,
      fact_tank_dropoff: left,
      fact_tank_pickup: brought,
      pickup_date_time: new Date().toISOString(),
      note: note.trim(),
      status: 'completed'
    };

    onSaveOrder(updatedOrder);
    setSelectedOrder(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="mobile-logistics-portal">
      {/* App Mobile Header */}
      <header className="bg-emerald-900 text-white px-5 py-4 flex items-center justify-between shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-800 p-1.5 rounded-lg">
            <Leaf size={18} className="text-emerald-300" />
          </div>
          <div>
            <span className="text-[10px] font-black tracking-widest text-emerald-300 block uppercase font-mono leading-none">Biodiesel driver</span>
            <span className="text-sm font-black tracking-tight leading-none text-white block mt-0.5">Logistics Dashboard</span>
          </div>
        </div>

        <button 
          onClick={onLogOut}
          className="p-1.5 bg-emerald-800/50 hover:bg-red-800 hover:text-white rounded-lg transition overflow-hidden flex items-center justify-center cursor-pointer"
        >
          <LogOut size={16} />
        </button>
      </header>

      {/* Driver metadata card */}
      <section className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white p-5 shadow-sm border-b border-emerald-900/10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold block">ACTIVE OPERATOR</span>
            <h2 className="text-base font-extrabold">{currentUser.name}</h2>
            <p className="text-xs text-emerald-100/70 font-mono">ID: {currentUser.personal_id}</p>
          </div>
          {myTruck && (
            <div className="bg-emerald-800/60 border border-emerald-700/50 px-4 py-2.5 rounded-2xl flex items-center gap-2 text-right">
              <TruckIcon size={18} className="text-emerald-300" />
              <div>
                <span className="text-[9px] font-bold block text-emerald-300 uppercase leading-none">VEHICLE PLATE</span>
                <span className="text-xs font-black font-mono block mt-0.5">{myTruck.plate_number}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Primary list space */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* Toggle active / completed */}
        <div className="flex bg-gray-200/60 p-1 rounded-xl">
          <button
            onClick={() => { setActiveTab('active'); setSelectedOrder(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition tracking-tight ${
              activeTab === 'active' 
                ? 'bg-white text-gray-800 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Assigned Pickups ({activeOrders.length})
          </button>
          <button
            onClick={() => { setActiveTab('completed'); setSelectedOrder(null); }}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition tracking-tight ${
              activeTab === 'completed' 
                ? 'bg-white text-gray-800 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Completed ({completedOrders.length})
          </button>
        </div>

        {/* Current task form if an order is active */}
        {selectedOrder ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Complete pickup task</span>
                <h3 className="font-extrabold text-sm text-gray-800 mt-0.5">
                  {selectedOrder.vendor_name || 'Pickup Order'}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="text-xs text-gray-400 hover:text-gray-650 px-2 py-1 rounded bg-gray-100 font-bold"
              >
                Back
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-700 text-xs font-semibold">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 tracking-wider uppercase block mb-1">
                  Actual volume collected (Liters)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={qtyActual}
                    onChange={(e) => setQtyActual(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white"
                  />
                  <span className="absolute right-4 top-2.5 text-xs font-bold text-gray-400">Liters</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Requested volume: {selectedOrder.qty_requested} Liters</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 tracking-wider uppercase block mb-1">
                    Tanks left actual
                  </label>
                  <input
                    type="number"
                    value={tanksLeftActual}
                    onChange={(e) => setTanksLeftActual(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[9px] text-gray-450 mt-1">Expected: {selectedOrder.tanks_to_leave}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 tracking-wider uppercase block mb-1">
                    Tanks brought actual
                  </label>
                  <input
                    type="number"
                    value={tanksBringActual}
                    onChange={(e) => setTanksBringActual(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="text-[9px] text-gray-450 mt-1">Expected: {selectedOrder.tanks_to_bring}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 tracking-wider uppercase block mb-1">
                  Driver Remarks / Notes
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="E.g., tanks are sealed, left companion note, keys returned..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:bg-white"
                />
              </div>

              <button
                onClick={handleCompletePickup}
                className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                Save Collected Metrics & Close
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTab === 'active' ? (
              activeOrders.length === 0 ? (
                <div className="text-center bg-white border border-dashed rounded-2xl py-12 p-5 text-gray-400 space-y-2">
                  <ClipboardList size={30} className="mx-auto text-gray-300" />
                  <p className="text-xs font-medium">All clear! No pending collections assigned to you today.</p>
                </div>
              ) : (
                activeOrders.map(order => {
                  const supplier = suppliers.find(s => s.id === order.vendor_id);
                  return (
                    <div 
                      key={order.id}
                      className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3 hover:border-emerald-300 transition"
                    >
                      <div className="flex items-start justify-between border-b border-gray-50 pb-2">
                        <div>
                          <span className="text-[10px] font-mono bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black">
                            {order.doc_number}
                          </span>
                          <h3 className="font-extrabold text-xs text-gray-800 mt-1.5">
                            {supplier?.trade_name || order.vendor_name || 'Vendor Collection'}
                          </h3>
                        </div>
                        <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full capitalize">
                          {order.status}
                        </span>
                      </div>

                      {/* Location & Contacts */}
                      {supplier && (
                        <div className="space-y-2.5 text-[11px] text-gray-600">
                          <div className="flex items-start gap-1.5">
                            <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                            <span>{supplier.city}, {supplier.district}, {supplier.address}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            {supplier.contacts && supplier.contacts.length > 0 ? (
                              <a 
                                href={`tel:${supplier.contacts[0].phone}`}
                                className="inline-flex items-center gap-1.5 bg-gray-50 border text-gray-700 px-3 py-1.5 rounded-xl text-[10px] font-extrabold hover:bg-emerald-50 hover:text-emerald-800 transition"
                              >
                                <Phone size={11} />
                                Call Contact ({supplier.contacts[0].name})
                              </a>
                            ) : (
                              <span className="text-[10px] text-gray-400">No contacts listed</span>
                            )}

                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(supplier.city + ', ' + supplier.address)}`}
                              target="_blank"
                              rel="referrer"
                              className="inline-flex items-center gap-1 bg-gray-50 border text-gray-750 px-3 py-1.5 rounded-xl text-[10px] font-extrabold hover:bg-emerald-50 hover:text-emerald-800 transition"
                            >
                              <Navigation size={11} />
                              Open Maps
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Pickup specs */}
                      <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div>
                          <span className="text-gray-400 uppercase block mb-0.5 font-bold">Liters Req</span>
                          <span className="font-extrabold text-gray-700 font-mono text-xs">{order.qty_requested} L</span>
                        </div>
                        <div>
                          <span className="text-gray-400 uppercase block mb-0.5 font-bold">Leave tanks</span>
                          <span className="font-extrabold text-gray-700 font-mono text-xs">{order.tanks_to_leave}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 uppercase block mb-0.5 font-bold">Bring tanks</span>
                          <span className="font-extrabold text-gray-700 font-mono text-xs">{order.tanks_to_bring}</span>
                        </div>
                      </div>

                      {order.note && (
                        <div className="text-[10px] italic bg-amber-50/55 p-2 rounded-lg border border-amber-50 text-gray-600">
                          <strong>Note:</strong> {order.note}
                        </div>
                      )}

                      {/* Complete pickup trigger */}
                      <button
                        onClick={() => handleSelectOrder(order)}
                        className="w-full py-2 bg-emerald-850 hover:bg-emerald-900 border border-emerald-900 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 hover:scale-[1.01] cursor-pointer"
                      >
                        <Fuel size={14} />
                        Update & Complete Collection
                      </button>
                    </div>
                  );
                })
              )
            ) : (
              completedOrders.length === 0 ? (
                <div className="text-center bg-white border border-dashed rounded-2xl py-12 p-5 text-gray-400 space-y-2">
                  <ClipboardList size={30} className="mx-auto text-gray-300" />
                  <p className="text-xs font-medium">No completed pickups registered under your user account yet.</p>
                </div>
              ) : (
                completedOrders.map(order => (
                  <div 
                    key={order.id}
                    className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3 opacity-90"
                  >
                    <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                      <div>
                        <span className="text-[9px] font-mono bg-gray-100 px-1.5 py-0.5 rounded font-black text-gray-500">
                          {order.doc_number}
                        </span>
                        <h3 className="font-extrabold text-xs text-gray-800 mt-1 leading-none">
                          {order.vendor_name || 'Vendor Collection'}
                        </h3>
                      </div>
                      <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} /> Finished
                      </span>
                    </div>

                    <div className="bg-emerald-50/30 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                      <div>
                        <span className="text-gray-400 uppercase block mb-0.5 font-bold">QTY RECORDED</span>
                        <span className="font-black text-emerald-800 font-mono text-xs">{order.fact_qty} L</span>
                      </div>
                      <div>
                        <span className="text-gray-400 uppercase block mb-0.5 font-bold">Tanks Left</span>
                        <span className="font-black text-emerald-800 font-mono text-xs">{order.fact_tank_dropoff}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 uppercase block mb-0.5 font-bold">Tanks Brought</span>
                        <span className="font-black text-emerald-800 font-mono text-xs">{order.fact_tank_pickup}</span>
                      </div>
                    </div>

                    {order.pickup_date_time && (
                      <p className="text-[9px] text-gray-400 text-right mt-1">
                        Completed: {formatDateTime(order.pickup_date_time)}
                      </p>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}
