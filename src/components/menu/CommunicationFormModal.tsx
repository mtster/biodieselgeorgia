import React, { useState, useEffect, useRef } from 'react';
import { Communication, User, Vendor } from '../../types';
import FormModal from '../FormModal';
import { FormInput, FormSelect } from '../FormInput';
import { t } from '../../utils/lang';

interface CommunicationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingComm: Communication | null;
  isNew: boolean;
  employees: User[];
  suppliers: Vendor[];
  onSave: (finalComm: Communication) => void;
  onDelete?: () => void;
}

const toDisplayDateTime = (val: string | undefined | null): string => {
  if (!val) return '';
  const clean = val.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const toDbDateTime = (val: string): string => {
  if (!val) return '';
  const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [_, d, m, y] = match;
    return `${y}-${m}-${d}T12:00:00.000Z`;
  }
  return val;
};

export default function CommunicationFormModal({
  isOpen,
  onClose,
  editingComm,
  isNew,
  employees,
  suppliers,
  onSave,
  onDelete
}: CommunicationFormModalProps) {
  const [localComm, setLocalComm] = useState<Communication | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [localReminderTime, setLocalReminderTime] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowVendorSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && editingComm) {
      setLocalComm({ ...editingComm });
      const suppObj = suppliers.find(s => s.id === editingComm.vendor_id);
      setVendorSearch(suppObj ? suppObj.trade_name : '');
    } else {
      setLocalComm(null);
      setVendorSearch('');
    }
    setShowVendorSuggestions(false);
  }, [isOpen, editingComm, suppliers]);

  useEffect(() => {
    if (localComm && localComm.reminder_time) {
      setLocalReminderTime(toDisplayDateTime(localComm.reminder_time));
    } else {
      setLocalReminderTime('');
    }
  }, [localComm?.reminder_time]);

  if (!localComm) return null;

  const handleSaveLocal = () => {
    let final = { ...localComm };
    if (final.type === 'reminder' && localReminderTime) {
      const dbVal = toDbDateTime(localReminderTime);
      if (dbVal && !isNaN(new Date(dbVal).getTime())) {
        final.reminder_time = dbVal;
      }
    }
    onSave(final);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isNew ? t('New Communication') : t('Edit Communication')}
      maxWidthClass="max-w-md"
      onCancel={onClose}
      onSave={handleSaveLocal}
      saveLabel={isNew ? t('Add Communication') : t('Save Communication')}
      onDelete={!isNew ? onDelete : undefined}
      deleteLabel={t("Delete")}
    >
      <div className="space-y-4">
        <div className="relative" ref={wrapperRef}>
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left text-gray-400">{t("Supplier *")}</span>
          <input
            type="text"
            placeholder=""
            value={vendorSearch}
            onChange={(e) => {
              setVendorSearch(e.target.value);
              setShowVendorSuggestions(true);
              if (e.target.value === '') {
                setLocalComm(prev => prev ? { ...prev, vendor_id: '' } : null);
              }
            }}
            onFocus={() => setShowVendorSuggestions(true)}
            className="block w-full px-3.5 py-4 md:py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900 font-sans"
          />
          {showVendorSuggestions && (
            <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-50 divide-y divide-gray-50">
              {suppliers
                .filter(s => {
                  const searchStr = vendorSearch.toLowerCase();
                  return s.trade_name.toLowerCase().includes(searchStr) || 
                         s.company_name.toLowerCase().includes(searchStr) || 
                         s.id_code.toLowerCase().includes(searchStr);
                })
                .map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setLocalComm(prev => prev ? { ...prev, vendor_id: s.id } : null);
                      setVendorSearch(s.trade_name);
                      setShowVendorSuggestions(false);
                    }}
                    className="px-3.5 py-2 hover:bg-slate-50 cursor-pointer text-left transition duration-100"
                  >
                    <p className="text-xs font-bold text-gray-800">{s.trade_name}</p>
                    <p className="text-[9px] text-gray-400 font-mono mt-0.5">{s.company_name}</p>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <FormSelect
          label={t("Interaction Type")}
          value={localComm.type}
          onChange={(e) => {
            const nextType = e.target.value as any;
            setLocalComm({
              ...localComm,
              type: nextType,
              task_status: nextType === 'task' ? (localComm.task_status || 'pending') : undefined,
              responsible_user_id: nextType === 'task' ? (localComm.responsible_user_id || employees[0]?.id || '') : undefined
            });
          }}
        >
          <option value="action">{t("Action")}</option>
          <option value="reminder">{t("Reminder")}</option>
          <option value="task">{t("Task")}</option>
        </FormSelect>

        {localComm.type === 'reminder' && (
          <FormInput
            label="Reminder Due Time"
            type="text"
            placeholder="DD/MM/YYYY"
            fontClass="font-mono"
            value={localReminderTime}
            onChange={(e) => {
              const val = e.target.value;
              setLocalReminderTime(val);
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
                const dbVal = toDbDateTime(val);
                setLocalComm(prev => prev ? { ...prev, reminder_time: dbVal } : null);
              }
            }}
            onBlur={() => {
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(localReminderTime)) {
                const dbVal = toDbDateTime(localReminderTime);
                setLocalComm(prev => prev ? { ...prev, reminder_time: dbVal } : null);
              }
            }}
          />
        )}

        <FormSelect
          label={t("User Rep *")}
          value={localComm.user_id}
          onChange={(e) => setLocalComm({...localComm, user_id: e.target.value})}
        >
          {employees.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </FormSelect>

        {localComm.type === 'task' && (
          <div className="grid grid-cols-2 gap-3">
            <FormSelect
              label={t("Responsible User *")}
              value={localComm.responsible_user_id || ''}
              onChange={(e) => setLocalComm({...localComm, responsible_user_id: e.target.value})}
            >
              <option value="">{t("Select Employee")}</option>
              {employees.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </FormSelect>

            <FormSelect
              label={t("Task Status *")}
              value={localComm.task_status || 'pending'}
              onChange={(e) => setLocalComm({...localComm, task_status: e.target.value as any})}
            >
              <option value="pending">{t("Pending")}</option>
              <option value="in_progress">{t("In Progress")}</option>
              <option value="completed">{t("Completed")}</option>
            </FormSelect>
          </div>
        )}



        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left text-gray-400">{t("Comment *")}</span>
          <textarea 
            rows={4}
            placeholder=""
            value={localComm.comment}
            onChange={(e) => setLocalComm({...localComm, comment: e.target.value})}
            className="block w-full px-3.5 py-4 md:py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900 font-sans"
          />
        </div>
      </div>
    </FormModal>
  );
}
