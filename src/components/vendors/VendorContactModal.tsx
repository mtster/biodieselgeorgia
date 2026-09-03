import React, { useState, useEffect } from 'react';
import { VendorContact } from '../../types';
import { X, Trash2 } from 'lucide-react';
import { formatContactPhone, t } from '../../utils/lang';
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
  const [contactPos, setContactPos] = useState<'director' | 'manager' | 'object_number' | 'accountant' | 'cook' | 'other'>('director');
  const [contactIsActive, setContactIsActive] = useState(true);
  const [contactNote, setContactNote] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (activeContact) {
        setContactName(activeContact.name);
        setContactPhone(formatContactPhone(activeContact.phone));
        setContactPos(activeContact.position || 'director');
        setContactIsActive(activeContact.is_active !== false);
        setContactNote(activeContact.note || '');
        setContactEmail(activeContact.email || '');
      } else {
        setContactName('');
        setContactPhone('');
        setContactPos('director');
        setContactIsActive(true);
        setContactNote('');
        setContactEmail('');
      }
    }
  }, [isOpen, activeContact]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const val = input.value;
    const start = input.selectionStart || 0;

    const beforeCursor = val.slice(0, start);
    const digitsBefore = beforeCursor.replace(/[^0-9]/g, '').length;

    const formatted = formatContactPhone(val);
    setContactPhone(formatted);

    setTimeout(() => {
      let newPos = 0;
      let digitCount = 0;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ' ') {
          digitCount++;
        }
        if (digitCount === digitsBefore) {
          newPos = i + 1;
          break;
        }
      }
      if (digitCount < digitsBefore) {
        newPos = formatted.length;
      }
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      alert(t("Please fill in contact name and phone number"));
      return;
    }
    onSave({
      name: contactName,
      phone: contactPhone,
      position: contactPos,
      is_active: contactIsActive,
      note: contactNote,
      email: contactEmail
    });
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={activeContact ? t('Edit Contact Person') : t('Add Contact Person')}
      maxWidthClass="max-w-sm"
      onDelete={activeContact ? () => onDelete(activeContact.id) : undefined}
      deleteLabel={t("Delete")}
      onCancel={onClose}
      onSave={handleSave}
      saveLabel={t("Confirm")}
    >
      <div className="space-y-3.5">
        <FormInput
          label={t("Contact Name *")}
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />
        <FormInput
          label={t("Mobile Phone Number *")}
          type="text"
          value={contactPhone}
          placeholder="555 11 12 23"
          fontClass="font-mono"
          onChange={handlePhoneChange}
        />
        <FormInput
          label={t("Email")}
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
        <FormSelect
          label={t("Position / Role")}
          value={contactPos}
          onChange={(e) => setContactPos(e.target.value as any)}
        >
          <option value="director">{t("Director/Owner")}</option>
          <option value="manager">{t("Manager")}</option>
          <option value="object_number">{t("Object Number")}</option>
          <option value="accountant">{t("Accountant")}</option>
          <option value="cook">{t("Cook")}</option>
          <option value="other">{t("Other Position")}</option>
        </FormSelect>
        <FormSelect
          label="სტატუსი"
          value={contactIsActive ? 'active' : 'inactive'}
          onChange={(e) => setContactIsActive(e.target.value === 'active')}
        >
          <option value="active">აქტიური</option>
          <option value="inactive">არააქტიური</option>
        </FormSelect>
        <FormInput
          label={t("Short Note (e.g. call instructions)")}
          type="text"
          value={contactNote}
          onChange={(e) => setContactNote(e.target.value)}
        />
      </div>
    </FormModal>
  );
}
