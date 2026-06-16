import React from 'react';
import { VendorContact } from '../../types';
import { Plus, Phone } from 'lucide-react';

interface VendorContactsSectionProps {
  contacts: VendorContact[];
  onAddContact: () => void;
  onModifyContact: (c: VendorContact) => void;
}

export default function VendorContactsSection({
  contacts,
  onAddContact,
  onModifyContact
}: VendorContactsSectionProps) {
  return (
    <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between" id="vendor-extra-contacts">
      <div>
        <div className="flex items-center justify-between border-b pb-2 mb-4">
          <span className="text-xs font-black uppercase text-gray-500 tracking-wider font-sans">
            Part 2: Additional Contact Persons
          </span>
          <button
            type="button"
            onClick={onAddContact}
            className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border text-slate-700 font-black rounded-lg transition inline-flex items-center gap-1 select-none cursor-pointer"
          >
            <Plus size={12} /> Add Contact
          </button>
        </div>

        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          {contacts.filter(c => !c.is_default).map((c) => (
            <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs text-left group">
              <div>
                <span className="font-extrabold text-gray-800 block text-xs">{c.name}</span>
                <span className="text-[10px] text-gray-400 font-sans uppercase tracking-wider block font-medium mt-0.5">{c.position}</span>
                <span className="text-[10.5px] text-emerald-800 font-mono font-bold mt-1 block select-all inline-flex items-center gap-1">
                  <Phone size={10} /> {c.phone}
                </span>
              </div>
              <div className="flex gap-1 select-none">
                <button
                  type="button"
                  onClick={() => onModifyContact(c)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 border text-gray-650 rounded-lg text-[10px] font-bold cursor-pointer transition"
                >
                  Modify
                </button>
              </div>
            </div>
          ))}

          {contacts.filter(c => !c.is_default).length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs italic font-sans">
              No alternative/additional contact recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
