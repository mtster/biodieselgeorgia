import React from 'react';
import { Order, Vendor, User } from '../../types';
import { Edit2, Trash2 } from 'lucide-react';

interface Props {
  filteredOrders: Order[];
  suppliers: Vendor[];
  employees: User[];
  startEdit: (ord: Order) => void;
  askDelete: (id: string, docNum: string) => void;
}

export default function OrdersList({
  filteredOrders,
  suppliers,
  employees,
  startEdit,
  askDelete
}: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left text-gray-700">
          <thead>
            <tr className="border-b border-gray-200 text-[10px] text-gray-400 uppercase font-mono bg-slate-50 select-none">
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
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.map((ord) => {
              const supplierObj = suppliers.find(s => s.id === ord.vendor_id);
              const actualDriver = employees.find(e => e.id === ord.driver_id)?.name || ord.driver_name;
              const actualCompanion = employees.find(e => e.id === ord.companion_id)?.name || ord.companion_name;
              return (
                <tr key={ord.id} className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4 font-mono font-bold text-gray-955">
                    {ord.doc_number}
                    <span className="text-[9px] text-gray-400 block font-normal">{new Date(ord.order_date).toLocaleDateString('en-US')}</span>
                  </td>
                  
                  <td className="py-3.5 px-4">
                    <span className="font-extrabold text-gray-800 block text-[12.5px]">
                      {supplierObj ? supplierObj.trade_name : (ord.vendor_name || 'Dispatched supplier')}
                    </span>
                    {ord.note && (
                      <span className="text-[10px] text-amber-700 block bg-amber-50 rounded px-1.5 py-0.5 w-fit font-mono mt-1 font-semibold leading-normal">
                        {ord.note}
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-gray-600 font-sans font-medium">
                    {ord.warehouse_name || 'Unassigned Destination'}
                  </td>

                  <td className="py-3.5 px-4 font-mono">
                    <span className="text-gray-550 font-medium">{ord.qty_requested} L.</span>
                    {ord.qty_actual !== undefined && (
                      <span className="text-emerald-800 font-black text-[11.5px] block">→ {ord.qty_actual} L. (Actual)</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 font-mono font-medium">
                    <span>Drop: {ord.tanks_to_leave} | Pick: {ord.tanks_to_bring}</span>
                    {ord.tanks_left_actual !== undefined && (
                      <span className="text-indigo-800 block font-bold">Placed: {ord.tanks_left_actual} | Picked: {ord.tanks_bring_actual}</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-gray-655 font-sans">
                    <span className="block font-extrabold text-[11px] text-slate-800 leading-none">Driver: {actualDriver || 'None Assigned'}</span>
                    <span className="text-[10px] block text-gray-400 mt-1 leading-none">Co-Driver: {actualCompanion || 'None Assigned'}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit ${
                      ord.status === 'registered' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                      ord.status === 'scheduled' ? 'bg-[#e0f2fe] text-[#0369a1]' :
                      ord.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' :
                      'bg-red-50 text-red-700 border border-red-100'
                    }`}>
                      {ord.status === 'registered' ? 'Registered' :
                       ord.status === 'scheduled' ? 'Scheduled' :
                       ord.status === 'completed' ? 'Completed' :
                       'Cancelled'}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1 select-none font-sans font-bold">
                      <button 
                        onClick={() => startEdit(ord)}
                        className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                        title="Modify details / crew"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={() => askDelete(ord.id, ord.doc_number)}
                        className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                        title="Delete dispatch log"
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
        <div className="text-center py-20 text-xs text-gray-400 font-sans italic">
          No active collection order entries were located.
        </div>
      )}
    </div>
  );
}
