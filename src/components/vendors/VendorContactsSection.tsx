import React from 'react';
import { VendorContact } from '../../types';
import { Plus, Phone, Star, Pencil } from 'lucide-react';

interface VendorContactsSectionProps {
  contacts: VendorContact[];
  onAddContact: () => void;
  onModifyContact: (c: VendorContact) => void;
  onTogglePrimaryContact: (id: string) => void;
  error?: string;
}

export default function VendorContactsSection({
  contacts,
  onAddContact,
  onModifyContact,
  onTogglePrimaryContact,
  error
}: VendorContactsSectionProps) {
  return (
    <div className={`bg-white p-5 border ${error ? 'border-red-500' : 'border-gray-100'} rounded-2xl flex flex-col justify-between`} id="vendor-extra-contacts">
      <div>
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
          <span className="text-xs font-black uppercase text-gray-500 tracking-wider font-sans">
            Contacts
          </span>
          <button
            type="button"
            onClick={onAddContact}
            className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border border-gray-200 text-slate-700 font-black rounded-lg transition inline-flex items-center gap-1 select-none cursor-pointer"
          >
            <Plus size={12} /> Add Contact
          </button>
        </div>

        <div className="space-y-2.5 max-h-[224px] overflow-y-auto pr-1">
          {contacts.map((c) => (
            <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs text-left group">
              <div className="flex gap-3 items-center">
                <span className="font-extrabold text-gray-800">
                  {c.name}
                </span>
                <span className="text-[10px] text-gray-400 font-sans uppercase font-semibold">
                  {c.position}
                </span>
                <span className="text-[10.5px] text-emerald-800 font-mono font-bold select-all inline-flex items-center gap-1 ml-2">
                  <Phone size={10} /> {c.phone}
                </span>
              </div>
              <div className="flex items-center gap-1 select-none text-right">
                {/* Star design toggle next to edit button */}
                <button
                  type="button"
                  onClick={() => onTogglePrimaryContact(c.id)}
                  title={c.is_default ? "Primary Contact" : "Mark as Primary"}
                  className={`p-1.5 transition cursor-pointer rounded-lg hover:bg-slate-100 ${
                    c.is_default ? 'text-amber-500 hover:text-amber-600' : 'text-gray-300 hover:text-amber-500'
                  }`}
                >
                  <Star size={13} fill={c.is_default ? "#fbbf24" : "none"} strokeWidth={2} />
                </button>

                {/* Sleek borderless pencil edit button */}
                <button
                  type="button"
                  onClick={() => onModifyContact(c)}
                  className="p-1.5 text-gray-400 hover:text-emerald-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  title="Modify"
                >
                  <Pencil size={13} />
                </button>
              </div>
            </div>
          ))}

          {contacts.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs italic font-sans">
              No contacts recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
