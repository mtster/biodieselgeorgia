import React, { useState, useEffect } from 'react';
import { Order, Vendor, VendorContact } from '../../types';
import { MapPin, Phone, Navigation } from 'lucide-react';
import { getVendorContacts, getVendorById } from '../../services/vendorService';

interface Props {
  order: Order;
  supplier?: Vendor;
  getStatusLabel: (status: string) => string;
  onSelectOrder: (order: Order) => void;
}

export function ActiveOrderCard({ order, supplier, getStatusLabel, onSelectOrder }: Props) {
  const [resolvedVendor, setResolvedVendor] = useState<Vendor | null>(supplier || (order as any).vendor || null);
  const [asyncContact, setAsyncContact] = useState<VendorContact | null>(null);

  // Sync or resolve vendor
  useEffect(() => {
    let isMounted = true;
    if (supplier) {
      setResolvedVendor(supplier);
      return;
    }
    if ((order as any).vendor) {
      setResolvedVendor((order as any).vendor);
      return;
    }
    if (order.vendor_id) {
      getVendorById(order.vendor_id).then(v => {
        if (isMounted && v) {
          setResolvedVendor(v);
        }
      }).catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [supplier, order.vendor_id, (order as any).vendor]);

  const currentSupplier = resolvedVendor || supplier || (order as any).vendor;

  // Find the contact selected during order creation via contact_id (referencing vendor_contacts)
  useEffect(() => {
    let isMounted = true;

    // 1. If currentSupplier already has contacts in memory
    if (currentSupplier?.contacts && currentSupplier.contacts.length > 0) {
      if (order.contact_id) {
        const matched = currentSupplier.contacts.find(c => c.id === order.contact_id);
        if (matched) {
          setAsyncContact(matched);
          return;
        }
      }
      const defaultContact = currentSupplier.contacts.find(c => c.is_default) || currentSupplier.contacts[0];
      setAsyncContact(defaultContact || null);
      return;
    }

    // 2. Fetch contacts from vendor_contacts if not loaded in supplier object
    if (order.vendor_id || currentSupplier?.id) {
      const vId = order.vendor_id || currentSupplier?.id;
      getVendorContacts(vId).then(contacts => {
        if (!isMounted) return;
        if (contacts && contacts.length > 0) {
          if (order.contact_id) {
            const matched = contacts.find(c => c.id === order.contact_id);
            if (matched) {
              setAsyncContact(matched);
              return;
            }
          }
          const defaultContact = contacts.find(c => c.is_default) || contacts[0];
          setAsyncContact(defaultContact || null);
        } else {
          setAsyncContact(null);
        }
      }).catch(() => {
        if (isMounted) setAsyncContact(null);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [order.contact_id, order.vendor_id, currentSupplier?.id, currentSupplier?.contacts]);

  const selectedContact = asyncContact;

  const displayAddress = [
    currentSupplier?.city || order.city,
    currentSupplier?.district || order.district,
    currentSupplier?.address || order.address
  ].filter(Boolean).join(', ') || order.address || (currentSupplier?.address || '');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3 hover:border-emerald-300 transition">
      <div className="flex items-start justify-between border-b border-gray-50 pb-2">
        <div>
          <span className="text-[10px] font-mono bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black">
            {order.doc_number}
          </span>
          <h3 className="font-extrabold text-xs text-gray-800 mt-1.5">
            {currentSupplier?.trade_name || currentSupplier?.company_name || order.vendor_name || 'მიმწოდებლის შეკვეთა'}
          </h3>
        </div>
        <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full capitalize">
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Location & Contacts */}
      {(displayAddress || currentSupplier || selectedContact) && (
        <div className="space-y-2.5 text-[11px] text-gray-600">
          {displayAddress ? (
            <div className="flex items-start gap-1.5">
              <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <span>{displayAddress}</span>
            </div>
          ) : null}
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

            {displayAddress ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(displayAddress)}`}
                target="_blank"
                rel="referrer"
                className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-750 px-3 py-1.5 rounded-xl text-[10px] font-extrabold hover:bg-emerald-50 hover:text-emerald-800 transition"
              >
                <Navigation size={11} />
                რუკაზე გახსნა
              </a>
            ) : null}
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
