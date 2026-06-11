import React, { useState, useEffect } from 'react';
import { Order, Supplier, Warehouse, Employee, Truck, OrderStatus } from '../types';
import { getSMSLogs } from '../lib/db';
import { 
  Plus, Search, Edit2, CheckCircle2, 
  MessageSquareCode, Calendar, Trash2, X, Check,
  User, TruckIcon, Fuel, ClipboardList, Info
} from 'lucide-react';

interface Props {
  orders: Order[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  employees: Employee[];
  trucks: Truck[];
  currentEmployee: Employee;
  onSave: (order: Order) => void;
  onDelete: (id: string, docNum: string) => void;
}

export default function OrdersView({ 
  orders, suppliers, warehouses, employees, trucks, 
  currentEmployee, onSave, onDelete 
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Active form management
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showSMSLogs, setShowSMSLogs] = useState(false);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);

  const loadSMSLogs = async () => {
    const data = await getSMSLogs();
    setSmsLogs(data);
  };

  useEffect(() => {
    loadSMSLogs();
  }, [orders]);

  const startNew = () => {
    const defaultOrder: Order = {
      id: '',
      order_date: new Date().toISOString().substring(0, 10),
      doc_number: 'DOC-' + Math.floor(100000 + Math.random() * 900000),
      supplier_id: suppliers[0]?.id || '',
      warehouse_id: warehouses[0]?.id || '',
      note: '',
      qty_requested: 50,
      qty_actual: undefined,
      tanks_to_leave: 1,
      tanks_to_bring: 1,
      tanks_left_actual: undefined,
      tanks_bring_actual: undefined,
      pickup_date_time: undefined,
      operator_id: currentEmployee.id,
      driver_id: employees.find(e => e.role === 'driver')?.id || '',
      companion_id: employees.find(e => e.role === 'companion')?.id || '',
      truck_plate: trucks[0]?.plate_number || '',
      status: 'registered'
    };
    setEditingOrder(defaultOrder);
    setIsNew(true);
  };

  const startEdit = (ord: Order) => {
    setEditingOrder(JSON.parse(JSON.stringify(ord)));
    setIsNew(false);
  };

  const handleSaveAll = () => {
    if (!editingOrder) return;
    if (!editingOrder.supplier_id || !editingOrder.doc_number) {
      alert('მიუთითეთ მომწოდებელი და დოკუმენტის ნომერი');
      return;
    }

    const supplierObj = suppliers.find(s => s.id === editingOrder.supplier_id);
    const warehouseObj = warehouses.find(w => w.id === editingOrder.warehouse_id);
    const operatorObj = employees.find(e => e.id === editingOrder.operator_id);
    const driverObj = employees.find(e => e.id === editingOrder.driver_id);
    const companionObj = employees.find(e => e.id === editingOrder.companion_id);

    const final: Order = {
      ...editingOrder,
      supplier_name: supplierObj?.trade_name || '',
      warehouse_name: warehouseObj?.name || '',
      operator_name: operatorObj?.name || currentEmployee.name,
      driver_name: driverObj?.name || '',
      companion_name: companionObj?.name || ''
    };

    onSave(final);
    setEditingOrder(null);
  };

