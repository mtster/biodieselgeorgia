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
  const [contactPos, setContactPos] = useState<'director' | 'manager' | 'object_number' | 'accountant' | 'cook' | 'other'>('director');
  const [contactNote, setContactNote] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (activeContact) {
        setContactName(activeContact.name);
        setContactPhone(activeContact.phone);
        setContactPos(activeContact.position || 'director');
        setContactNote(activeContact.note || '');
        setContactEmail(activeContact.email || '');
      } else {
        setContactName('');
        setContactPhone('');
        setContactPos('director');
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
    const digitsBefore = beforeCursor.replace(/[^0-9+]/g, '').length;

    const formatted = formatPhone(val);
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
      input.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const preventCursorBehindPlus = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (input.selectionStart !== null && input.selectionStart < 1) {
      input.setSelectionRange(1, Math.max(1, input.selectionEnd || 1));
    }
  };

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;

      if (start === 1 && end === 1) {
        e.preventDefault();
        return;
      }

      if (start === end && start !== null && start > 0) {
        const val = input.value;
        const charToLeft = val[start - 1];

        if (charToLeft === ' ') {
          e.preventDefault();

          let deleteIdx = start - 1;
          while (deleteIdx >= 0 && val[deleteIdx] === ' ') {
            deleteIdx--;
          }

          if (deleteIdx >= 0) {
            const newVal = val.slice(0, deleteIdx) + val.slice(deleteIdx + 1);
            const formatted = formatPhone(newVal);

            const digitsBefore = val.slice(0, deleteIdx).replace(/[^0-9+]/g, '').length;
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
              input.setSelectionRange(newPos, newPos);
            }, 0);
          }
        }
      }
    }
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
          fontClass="font-mono"
          onFocus={() => { if(!contactPhone) setContactPhone('+995 ') }}
          onSelect={preventCursorBehindPlus}
          onClick={preventCursorBehindPlus}
          onTouchEnd={preventCursorBehindPlus}
          onChange={handlePhoneChange}
          onKeyDown={handlePhoneKeyDown}
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
