import React from 'react';
import { Supplier, Order, Employee, Truck } from '../types';
import { 
  Building2, ShoppingBag, Truck as TruckIcon, 
  Users, Fuel, Calendar, HelpCircle 
} from 'lucide-react';

interface Props {
  suppliers: Supplier[];
  orders: Order[];
  employees: Employee[];
  trucks: Truck[];
  onNavigate: (tab: string) => void;
}

export default function DashboardView({ suppliers, orders, employees, trucks, onNavigate }: Props) {
  const activeOrders = orders.filter(o => o.status === 'registered' || o.status === 'scheduled');
  const completedOrders = orders.filter(o => o.status === 'completed');
  
  const totalLiters = completedOrders.reduce((sum, curr) => sum + (curr.qty_actual || 0), 0);
  const activeDrivers = employees.filter(e => e.role === 'driver').length;

  return (
    <div className="space-y-6">
      {/* Dynamic Header */}
      <div className="bg-gradient-to-r from-emerald-850 to-emerald-950 text-white rounded-2xl p-6 shadow-sm border border-emerald-800/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-700/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300 font-mono">
            მართვის პანელი
          </p>
          <h2 className="text-xl md:text-2xl font-black">
            მოგესალმებით, ბიოდიზელი ჯორჯიას პორტალზე
          </h2>
          <p className="text-xs text-emerald-100/80 max-w-xl leading-relaxed">
            აქ შეგიძლიათ მართოთ მომწოდებლები, დაგეგმოთ კოლექციის შეკვეთები, აკონტროლოთ საწყობების ნაშთები და იხილოთ დეტალური ანალიტიკა.
          </p>
        </div>
      </div>

      {/* Grid Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <button 
          onClick={() => onNavigate('suppliers')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group"
        >
          <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <Building2 size={20} />
          </div>
          <span className="text-xs text-gray-500 font-medium block">მომწოდებლები</span>
          <span className="text-xl font-extrabold text-gray-800 font-mono">
            {suppliers.length}
          </span>
        </button>

        <button 
          onClick={() => onNavigate('orders')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group"
        >
          <div className="bg-blue-50 text-blue-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <ShoppingBag size={20} />
          </div>
          <span className="text-xs text-gray-500 font-medium block">აქტიური შეკვეთები</span>
          <span className="text-xl font-extrabold text-gray-800 font-mono">
            {activeOrders.length}
          </span>
        </button>

        <button 
          onClick={() => onNavigate('orders')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group"
        >
          <div className="bg-orange-50 text-orange-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <Fuel size={20} />
          </div>
          <span className="text-xs text-gray-500 font-medium block">ჯამური ლიტრაჟი (ფაქტ.)</span>
          <span className="text-xl font-extrabold text-gray-800 font-mono">
            {totalLiters.toLocaleString()} ლ.
          </span>
        </button>

        <button 
          onClick={() => onNavigate('employees')}
          className="p-4 bg-white border border-gray-100 rounded-2xl text-left hover:border-emerald-300 transition shadow-xs group"
        >
          <div className="bg-purple-50 text-purple-700 p-2.5 rounded-xl w-fit mb-3 group-hover:scale-110 transition duration-300">
            <Users size={20} />
          </div>
          <span className="text-xs text-gray-500 font-medium block">მძღოლები</span>
          <span className="text-xl font-extrabold text-gray-800 font-mono">
            {activeDrivers} / {employees.length}
          </span>
        </button>

      </div>

      {/* Main Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Latest active orders */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-55 pb-3">
            <h3 className="font-extrabold text-sm text-gray-850">უახლესი აქტიური შეკვეთები</h3>
            <button 
              onClick={() => onNavigate('orders')}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              ყველას ნახვა
            </button>
          </div>

          {activeOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              აქტიური შეკვეთები ამჟამად არ არის რეგისტრირებული.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeOrders.slice(0, 5).map(order => {
                const supplierObj = suppliers.find(s => s.id === order.supplier_id);
                return (
                  <div key={order.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800">
                          {supplierObj ? supplierObj.trade_name : 'უცნობი მომწოდებელი'}
                        </span>
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                          {order.doc_number}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        საწყობი: {order.warehouse_name || 'დაუზუსტებელი'} • რაოდენობა: {order.qty_requested} ლ.
                      </p>
                    </div>
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block ${
                        order.status === 'registered' 
                          ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' 
                          : 'bg-[#e0f2fe] text-[#0369a1]'
                      }`}>
                        {order.status === 'registered' ? 'რეგისტრირებული' : 'დაგეგმილი'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick look status panel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
          <div className="border-b border-gray-55 pb-3">
            <h3 className="font-extrabold text-sm text-gray-850">ოპერაციების სტატუსი</h3>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">სულ მანქანა:</span>
              <span className="font-mono font-bold text-gray-800">{trucks.length}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">აქტიური უბნები/ქალაქები:</span>
              <span className="font-mono font-bold text-gray-800">
                {Array.from(new Set(suppliers.map(s => s.city))).length} ქალაქი
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">მიღებული ზეთი (ლიტრებში):</span>
              <span className="font-mono font-bold text-emerald-700">{totalLiters} ლ.</span>
            </div>
            <div className="pt-2 border-t border-gray-50 space-y-1">
              <p className="text-[10px] text-gray-400 leading-relaxed font-mono">
                სისტემა ავტომატურად აგზავნის შეტყობინებას ბუღალტერთან, როდესაც მძღოლი ასრულებს შეკვეთას.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
