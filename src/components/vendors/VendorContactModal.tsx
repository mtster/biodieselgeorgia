import React, { useState, useEffect } from 'react';
import { VendorContact } from '../../types';
import { X, Trash2 } from 'lucide-react';
import { formatPhone } from '../../utils/lang';
import { FormInput, FormSelect } from '../FormInput';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeContact: VendorContact | null;
  onSave: (contact: Partial<VendorContact>) => void;
  onDelete: (id: string) => void;
}

export default function VendorContactModal({ isOpen, onClose, activeContact, onSave, onDelete }: Props) {
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPos, setContactPos] = useState<'accountant' | 'director' | 'operator' | 'other'>('accountant');
  const [contactNote, setContactNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (activeContact) {
        setContactName(activeContact.name);
        setContactPhone(activeContact.phone);
        setContactPos(activeContact.position);
        setContactNote(activeContact.note || '');
      } else {
        setContactName('');
        setContactPhone('');
        setContactPos('accountant');
        setContactNote('');
      }
    }
  }, [isOpen, activeContact]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      alert("Please fill in contact name and phone number");
      return;
    }
    onSave({
      name: contactName,
      phone: contactPhone,
      position: contactPos,
      note: contactNote
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95">
        <div className="flex justify-between items-center border-b pb-2">
          <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wide">
            {activeContact ? 'Edit Contact Person' : 'Add Contact Person'}
          </h4>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded text-gray-400">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-3.5 text-left">
          <FormInput
            label="Contact Name *"
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
          <FormInput
            label="Mobile Phone Number *"
            type="text"
            value={contactPhone}
            fontClass="font-mono"
            onFocus={() => { if(!contactPhone) setContactPhone('+995 ') }}
            onChange={(e) => setContactPhone(formatPhone(e.target.value))}
          />
          <FormSelect
            label="Position / Role"
            value={contactPos}
            onChange={(e) => setContactPos(e.target.value as any)}
          >
            <option value="accountant">Accountant</option>
            <option value="director">Director/Owner</option>
            <option value="operator">Operations Mgr</option>
            <option value="other">Other Position</option>
          </FormSelect>
          <FormInput
            label="Short Note (e.g. call instructions)"
            type="text"
            value={contactNote}
            onChange={(e) => setContactNote(e.target.value)}
          />
        </div>


        <div className="flex gap-2.5 justify-end pt-2 font-sans select-none">
          {activeContact && (
            <button
              type="button"
              onClick={() => onDelete(activeContact.id)}
              className="mr-auto px-3 py-1.5 border border-rose-250 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition flex items-center gap-1 select-none cursor-pointer"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-100 text-gray-650 rounded-lg text-xs font-bold transition select-none cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-lg text-xs font-extrabold transition select-none cursor-pointer"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