  const filteredOrders = orders.filter(ord => {
    const supplierObj = suppliers.find(s => s.id === ord.supplier_id);
    const supplierName = supplierObj ? supplierObj.trade_name : '';
    const matchesSearch = supplierName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ord.doc_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === '' || ord.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">შეკვეთები</h2>
          <p className="text-xs text-gray-500 mt-1">ზეთის შეგროვების საფეხურები, დავალებები მძღოლებზე და დასაკავშირებელი საწყობები.</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={loadSMSLogs}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-250/60 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-150 transition"
          >
            <MessageSquareCode size={15} className="text-emerald-700 animate-pulse" />
            სმს შეტყობინებების ლოგი ({smsLogs.length})
          </button>
          
          <button 
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition"
          >
            <Plus size={15} />
            ახალი შეკვეთა
          </button>
        </div>
      </div>

      {/* FILTERS & STATUS CONTROL */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex flex-col md:flex-row gap-3">
        
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search size={15} />
          </span>
          <input 
            type="text"
            placeholder="ძებნა მომწოდებლით ან დოკუმენტის ნომრით..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200/80 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="w-full md:w-56 flex gap-2">
          <button 
            onClick={() => setSelectedStatus('')}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition ${
              selectedStatus === '' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            ყველა
          </button>
          <button 
            onClick={() => setSelectedStatus('registered')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition ${
              selectedStatus === 'registered' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-gray-50 text-gray-650 border-gray-200'
            }`}
          >
            რეგისტრირ.
          </button>
          <button 
            onClick={() => setSelectedStatus('completed')}
            className={`flex-1 py-1.5 rounded-xl text-[11px] font-bold border transition ${
              selectedStatus === 'completed' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-50 text-gray-650 border-gray-200'
            }`}
          >
            დასრულებული
          </button>
        </div>

      </div>

      {/* ORDERS GRID */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] text-gray-405 uppercase font-mono bg-gray-50">
                <th className="py-3 px-4">დოკუმენტი #</th>
                <th className="py-3 px-4">მომწოდებელი ობიექტი</th>
                <th className="py-3 px-4">საწყობი</th>
                <th className="py-3 px-4">რაოდენობა (დაგეგმ / ფაქტ)</th>
                <th className="py-3 px-4">ავზები (დასატ / წამოსაღ)</th>
                <th className="py-3 px-4">მძღოლი / თანხლები</th>
                <th className="py-3 px-4">სტატუსი</th>
                <th className="py-3 px-4 text-right">ქმედება</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.map((ord) => {
                const supplierObj = suppliers.find(s => s.id === ord.supplier_id);
                return (
                  <tr key={ord.id} className="hover:bg-gray-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                      {ord.doc_number}
                      <span className="text-[9px] text-gray-400 block font-normal">{new Date(ord.order_date).toLocaleDateString()}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-extrabold text-gray-800 block">
                        {supplierObj ? supplierObj.trade_name : 'კომპანია'}
                      </span>
                      {ord.note && <span className="text-[10px] text-amber-700 block bg-amber-50 rounded px-1.5 py-0.5 w-fit font-mono mt-1">{ord.note}</span>}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {ord.warehouse_name || 'დაუზუსტებელი'}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="text-gray-500">{ord.qty_requested} ლ.</span>
                      {ord.qty_actual !== undefined && (
                        <span className="text-emerald-700 font-bold block">→ {ord.qty_actual} ლ. (ფაქტ.)</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span>დაკავებული: {ord.tanks_to_leave} | წასაღები: {ord.tanks_to_bring}</span>
                      {ord.tanks_left_actual !== undefined && (
                        <span className="text-blue-700 block font-bold">აღებული: {ord.tanks_bring_actual} | ახალი: {ord.tanks_left_actual}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      <span className="block font-bold">🚗 {ord.driver_name || 'არ არის'}</span>
                      <span className="text-[10px] block">👥 {ord.companion_name || 'არ არის'}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit ${
                        ord.status === 'registered' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                        ord.status === 'scheduled' ? 'bg-[#e0f2fe] text-[#0369a1]' :
                        ord.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {ord.status === 'registered' ? 'რეგისტრირებული' :
                         ord.status === 'scheduled' ? 'დაგეგმილი' :
                         ord.status === 'completed' ? 'დასრულებული' :
                         'გაუქმებული'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => startEdit(ord)}
                          className="p-1.5 bg-gray-50 hover:bg-gray-100 rounded text-emerald-800 font-bold"
                          title="რედაქტირება"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => onDelete(ord.id, ord.doc_number)}
                          className="p-1.5 bg-gray-50 hover:bg-red-50 text-red-600 rounded"
                          title="წაშლა"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-16 text-xs text-gray-400">
            შეკვეთები ჩანაწერებში არ ფიქსირდება.
          </div>
        )}
      </div>

      {/* QUICK STATUS EDIT DIALOG */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-xl border border-gray-150">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-extrabold text-gray-800 text-sm">
                {isNew ? 'ახალი შეკვეთის გაფორმება' : `შეკვეთის რედაქტირება: #${editingOrder.doc_number}`}
              </h3>
              <button onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">მომწოდებელი ობიექტი *</label>
                <select
                  value={editingOrder.supplier_id}
                  onChange={(e) => setEditingOrder({...editingOrder, supplier_id: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.trade_name} ({s.company_code})</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">საწყობი *</label>
                <select
                  value={editingOrder.warehouse_id}
                  onChange={(e) => setEditingOrder({...editingOrder, warehouse_id: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                >
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">დოკუმენტის ნომერი</label>
                <input 
                  type="text"
                  value={editingOrder.doc_number}
                  onChange={(e) => setEditingOrder({...editingOrder, doc_number: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">შეკვეთის თარიღი</label>
                <input 
                  type="date"
                  value={editingOrder.order_date}
                  onChange={(e) => setEditingOrder({...editingOrder, order_date: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">რაოდენობა (დაგეგმ.)</label>
                  <input 
                    type="number"
                    value={editingOrder.qty_requested}
                    onChange={(e) => setEditingOrder({...editingOrder, qty_requested: parseFloat(e.target.value) || 0})}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">დასატოვებელი ავზი (*)</label>
                  <input 
                    type="number"
                    value={editingOrder.tanks_to_leave}
                    onChange={(e) => setEditingOrder({...editingOrder, tanks_to_leave: parseInt(e.target.value) || 0})}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-gray-400 block mb-1">წასაღები ავზი (*)</label>
                  <input 
                    type="number"
                    value={editingOrder.tanks_to_bring}
                    onChange={(e) => setEditingOrder({...editingOrder, tanks_to_bring: parseInt(e.target.value) || 0})}
                    className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-800 block mb-1">სტატუსის მართვა *</label>
                  <select
                    value={editingOrder.status}
                    onChange={(e) => {
                      const statusVal = e.target.value as OrderStatus;
                      setEditingOrder({
                        ...editingOrder,
                        status: statusVal,
                        // autofill actual date if completed
                        pickup_date_time: statusVal === 'completed' ? new Date().toISOString() : undefined
                      });
                    }}
                    className="w-full px-2 py-2 bg-emerald-55/30 border border-emerald-300 font-bold rounded-xl text-xs focus:outline-none"
                  >
                    <option value="registered">რეგისტრირებული</option>
                    <option value="scheduled">დაგეგმილი</option>
                    <option value="completed">დასრულებული (completed)</option>
                    <option value="cancelled">გაუქმებული</option>
                  </select>
                </div>
              </div>

              {/* Driver AND companion staff assignment */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">პასუხისმგებელი მძღოლი</label>
                <select
                  value={editingOrder.driver_id}
                  onChange={(e) => setEditingOrder({...editingOrder, driver_id: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                >
                  <option value="">-- აირჩიეთ მძღოლი --</option>
                  {employees.filter(e => e.role === 'driver').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">თანმხლები პირი / თანამშრომელი</label>
                <select
                  value={editingOrder.companion_id}
                  onChange={(e) => setEditingOrder({...editingOrder, companion_id: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                >
                  <option value="">-- აირჩიეთ თანმხლები --</option>
                  {employees.filter(e => e.role === 'companion').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 block mb-1">მანქანის სახელმწიფო ნომერი</label>
                <select
                  value={editingOrder.truck_plate}
                  onChange={(e) => setEditingOrder({...editingOrder, truck_plate: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                >
                  <option value="">-- აირჩიეთ მანქანა --</option>
                  {trucks.map(t => <option key={t.plate_number} value={t.plate_number}>{t.plate_number} ({t.model})</option>)}
                </select>
              </div>

              {/* Special ACTUAL properties when completed */}
              {editingOrder.status === 'completed' && (
                <div className="bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100 col-span-1 sm:col-span-2 grid grid-cols-2 gap-3.5">
                  <span className="col-span-2 text-[10px] font-black uppercase text-emerald-800 tracking-wider block">სავალდებულო ფაქტობრივი მონაცემები</span>
                  <div>
                    <label className="text-[9px] font-extrabold text-gray-400 block mb-0.5">ფაქტობრივი რაოდენობა (ლ.)</label>
                    <input 
                      type="number"
                      required
                      value={editingOrder.qty_actual || ''}
                      onChange={(e) => setEditingOrder({...editingOrder, qty_actual: parseFloat(e.target.value) || 0})}
                      className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-extrabold text-gray-400 block mb-0.5">ფაქტ. წამოღებული ავზები</label>
                    <input 
                      type="number"
                      value={editingOrder.tanks_bring_actual || ''}
                      onChange={(e) => setEditingOrder({...editingOrder, tanks_bring_actual: parseInt(e.target.value) || 0})}
                      className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-amber-800 font-bold leading-none font-mono">
                      * ყურადღება: მონაცემის 'დასრულებული' სტატუსზე შენახვისას სისტემა ავტომატურად გააგზავნის simulated სმს შეტყობინებას ბუღალტერთან!
                    </p>
                  </div>
                </div>
              )}

              <div className="col-span-1 sm:col-span-2">
                <label className="text-[11px] font-semibold text-gray-400 block mb-1 font-sans">კომენტარი / შენიშვნა</label>
                <input 
                  type="text"
                  placeholder="მაგ: სპეციალური ავზია საჭირო..."
                  value={editingOrder.note || ''}
                  onChange={(e) => setEditingOrder({...editingOrder, note: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
              <button 
                onClick={() => setEditingOrder(null)} 
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold"
              >
                გაუქმება
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-5 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition flex items-center gap-1.5"
              >
                <Check size={14} />
                დავალების შენახვა
              </button>
            </div>

          </div>
        </div>
      )}

      {/* SMS LOGGER SLIDEOVER / DIALOG */}
      {showSMSLogs && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-150">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                <MessageSquareCode className="text-emerald-700 font-bold" size={17} />
                სმს შეტყობინებების ჟურნალი (ბუღალტერია)
              </h3>
              <button onClick={() => setShowSMSLogs(false)} className="text-gray-400 hover:text-gray-650">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-gray-500 font-sans">
              სისტემაში შეკვეთის დასრულებისას გაგზავნილი SMS შეტყობინებები:
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {smsLogs.map(sms => (
                <div key={sms.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono">
                    <span>{sms.recipient}</span>
                    <span>{new Date(sms.date_time).toLocaleString('ka-GE')}</span>
                  </div>
                  <p className="font-medium text-gray-800">{sms.message}</p>
                  <span className="text-[9px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold w-fit block">
                    {sms.status}
                  </span>
                </div>
              ))}

              {smsLogs.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-xs italic">
                  სმს შეტყობინებები ჯერ არ არის გაგზავნილი.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-50 flex justify-end">
              <button 
                onClick={() => setShowSMSLogs(false)}
                className="px-4 py-1.5 bg-gray-150 text-gray-700 rounded-xl text-xs font-bold"
              >
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Triggering dynamic toggle log view */}
      <div className="mt-2 text-right">
        <button 
          onClick={() => {
            loadSMSLogs();
            setShowSMSLogs(true);
          }}
          className="text-xs font-bold text-emerald-700 underline"
        >
          ლოგების აღდგენა/ნახვა
        </button>
      </div>

    </div>
  );
}
