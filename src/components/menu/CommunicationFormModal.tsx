import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Communication, User, Vendor } from '../../types';
import FormModal from '../FormModal';
import { FormInput, FormSelect } from '../FormInput';
import { t } from '../../utils/lang';
import { useDebounce } from '../../hooks/useDebounce';
import { getVendorsPaginated } from '../../services/vendorService';
import { Loader2, Search, Building2, MapPin, X } from 'lucide-react';

interface CommunicationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingComm: Communication | null;
  isNew: boolean;
  employees: User[];
  suppliers: Vendor[];
  onSave: (finalComm: Communication) => void;
  onSaveAndOrder?: (finalComm: Communication, vendorId: string, isUnchanged?: boolean) => void;
  onDelete?: () => void;
  canAddOrder?: boolean;
}

export default function CommunicationFormModal({
  isOpen,
  onClose,
  editingComm,
  isNew,
  employees,
  suppliers,
  onSave,
  onSaveAndOrder,
  onDelete,
  canAddOrder = true
}: CommunicationFormModalProps) {
  const [localComm, setLocalComm] = useState<Communication | null>(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [remoteSuppliers, setRemoteSuppliers] = useState<Vendor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Split reminder date & time state
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [isCompletedStatus, setIsCompletedStatus] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(vendorSearch, 250);

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

  // Matched supplier for address display
  const matchedVendor = useMemo(() => {
    const term = vendorSearch.trim();
    if (!term) return null;
    if (localComm?.vendor_id) {
      const v = suppliers.find((s) => s.id === localComm.vendor_id) || remoteSuppliers.find((s) => s.id === localComm.vendor_id);
      if (v && (v.trade_name?.trim() === term || v.company_name?.trim() === term)) {
        return v;
      }
    }
    return suppliers.find((s) => s.trade_name?.trim() === term || s.company_name?.trim() === term) || null;
  }, [suppliers, remoteSuppliers, vendorSearch, localComm?.vendor_id]);

  const selectedAddress = matchedVendor?.address || '';

  // Remote vendor search on debounce
  useEffect(() => {
    let isMounted = true;
    const term = debouncedSearch.trim();

    if (!term || !showVendorSuggestions) {
      setRemoteSuppliers([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    getVendorsPaginated(30, 0, { searchTerm: term })
      .then((res) => {
        if (isMounted) {
          setRemoteSuppliers(res.vendors || []);
          setIsSearching(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch autocomplete suppliers', err);
        if (isMounted) {
          setIsSearching(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, showVendorSuggestions]);

  // Combined suggestions with instant local match on vendorSearch
  const filteredSuggestions = useMemo(() => {
    const term = vendorSearch.trim().toLowerCase();
    const map = new Map<string, Vendor>();

    suppliers.forEach((s) => {
      if (!term) {
        map.set(s.id, s);
      } else {
        const trade = (s.trade_name || '').toLowerCase();
        const comp = (s.company_name || '').toLowerCase();
        const addr = (s.address || '').toLowerCase();
        if (trade.includes(term) || comp.includes(term) || addr.includes(term)) {
          map.set(s.id, s);
        }
      }
    });

    remoteSuppliers.forEach((s) => {
      map.set(s.id, s);
    });

    return Array.from(map.values()).slice(0, 30);
  }, [suppliers, remoteSuppliers, vendorSearch]);

  const initialSnapshotRef = useRef<{
    isNew: boolean;
    vendorId: string;
    vendorSearch: string;
    type: string;
    comment: string;
    reminderDate: string;
    reminderTime: string;
    responsibleUserId: string;
    isCompletedStatus: boolean;
  } | null>(null);

  useEffect(() => {
    if (isOpen && editingComm) {
      const respId = editingComm.responsible_user_id || editingComm.user_id || employees[0]?.id || '';
      const isDone = typeof editingComm.is_completed === 'boolean' 
        ? editingComm.is_completed 
        : editingComm.task_status === 'completed';

      setLocalComm({ 
        ...editingComm,
        responsible_user_id: respId,
        user_id: respId,
        is_completed: isDone
      });
      setIsCompletedStatus(isDone);
      setFieldErrors({});

      let initVName = '';
      const suppObj = suppliers.find(s => s.id === editingComm.vendor_id);
      if (suppObj) {
        initVName = suppObj.trade_name || suppObj.company_name || '';
        setVendorSearch(initVName);
      } else if (editingComm.vendor_name) {
        initVName = editingComm.vendor_name;
        setVendorSearch(initVName);
      } else {
        setVendorSearch('');
      }

      // Parse reminder_time into separate Date and Time
      let parsedRDate = '';
      let parsedRTime = '';
      if (editingComm.reminder_time) {
        const raw = editingComm.reminder_time;
        if (raw.includes('T')) {
          const parts = raw.split('T');
          parsedRDate = parts[0];
          setReminderDate(parsedRDate);
          if (editingComm.has_time) {
            parsedRTime = parts[1].substring(0, 5);
            setReminderTime(parsedRTime);
          } else {
            setReminderTime('');
          }
        } else {
          parsedRDate = raw;
          setReminderDate(parsedRDate);
          setReminderTime('');
        }
      } else {
        setReminderDate('');
        setReminderTime('');
      }

      initialSnapshotRef.current = {
        isNew: Boolean(isNew || !editingComm.id),
        vendorId: editingComm.vendor_id || '',
        vendorSearch: initVName,
        type: editingComm.type || 'action',
        comment: (editingComm.comment || '').trim(),
        reminderDate: parsedRDate,
        reminderTime: parsedRTime,
        responsibleUserId: respId,
        isCompletedStatus: isDone
      };
    } else {
      setLocalComm(null);
      setVendorSearch('');
      setReminderDate('');
      setReminderTime('');
      setIsCompletedStatus(false);
      setFieldErrors({});
      initialSnapshotRef.current = null;
    }
    setShowVendorSuggestions(false);
  }, [isOpen, editingComm, isNew, suppliers, employees]);

  if (!localComm) return null;

  const handleSelectVendor = (s: Vendor) => {
    const displayName = s.trade_name || s.company_name || '';

    setLocalComm(prev => prev ? {
      ...prev,
      vendor_id: s.id,
      vendor_name: displayName
    } : null);

    setVendorSearch(displayName);
    setShowVendorSuggestions(false);
    if (fieldErrors.vendor_id) {
      setFieldErrors(prev => ({ ...prev, vendor_id: '' }));
    }
  };

  const buildPayload = (): Communication | null => {
    const errors: Record<string, string> = {};

    // Validate supplier
    const currentVendorId = localComm.vendor_id || matchedVendor?.id;
    if (!currentVendorId && !vendorSearch.trim()) {
      errors.vendor_id = t("Supplier is required");
    }

    // Validate reminder date if type is reminder
    if (localComm.type === 'reminder' && !reminderDate.trim()) {
      errors.reminder_date = t("Date is required");
    }

    // Validate responsible user
    const respId = localComm.responsible_user_id || localComm.user_id || '';
    if (!respId) {
      errors.responsible_user_id = t("Responsible user is required");
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return null;
    }

    setFieldErrors({});

    let finalReminderTime: string | undefined = undefined;
    let hasTimeSelected = false;

    if (localComm.type === 'reminder' && reminderDate.trim()) {
      if (reminderTime.trim()) {
        try {
          const localDt = new Date(`${reminderDate.trim()}T${reminderTime.trim()}`);
          if (!isNaN(localDt.getTime())) {
            finalReminderTime = localDt.toISOString();
            hasTimeSelected = true;
          } else {
            finalReminderTime = `${reminderDate.trim()}T${reminderTime.trim()}:00`;
            hasTimeSelected = true;
          }
        } catch {
          finalReminderTime = `${reminderDate.trim()}T${reminderTime.trim()}:00`;
          hasTimeSelected = true;
        }
      } else {
        finalReminderTime = `${reminderDate.trim()}T00:00:00.000Z`;
        hasTimeSelected = false;
      }
    }

    const finalRespId = respId || employees[0]?.id || '';
    const finalVendorId = currentVendorId || '';

    return {
      ...localComm,
      vendor_id: finalVendorId,
      vendor_name: localComm.vendor_name || matchedVendor?.trade_name || matchedVendor?.company_name || vendorSearch.trim(),
      responsible_user_id: finalRespId,
      user_id: finalRespId,
      is_completed: isCompletedStatus,
      task_status: isCompletedStatus ? 'completed' : 'pending',
      reminder_time: finalReminderTime,
      has_time: hasTimeSelected
    };
  };

  const hasCommChanges = (): boolean => {
    if (isNew || !editingComm?.id || !initialSnapshotRef.current) return true;

    const snap = initialSnapshotRef.current;
    if (snap.isNew) return true;

    const currentVendorId = localComm?.vendor_id || matchedVendor?.id || '';
    if (currentVendorId !== snap.vendorId) return true;
    if (vendorSearch.trim() !== snap.vendorSearch.trim()) return true;
    if ((localComm?.type || 'action') !== snap.type) return true;
    if ((localComm?.comment || '').trim() !== snap.comment) return true;
    if (reminderDate.trim() !== snap.reminderDate.trim()) return true;
    if (reminderTime.trim() !== snap.reminderTime.trim()) return true;

    const currentRespId = localComm?.responsible_user_id || localComm?.user_id || '';
    if (currentRespId !== snap.responsibleUserId) return true;

    if (isCompletedStatus !== snap.isCompletedStatus) return true;

    return false;
  };

  const handleSaveLocal = () => {
    const payload = buildPayload();
    if (payload) {
      if (!hasCommChanges()) {
        onClose();
        return;
      }
      onSave(payload);
    }
  };

  const handleSaveAndOrder = () => {
    const payload = buildPayload();
    if (payload) {
      if (!hasCommChanges()) {
        onClose();
        if (onSaveAndOrder) {
          onSaveAndOrder(payload, payload.vendor_id, true);
        }
        return;
      }
      if (onSaveAndOrder) {
        onSaveAndOrder(payload, payload.vendor_id, false);
      } else {
        onSave(payload);
      }
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={isNew ? t('New Communication') : t('Edit Communication')}
      maxWidthClass="max-w-md"
      hideCancel={true}
      leftAction={canAddOrder ? {
        label: t("Add and Order"),
        onClick: handleSaveAndOrder,
        className: "px-4 py-2 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 font-bold rounded-lg text-xs transition cursor-pointer select-none"
      } : undefined}
      onSave={handleSaveLocal}
      saveLabel={isNew ? t('Add Communication') : t('Save Communication')}
      onDelete={!isNew ? onDelete : undefined}
      deleteLabel={t("Delete")}
    >
      <div className="space-y-4">
        {/* Supplier Autocomplete */}
        <div className="relative" ref={wrapperRef}>
          <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.vendor_id ? 'text-red-500' : 'text-gray-400'}`}>
            {t("Supplier")} *
          </span>
          <div
            onClick={() => inputRef.current?.focus()}
            className={`relative flex items-center w-full px-3.5 py-4 md:py-3 text-xs border rounded-xl bg-white transition-all cursor-text ${
              fieldErrors.vendor_id
                ? 'border-red-500 bg-red-50/10 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 text-red-900'
                : 'border-gray-200 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 text-gray-900'
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              placeholder=""
              value={vendorSearch}
              onChange={(e) => {
                const val = e.target.value;
                setVendorSearch(val);
                setShowVendorSuggestions(true);
                if (val === '') {
                  setLocalComm(prev => prev ? { ...prev, vendor_id: '', vendor_name: '' } : null);
                }
                if (fieldErrors.vendor_id) {
                  setFieldErrors(prev => ({ ...prev, vendor_id: '' }));
                }
              }}
              onFocus={() => setShowVendorSuggestions(true)}
              className="w-full bg-transparent border-none outline-none focus:outline-none p-0 text-xs font-sans text-gray-900 flex-1 min-w-[80px]"
            />

            {selectedAddress && (
              <span
                className="text-gray-400 font-normal text-xs select-none pointer-events-none truncate max-w-[220px] shrink-0 ml-1.5 transition-opacity duration-150"
                title={selectedAddress}
              >
                ({selectedAddress})
              </span>
            )}

            <div className="flex items-center pl-2 pointer-events-none text-gray-400 shrink-0">
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : (
                <Search className="w-3.5 h-3.5 text-gray-300" />
              )}
            </div>
          </div>

          {fieldErrors.vendor_id && (
            <p className="text-[10px] text-red-500 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
              {fieldErrors.vendor_id}
            </p>
          )}

          {showVendorSuggestions && (
            <div className="absolute left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-30 divide-y divide-gray-50 animate-in fade-in zoom-in-95 duration-100">
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectVendor(s)}
                    className="px-3.5 py-2.5 hover:bg-emerald-50/40 cursor-pointer text-left transition duration-100 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-800 group-hover:text-emerald-750 transition-colors">
                        {s.trade_name || s.company_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                      {s.company_name && s.company_name !== s.trade_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                          {s.company_name}
                        </span>
                      )}
                      {s.address && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <MapPin className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                          {s.address}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-4 text-xs text-gray-400 text-center flex flex-col items-center justify-center gap-1">
                  {isSearching ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t("Searching...")}
                    </span>
                  ) : (
                    <span>
                      {t("No suppliers found matching")} "{vendorSearch}"
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormSelect
            label={t("Interaction Type")}
            value={localComm.type}
            onChange={(e) => {
              const nextType = e.target.value as any;
              setLocalComm({
                ...localComm,
                type: nextType
              });
            }}
          >
            <option value="action">{t("Action")}</option>
            <option value="reminder">{t("Reminder")}</option>
            <option value="task">{t("Task")}</option>
          </FormSelect>

          <FormSelect
            label={t("Task Status *")}
            value={isCompletedStatus ? 'completed' : 'active'}
            onChange={(e) => setIsCompletedStatus(e.target.value === 'completed')}
          >
            <option value="active">{t("Active")}</option>
            <option value="completed">{t("Completed")}</option>
          </FormSelect>
        </div>

        {/* Reminder Date and Time split into two separate native fields */}
        {localComm.type === 'reminder' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
            <FormInput
              label={`${t("Date")} *`}
              type="date"
              fontClass="font-mono"
              value={reminderDate}
              onChange={(e) => {
                setReminderDate(e.target.value);
                if (fieldErrors.reminder_date) {
                  setFieldErrors(prev => ({ ...prev, reminder_date: '' }));
                }
              }}
              error={fieldErrors.reminder_date}
              required
            />
            <FormInput
              label={t("Time")}
              type="time"
              fontClass="font-mono"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            >
              {reminderTime && (
                <button
                  type="button"
                  id="clear-comm-reminder-time-btn"
                  onClick={() => setReminderTime('')}
                  title={t("Clear time")}
                  aria-label={t("Clear time")}
                  className="absolute right-11 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-lg transition-colors z-10 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </FormInput>
          </div>
        )}

        <FormSelect
          label={t("Responsible User *")}
          value={localComm.responsible_user_id || localComm.user_id || ''}
          error={fieldErrors.responsible_user_id}
          onChange={(e) => {
            setLocalComm({
              ...localComm,
              responsible_user_id: e.target.value,
              user_id: e.target.value
            });
            if (fieldErrors.responsible_user_id) {
              setFieldErrors(prev => ({ ...prev, responsible_user_id: '' }));
            }
          }}
        >
          {employees.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </FormSelect>

        <div className="relative">
          <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left text-gray-400">
            {t("Comment")}
          </span>
          <textarea 
            rows={4}
            placeholder=""
            value={localComm.comment}
            onChange={(e) => setLocalComm({...localComm, comment: e.target.value})}
            className="block w-full px-3.5 py-4 md:py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900 font-sans transition-all"
          />
        </div>
      </div>
    </FormModal>
  );
}
