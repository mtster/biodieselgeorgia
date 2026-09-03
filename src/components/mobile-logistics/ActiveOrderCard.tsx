import React from 'react';
import { Order, Vendor } from '../../types';
import { MapPin, Phone, Navigation } from 'lucide-react';

interface Props {
  order: Order;
  supplier?: Vendor;
  getStatusLabel: (status: string) => string;
  onSelectOrder: (order: Order) => void;
}

export function ActiveOrderCard({ order, supplier, getStatusLabel, onSelectOrder }: Props) {
  // Find the contact selected during order creation, fallback to default or first supplier contact
  const selectedContact = React.useMemo(() => {
    if (order.contact_id && supplier?.contacts && supplier.contacts.length > 0) {
      const matched = supplier.contacts.find(c => c.id === order.contact_id);
      if (matched) return matched;
    }
    if (order.contact_name || order.contact_phone) {
      return {
        id: order.contact_id || 'order-contact',
        name: order.contact_name || 'კონტაქტი',
        phone: order.contact_phone || '',
        is_default: false
      };
    }
    if (supplier?.contacts && supplier.contacts.length > 0) {
      return supplier.contacts.find(c => c.is_default) || supplier.contacts[0];
    }
    return null;
  }, [order.contact_id, order.contact_name, order.contact_phone, supplier?.contacts]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3 hover:border-emerald-300 transition">
      <div className="flex items-start justify-between border-b border-gray-50 pb-2">
        <div>
          <span className="text-[10px] font-mono bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black">
            {order.doc_number}
          </span>
          <h3 className="font-extrabold text-xs text-gray-800 mt-1.5">
            {supplier?.trade_name || order.vendor_name || 'მიმწოდებლის შეკვეთა'}
          </h3>
        </div>
        <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full capitalize">
          {getStatusLabel(order.status)}
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
            {selectedContact ? (
              <a 
                href={selectedContact.phone ? `tel:${selectedContact.phone}` : '#'}
                className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1.5 rounded-xl text-[10px] font-extrabold hover:bg-emerald-50 hover:text-emerald-800 transition"
              >
                <Phone size={11} />
                {selectedContact.name} {selectedContact.phone ? `(${selectedContact.phone})` : ''}
              </a>
            ) : (
              <span className="text-[10px] text-gray-400">კონტაქტები არ არის</span>
            )}

            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(supplier.city + ', ' + supplier.address)}`}
              target="_blank"
              rel="referrer"
              className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-750 px-3 py-1.5 rounded-xl text-[10px] font-extrabold hover:bg-emerald-50 hover:text-emerald-800 transition"
            >
              <Navigation size={11} />
              რუკაზე გახსნა
            </a>
          </div>
        </div>
      )}

      {/* Pickup specs */}
      <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-[10px]">
        <div>
          <span className="text-gray-400 uppercase block mb-0.5 font-bold">გეგ. რაოდენობა</span>
          <span className="font-extrabold text-gray-700 font-mono text-xs">{order.qty_requested || 0} ლ</span>
        </div>
        <div>
          <span className="text-gray-400 uppercase block mb-0.5 font-bold">წამოღება</span>
          <span className="font-extrabold text-gray-700 font-mono text-xs">{order.tanks_to_bring ?? 0}</span>
        </div>
        <div>
          <span className="text-gray-400 uppercase block mb-0.5 font-bold">დატოვება</span>
          <span className="font-extrabold text-gray-700 font-mono text-xs">{order.tanks_to_leave ?? 0}</span>
        </div>
      </div>

      {((order.notes && order.notes.length > 0) || order.note) && (
        <div className="space-y-2 pt-1">
          {order.notes && order.notes.length > 0 ? (
            order.notes.map((n, idx) => {
              const isDepartureAlert = Boolean(n.before_leaving_base);
              if (isDepartureAlert) {
                return (
                  <div key={n.id || idx} className="bg-rose-50 border border-rose-200/90 p-2.5 rounded-xl text-rose-950 space-y-1 shadow-xs">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                      <span className="text-rose-900 font-extrabold">{n.user_name || 'მენეჯერი'}</span>
                      <span className="text-rose-600 font-bold">·</span>
                      <span>ბაზიდან გასვლამდე საყურადღებო</span>
                    </div>
                    <p className="text-xs font-semibold text-rose-950 leading-relaxed">{n.comment}</p>
                  </div>
                );
              }
              return (
                <div key={n.id || idx} className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl text-gray-700 space-y-0.5 text-xs">
                  <div className="text-[10px] font-bold text-gray-500">
                    {n.user_name || 'შენიშვნა'}:
                  </div>
                  <p className="font-medium text-gray-800 leading-snug">{n.comment}</p>
                </div>
              );
            })
          ) : (
            <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl text-gray-700 space-y-0.5 text-xs">
              <div className="text-[10px] font-bold text-gray-500">შენიშვნა:</div>
              <p className="font-medium text-gray-800 leading-snug">{order.note}</p>
            </div>
          )}
        </div>
      )}

      {/* Complete pickup trigger - Biodiesel green, no black outline, no fuel icon */}
      <button
        onClick={() => onSelectOrder(order)}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center cursor-pointer border-none"
      >
        შეკვეთის შესრულება
      </button>
    </div>
  );
}
