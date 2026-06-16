import React from 'react';
import { Order, Vendor, User } from '../../types';
import { Edit2, Trash2, Check } from 'lucide-react';

interface Props {
  filteredOrders: Order[];
  suppliers: Vendor[];
  employees: User[];
  startEdit: (ord: Order, readOnly?: boolean) => void;
  askDelete: (id: string, docNum: string) => void;
  selectedOrders?: string[];
  setSelectedOrders?: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function OrdersList({
  filteredOrders,
  suppliers,
  employees,
  startEdit,
  askDelete,
  selectedOrders = [],
  setSelectedOrders
}: Props) {

  const handleRowClick = (ord: Order) => {
    // Open form in edit/write mode directly when row is tapped
    startEdit(ord, false);
  };

  const toggleSelect = (ordId: string) => {
    if (!setSelectedOrders) return;
    if (selectedOrders.includes(ordId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== ordId));
    } else {
      setSelectedOrders([...selectedOrders, ordId]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-705">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] text-gray-400 uppercase font-mono bg-slate-50 select-none">
              <th className="py-3 px-4 w-12 text-center"></th>
              <th className="py-3 px-4">Document #</th>
              <th className="py-3 px-4">Supplier / Vendor</th>
              <th className="py-3 px-4">Base Destination</th>
              <th className="py-3 px-4">QTY (Planned / Actual)</th>
              <th className="py-3 px-4">Tanks (Drop / Pick)</th>
              <th className="py-3 px-4">Assigned Crew</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredOrders.map((ord) => {
              const supplierObj = suppliers.find(s => s.id === ord.vendor_id);
              const actualDriver = employees.find(e => e.id === ord.driver_id)?.name || ord.driver_name || ord.driver_id;
              const actualCompanion = employees.find(e => e.id === ord.companion_id)?.name || ord.companion_name || ord.companion_id;
              const isChecked = selectedOrders.includes(ord.id);

              return (
                <tr 
                  key={ord.id} 
                  onClick={() => handleRowClick(ord)}
                  className={`transition-colors cursor-pointer select-none ${
                    isChecked 
                      ? 'bg-[#10b981]/5 hover:bg-[#10b981]/10' 
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Selection Checkbox */}
                  <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(ord.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all mx-auto cursor-pointer ${
                        isChecked 
                          ? 'border-emerald-650 bg-emerald-600 text-white' 
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {isChecked && <Check size={11} strokeWidth={3.5} />}
                    </button>
                  </td>

                  <td className="py-4 px-4 font-mono font-black text-gray-955 text-[13px]">
                    {ord.doc_number}
                    <span className="text-[10px] text-gray-400 block font-normal mt-0.5">
                      {new Date(ord.order_date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </span>
                  </td>
                  
                  <td className="py-4 px-4">
                    <span className="font-extrabold text-gray-900 block text-[13.5px]">
                      {supplierObj ? supplierObj.trade_name : (ord.vendor_name || 'Dispatched supplier')}
                    </span>
                    {ord.note && (
                      <span className="text-[10px] text-amber-800 bg-amber-50 rounded px-2 py-0.5 w-fit font-semibold mt-1 inline-block">
                        {ord.note}
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-4 text-gray-700 font-sans font-bold text-[13px]">
                    {ord.warehouse_name || 'Unassigned Warehouse'}
                  </td>

                  <td className="py-4 px-4 font-mono text-[13px]">
                    <span className="text-gray-600 font-bold">{ord.qty_requested} L.</span>
                    {ord.qty_actual !== undefined && (
                      <span className="text-emerald-800 font-black text-[12px] block mt-0.5">→ {ord.qty_actual} L. (True)</span>
                    )}
                  </td>

                  <td className="py-4 px-4 font-mono font-medium text-[13px]">
                    <span>Drop: {ord.tanks_to_leave} | Pick: {ord.tanks_to_bring}</span>
                    {ord.tanks_left_actual !== undefined && (
                      <span className="text-indigo-800 block font-extrabold text-[12px] mt-0.5">Placed: {ord.tanks_left_actual} | Picked: {ord.tanks_bring_actual}</span>
                    )}
                  </td>

                  <td className="py-4 px-4 text-gray-655 font-sans">
                    <span className="block font-extrabold text-[12px] text-slate-800 leading-none">Driver: {actualDriver || 'Unassigned'}</span>
                    <span className="text-[10.5px] block text-gray-450 mt-1.5 leading-none">Co-Driver: {actualCompanion || 'Unassigned'}</span>
                  </td>

                  <td className="py-4 px-4">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit ${
                      ord.status === 'registered' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                      ord.status === 'scheduled' ? 'bg-sky-50 text-sky-700 border border-sky-100' :
                      ord.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' :
                      'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      {ord.status === 'registered' ? 'Registered' :
                       ord.status === 'scheduled' ? 'Scheduled' :
                       ord.status === 'completed' ? 'Completed' :
                       'Cancelled'}
                    </span>
                  </td>

                  <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5 select-none font-sans font-bold">
                      <button 
                        onClick={() => startEdit(ord, false)}
                        className="p-2 text-gray-400 hover:text-emerald-800 hover:bg-slate-50 rounded-xl transition cursor-pointer border border-transparent hover:border-gray-200"
                        title="Modify details / crew"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => askDelete(ord.id, ord.doc_number)}
                        className="p-2 text-gray-400 hover:text-red-700 hover:bg-slate-50 rounded-xl transition cursor-pointer border border-transparent hover:border-gray-200"
                        title="Delete dispatch log"
                      >
                        <Trash2 size={14} />
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
        <div className="text-center py-20 text-xs text-gray-400 font-sans italic">
          No active collection order entries were located.
        </div>
      )}
    </div>
  );
}
