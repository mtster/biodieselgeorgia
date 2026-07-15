import React, { useState, useRef, useEffect } from 'react';
import { User, Order, Warehouse, OrderStatus } from '../../types';
import { t, formatDate } from '../../utils/lang';
import { LogOut, Plus, ChevronLeft } from 'lucide-react';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { StandardTable } from '../StandardTable';
import { FormInput, FormSelect } from '../FormInput';

interface SupplierViewProps {
  currentUser: User;
  orders: Order[];
  warehouses: Warehouse[];
  onSaveOrder: (order: Order) => void;
  onLogOut: () => void;
}

export default function SupplierView({
  currentUser,
  orders,
  warehouses,
  onSaveOrder,
  onLogOut
}: SupplierViewProps) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState(formatDateString(startOfMonth));
  const [endDate, setEndDate] = useState(formatDateString(endOfMonth));

  // Editing state
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Profile menu popup state
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // Filter supplier orders
  const supplierOrders = orders.filter(order => {
    // Only show orders belonging to the logged in supplier
    if (order.vendor_id !== currentUser.vendor_id) return false;
    if (order.is_deleted) return false;

    // Search term filter on document number
    if (searchTerm) {
      const doc = order.doc_number.toLowerCase();
      const s = searchTerm.toLowerCase();
      if (!doc.includes(s)) return false;
    }

    // Status filter
    if (statusFilter && order.status !== statusFilter) return false;

    // Period filter
    if (startDate && order.order_date < startDate) return false;
    if (endDate && order.order_date > endDate) return false;

    return true;
  });

  // Table Columns Setup
  const columns = [
    {
      header: "თარიღი",
      key: "order_date",
      render: (item: Order) => <span className="font-mono font-medium">{formatDate(item.order_date)}</span>
    },
    {
      header: "დოკუმენტის კოდი",
      key: "doc_number",
      render: (item: Order) => <span className="font-mono font-bold text-gray-900">{item.doc_number}</span>
    },
    {
      header: "სტატუსი",
      key: "status",
      render: (item: Order) => {
        let bg = 'bg-slate-100 text-slate-800';
        let label: string = item.status;
        if (item.status === 'registered') {
          bg = 'bg-sky-50 text-sky-700 border-sky-100';
          label = 'რეგისტრირებული';
        } else if (item.status === 'driver_assigned') {
          bg = 'bg-indigo-50 text-indigo-700 border-indigo-100';
          label = 'მძღოლი მინიჭებულია';
        } else if (item.status === 'completed') {
          bg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
          label = 'დასრულებული';
        } else if (item.status === 'uncompleted') {
          bg = 'bg-amber-50 text-amber-700 border-amber-100';
          label = 'დაუსრულებელი';
        } else if (item.status === 'cancelled') {
          bg = 'bg-rose-50 text-rose-700 border-rose-100';
          label = 'გაუქმებული';
        } else {
          label = item.status;
        }
        return (
          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${bg} tracking-tight`}>
            {label}
          </span>
        );
      }
    },
    {
      header: "ფაქტობრივი რაოდენობა",
      key: "fact_qty",
      render: (item: Order) => (
        <span className="font-mono font-semibold text-slate-800">
          {item.fact_qty !== undefined && item.fact_qty !== null ? `${item.fact_qty} ლ` : '-'}
        </span>
      )
    },
    {
      header: "ფაქტობრივი ჩაბარება",
      key: "fact_tank_dropoff",
      render: (item: Order) => (
        <span className="font-mono text-slate-700">
          {item.fact_tank_dropoff !== undefined && item.fact_tank_dropoff !== null ? item.fact_tank_dropoff : '-'}
        </span>
      )
    },
    {
      header: "ფაქტობრივი წამოღება",
      key: "fact_tank_pickup",
      render: (item: Order) => (
        <span className="font-mono text-slate-700">
          {item.fact_tank_pickup !== undefined && item.fact_tank_pickup !== null ? item.fact_tank_pickup : '-'}
        </span>
      )
    }
  ];

  // Initialize a new scheduled order
  const handleAddNewOrder = () => {
    const newOrder: Order = {
      id: '',
      order_date: new Date().toISOString().split('T')[0],
      doc_number: 'DOC-' + Math.floor(100000 + Math.random() * 900000),
      status: 'registered',
      vendor_id: currentUser.vendor_id || '',
      warehouse_id: warehouses[0]?.id || '',
      operator_id: currentUser.id,
      qty_requested: 0,
      tanks_to_leave: 0,
      tanks_to_bring: 0,
      fact_qty: undefined,
      fact_tank_dropoff: undefined,
      fact_tank_pickup: undefined,
    };
    setEditingOrder(newOrder);
    setFieldErrors({});
  };

  // Save modified or added order
  const handleSaveOrder = () => {
    if (!editingOrder) return;
    const errors: Record<string, string> = {};

    if (!editingOrder.order_date) {
      errors.order_date = "თარიღი სავალდებულოა";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    // Ensure state values are aligned and fallbacks exist
    const savedOrder: Order = {
      ...editingOrder,
      vendor_id: currentUser.vendor_id || '',
      warehouse_id: editingOrder.warehouse_id || warehouses[0]?.id || '',
      qty_requested: editingOrder.qty_requested || 0,
      tanks_to_leave: editingOrder.tanks_to_leave || 0,
      tanks_to_bring: editingOrder.tanks_to_bring || 0,
    };

    onSaveOrder(savedOrder);
    setEditingOrder(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col">
      {/* 1. SINGLE PAGE HEADER (No sidebar) */}
      <header className="bg-white border-b border-slate-200 h-16 shrink-0 px-6 flex items-center justify-between sticky top-0 z-50 select-none">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-black tracking-tight text-emerald-800 uppercase font-sans">
            ბიოდიზელი ჯორჯია
          </h1>
        </div>

        {/* Profile indicator & dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 font-extrabold flex items-center justify-center text-xs text-slate-700 uppercase transition cursor-pointer"
          >
            {currentUser.name.slice(0, 2)}
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg w-56 py-3 px-4 space-y-3 z-50 text-left">
              <div>
                <p className="text-sm font-bold text-slate-800 truncate">{currentUser.name}</p>
                <span className="text-[11px] text-emerald-600 font-bold font-mono">
                  მომწოდებელი
                </span>
              </div>
              <div className="border-t border-slate-100"></div>
              <button
                onClick={onLogOut}
                type="button"
                className="w-full py-2 bg-slate-50 hover:bg-red-50 hover:text-red-600 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut size={14} />
                გამოსვლა
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. BODY CONTAINER */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {editingOrder ? (
            /* ------------------ RESTRICTED 6-FIELD FORM VIEW ------------------ */
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-slate-50 text-xs font-bold text-gray-700 transition cursor-pointer select-none"
                >
                  <ChevronLeft size={14} />
                  <span>უკან</span>
                </button>

                <h2 className="text-lg font-black text-slate-850">
                  {!editingOrder.id ? "შეკვეთის დამატება" : "შეკვეთის რედაქტირება"}
                </h2>

                <button
                  onClick={handleSaveOrder}
                  className="px-5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
                >
                  შენახვა
                </button>
              </div>

              <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-5 text-left">
                <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
                  შეკვეთის დეტალები
                </span>

                {/* Date field */}
                <FormInput
                  label="თარიღი *"
                  type="date"
                  fontClass="font-mono"
                  value={editingOrder.order_date}
                  onChange={(e) => setEditingOrder(prev => prev ? { ...prev, order_date: e.target.value } : null)}
                  error={fieldErrors.order_date}
                />

                {/* Doc Number field (ReadOnly / Assigned Automatically) */}
                <FormInput
                  label="დოკუმენტის კოდი"
                  type="text"
                  fontClass="font-mono font-bold text-slate-500"
                  value={editingOrder.doc_number}
                  onChange={() => {}}
                  disabled={true}
                />

                {/* Status field (ReadOnly / Not Changeable by Supplier) */}
                <FormSelect
                  label="შესრულების სტატუსი"
                  value={editingOrder.status}
                  onChange={() => {}}
                  disabled={true}
                  className="bg-slate-50 text-slate-500 font-bold"
                >
                  <option value="registered">რეგისტრირებული</option>
                  <option value="driver_assigned">მძღოლი მინიჭებულია</option>
                  <option value="completed">დასრულებული</option>
                  <option value="uncompleted">დაუსრულებელი</option>
                  <option value="cancelled">გაუქმებული</option>
                </FormSelect>

                {/* Planned Qty field */}
                <FormInput
                  label="გეგმიური რაოდენობა (ლ)"
                  type="number"
                  step="0.01"
                  fontClass="font-mono font-bold"
                  value={editingOrder.qty_requested === undefined || editingOrder.qty_requested === null ? '' : editingOrder.qty_requested}
                  onChange={(e) => setEditingOrder(prev => prev ? { ...prev, qty_requested: e.target.value === '' ? 0 : parseFloat(e.target.value) } : null)}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tanks to leave field */}
                  <FormInput
                    label="დასატოვებელი ავზები"
                    type="number"
                    fontClass="font-mono"
                    value={editingOrder.tanks_to_leave === undefined || editingOrder.tanks_to_leave === null ? '' : editingOrder.tanks_to_leave}
                    onChange={(e) => setEditingOrder(prev => prev ? { ...prev, tanks_to_leave: e.target.value === '' ? 0 : parseInt(e.target.value, 10) } : null)}
                  />

                  {/* Tanks to bring field */}
                  <FormInput
                    label="წამოსაღები ავზები"
                    type="number"
                    fontClass="font-mono"
                    value={editingOrder.tanks_to_bring === undefined || editingOrder.tanks_to_bring === null ? '' : editingOrder.tanks_to_bring}
                    onChange={(e) => setEditingOrder(prev => prev ? { ...prev, tanks_to_bring: e.target.value === '' ? 0 : parseInt(e.target.value, 10) } : null)}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ------------------ TABLE VIEW ------------------ */
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">შეკვეთები</h2>
                </div>

                <button
                  onClick={handleAddNewOrder}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
                >
                  <Plus size={14} strokeWidth={3} />
                  <span>შეკვეთის დამატება</span>
                </button>
              </div>

              {/* Standardized Search Bar & Filters */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Period date filter */}
                  <div className="shrink-0">
                    <PeriodFilter
                      startDate={startDate}
                      setStartDate={setStartDate}
                      endDate={endDate}
                      setEndDate={setEndDate}
                    />
                  </div>

                  {/* Search and status filter */}
                  <div className="flex-1 min-w-0">
                    <CentralSearchBar
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      searchPlaceholder="ძებნა დოკუმენტის კოდით..."
                      filters={[
                        {
                          label: "სტატუსი",
                          value: statusFilter,
                          onChange: setStatusFilter,
                          placeholder: "ყველა სტატუსი",
                          options: [
                            { value: 'registered', label: 'რეგისტრირებული' },
                            { value: 'driver_assigned', label: 'მძღოლი მინიჭებულია' },
                            { value: 'completed', label: 'დასრულებული' },
                            { value: 'uncompleted', label: 'დაუსრულებელი' },
                            { value: 'cancelled', label: 'გაუქმებული' },
                          ]
                        }
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* Standardized Table list */}
              <StandardTable
                data={supplierOrders}
                columns={columns}
                onRowClick={(item) => {
                  setEditingOrder({ ...item });
                  setFieldErrors({});
                }}
                emptyMessage="შეკვეთები ვერ მოიძებნა."
              />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
