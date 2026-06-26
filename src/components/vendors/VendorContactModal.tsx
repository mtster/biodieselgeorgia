import React, { useState, useEffect } from 'react';
import { VendorContact } from '../../types';
import { X, Trash2 } from 'lucide-react';
import { formatPhone, t } from '../../utils/lang';
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
      alert(t("Please fill in contact name and phone number"));
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
          fontClass="font-mono"
          onFocus={() => { if(!contactPhone) setContactPhone('+995 ') }}
          onChange={(e) => setContactPhone(formatPhone(e.target.value))}
        />
        <FormSelect
          label={t("Position / Role")}
          value={contactPos}
          onChange={(e) => setContactPos(e.target.value as any)}
        >
          <option value="accountant">{t("Accountant")}</option>
          <option value="director">{t("Director/Owner")}</option>
          <option value="operator">{t("Operations Mgr")}</option>
          <option value="other">{t("Other Position")}</option>
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
