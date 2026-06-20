import React, { useState, useEffect } from 'react';
import { VendorContact } from '../../types';
import { X, Trash2 } from 'lucide-react';
import { formatPhone } from '../../utils/lang';
import { FormInput, FormSelect } from '../FormInput';
import FormModal from '../FormModal';

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
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={activeContact ? 'Edit Contact Person' : 'Add Contact Person'}
      maxWidthClass="max-w-sm"
      onDelete={activeContact ? () => onDelete(activeContact.id) : undefined}
      deleteLabel="Delete"
      onCancel={onClose}
      onSave={handleSave}
      saveLabel="Confirm"
    >
      <div className="space-y-3.5">
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
    </FormModal>
  );
}
