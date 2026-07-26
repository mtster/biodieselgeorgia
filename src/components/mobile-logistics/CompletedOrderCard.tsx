import React from 'react';
import { Order, Vendor } from '../../types';
import { formatDateTime } from '../../utils/lang';
import { CheckCircle2 } from 'lucide-react';

interface Props {
  order: Order;
  supplier?: Vendor;
}

export function CompletedOrderCard({ order, supplier }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3 opacity-95">
      <div className="flex items-center justify-between border-b border-gray-50 pb-2">
        <div>
          <span className="text-[9px] font-mono bg-gray-100 px-1.5 py-0.5 rounded font-black text-gray-500">
            {order.doc_number}
          </span>
          <h3 className="font-extrabold text-xs text-gray-800 mt-1 leading-none">
            {supplier?.trade_name || order.vendor_name || 'მიმწოდებელი'}
          </h3>
        </div>
        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 size={10} /> დასრულებული
        </span>
      </div>

      <div className="bg-emerald-50/40 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-[10px]">
        <div>
          <span className="text-gray-400 uppercase block mb-0.5 font-bold">ფაქტ. რაოდენობა</span>
          <span className="font-black text-emerald-800 font-mono text-xs">{order.fact_qty || 0} ლ</span>
        </div>
        <div>
          <span className="text-gray-400 uppercase block mb-0.5 font-bold">ფაქტ. წამოღება</span>
          <span className="font-black text-emerald-800 font-mono text-xs">{order.fact_tank_pickup ?? 0}</span>
        </div>
        <div>
          <span className="text-gray-400 uppercase block mb-0.5 font-bold">ფაქტ. დატოვება</span>
          <span className="font-black text-emerald-800 font-mono text-xs">{order.fact_tank_dropoff ?? 0}</span>
        </div>
      </div>

      {((order.notes && order.notes.length > 0) || order.note) && (
        <div className="text-[10px] italic bg-slate-50 p-2 rounded-lg border border-slate-100 text-gray-600 space-y-1">
          {order.notes && order.notes.length > 0 ? (
            order.notes.map((n, idx) => (
              <div key={n.id || idx}>
                <strong>{n.user_name || 'შენიშვნა'}:</strong> {n.comment}
              </div>
            ))
          ) : (
            <div><strong>შენიშვნა:</strong> {order.note}</div>
          )}
        </div>
      )}

      {order.pickup_date_time && (
        <p className="text-[9px] text-gray-400 text-right mt-1">
          დასრულდა: {formatDateTime(order.pickup_date_time)}
        </p>
      )}
    </div>
  );
}
