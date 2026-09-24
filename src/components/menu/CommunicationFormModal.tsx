import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Communication, User, Vendor, VendorContact } from '../../types';
import FormModal from '../FormModal';
import { FormInput, FormSelect } from '../FormInput';
import { t } from '../../utils/lang';
import { useDebounce } from '../../hooks/useDebounce';
import { getVendorsPaginated, getVendorById, getVendorContacts, saveVendorContacts, generateUuid } from '../../services/vendorService';
import { saveCommunication, deleteCommunication } from '../../services/communicationService';
import VendorContactsSection from '../vendors/VendorContactsSection';
import VendorContactModal from '../vendors/VendorContactModal';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import OrderCommunicationsSection from '../orders/OrderCommunicationsSection';
import { Loader2, Search, Building2, MapPin, X } from 'lucide-react';

interface CommunicationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingComm: Communication | null;
  isNew: boolean;
  employees: User[];
  suppliers: Vendor[];
  currentUser?: User;
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
  currentUser,
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
    const term = vendorSearch.trim().toLowerCase();
    if (localComm?.vendor_id) {
      const cleanLId = String(localComm.vendor_id).trim().toLowerCase();
      const v = suppliers.find((s) => s.id === localComm.vendor_id || (s.id && String(s.id).trim().toLowerCase() === cleanLId)) || 
                remoteSuppliers.find((s) => s.id === localComm.vendor_id || (s.id && String(s.id).trim().toLowerCase() === cleanLId));
      if (v) return v;
    }
    if (!term) return null;
    return suppliers.find((s) => {
      const trade = (s.trade_name || '').trim().toLowerCase();
      const comp = (s.company_name || '').trim().toLowerCase();
      return trade === term || comp === term;
    }) || remoteSuppliers.find((s) => {
      const trade = (s.trade_name || '').trim().toLowerCase();
      const comp = (s.company_name || '').trim().toLowerCase();
      return trade === term || comp === term;
    }) || null;
  }, [suppliers, remoteSuppliers, vendorSearch, localComm?.vendor_id]);

  const selectedAddress = matchedVendor?.address || '';
  const currentVendorId = localComm?.vendor_id || matchedVendor?.id || '';

  // Contacts state & modal
  const [contacts, setContacts] = useState<VendorContact[]>([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<VendorContact | null>(null);
  const [isDeleteContactOpen, setIsDeleteContactOpen] = useState(false);
  const [contactToDeleteId, setContactToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!currentVendorId) {
      setContacts([]);
      return;
    }

    if (matchedVendor?.contacts && matchedVendor.contacts.length > 0) {
      setContacts(matchedVendor.contacts);
    }

    getVendorContacts(currentVendorId)
      .then(res => {
        if (isMounted && res) {
          setContacts(res);
        }
      })
      .catch(err => {
        console.warn('Failed to load contacts for communication modal:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [currentVendorId, matchedVendor?.contacts]);

  const handleAddContact = () => {
    if (!currentVendorId) {
      setFieldErrors(prev => ({ ...prev, vendor_id: t("Supplier is required") }));
      return;
    }
    setActiveContact(null);
    setIsContactModalOpen(true);
  };

  const handleModifyContact = (c: VendorContact) => {
    setActiveContact(c);
    setIsContactModalOpen(true);
  };

  const handleTogglePrimaryContact = (id: string) => {
    const updated = contacts.map(c => ({
      ...c,
      is_default: c.id === id
    }));
    updated.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
    setContacts(updated);
    if (currentVendorId) {
      saveVendorContacts(currentVendorId, updated, currentUser?.id || employees[0]?.id).catch(err => console.error(err));
    }
  };

  const handleReorderContacts = (startIndex: number, endIndex: number) => {
    const reordered = [...contacts];
    const [removed] = reordered.splice(startIndex, 1);
    reordered.splice(endIndex, 0, removed);
    const updated = reordered.map((c, idx) => ({ ...c, sort_order: idx + 1 }));
    setContacts(updated);
    if (currentVendorId) {
      saveVendorContacts(currentVendorId, updated, currentUser?.id || employees[0]?.id).catch(err => console.error(err));
    }
  };

  const handleSaveContact = async (contactData: Partial<VendorContact>) => {
    if (!currentVendorId) return;
    let updatedList: VendorContact[];
    if (activeContact) {
      updatedList = contacts.map(c => c.id === activeContact.id ? { ...c, ...contactData } as VendorContact : c);
    } else {
      const newContact: VendorContact = {
        id: generateUuid(),
        vendor_id: currentVendorId,
        name: contactData.name || '',
        phone: contactData.phone || '',
        position: contactData.position || 'director',
        note: contactData.note || '',
        email: contactData.email || '',
        is_default: contacts.length === 0,
        is_active: contactData.is_active !== false,
        sort_order: contacts.length + 1
      };
      updatedList = [...contacts, newContact];
    }
    setContacts(updatedList);
    try {
      await saveVendorContacts(currentVendorId, updatedList, currentUser?.id || employees[0]?.id);
    } catch (err) {
      console.error('Failed to save vendor contact:', err);
    }
    setIsContactModalOpen(false);
    setActiveContact(null);
  };

  const handleDeleteContact = (id: string) => {
    setContactToDeleteId(id);
    setIsContactModalOpen(false);
    setIsDeleteContactOpen(true);
  };

  const handleConfirmDeleteContact = async () => {
    if (!contactToDeleteId || !currentVendorId) return;
    const updatedList = contacts.filter(c => c.id !== contactToDeleteId);
    setContacts(updatedList);
    try {
      await saveVendorContacts(currentVendorId, updatedList, currentUser?.id || employees[0]?.id);
    } catch (err) {
      console.error('Failed to delete vendor contact:', err);
    }
    setIsDeleteContactOpen(false);
    setContactToDeleteId(null);
    setActiveContact(null);
  };

  const handleSaveSubComm = async (comm: Communication) => {
    try {
      await saveCommunication(comm, currentUser?.name || employees[0]?.name || 'System', currentUser?.id);
      if (comm.id === localComm?.id) {
        setLocalComm(comm);
      }
    } catch (err) {
      console.error('Failed to save sub communication:', err);
    }
  };

  const handleDeleteSubComm = async (id: string) => {
    try {
      await deleteCommunication(id, currentUser?.name || employees[0]?.name || 'System');
      if (id === localComm?.id) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to delete sub communication:', err);
    }
  };

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
    getVendorsPaginated(30, 0, { searchTerm: term }, { includeContacts: false })
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
      const vId = editingComm.vendor_id ? String(editingComm.vendor_id).trim() : '';
      const cleanVId = vId.toLowerCase();
      const suppObj = suppliers.find(s => s.id === vId || (s.id && String(s.id).trim().toLowerCase() === cleanVId));
      if (suppObj) {
        initVName = suppObj.trade_name || suppObj.company_name || '';
        setVendorSearch(initVName);
      } else if (editingComm.vendor_name) {
        initVName = editingComm.vendor_name;
        setVendorSearch(initVName);
      } else if (vId) {
        getVendorById(vId).then(v => {
          if (v) {
            const name = v.trade_name || v.company_name || '';
            setVendorSearch(name);
            setLocalComm(prev => prev ? {
              ...prev,
              vendor_id: v.id,
              vendor_name: name
            } : null);
          }
        });
      } else {
        setVendorSearch('');
      }

      // Parse reminder_time into separate Date and Time
      let parsedRDate = '';
      let parsedRTime = '';
      if (editingComm.reminder_time) {
        const raw = editingComm.reminder_time;
        if (editingComm.has_time) {
          const d = new Date(raw);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            parsedRDate = `${y}-${m}-${day}`;
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            parsedRTime = `${h}:${min}`;
          } else {
            const parts = raw.split('T');
            parsedRDate = parts[0];
            parsedRTime = (parts[1] || '').substring(0, 5);
          }
        } else {
          parsedRDate = raw.includes('T') ? raw.split('T')[0] : raw;
          parsedRTime = '';
        }
        setReminderDate(parsedRDate);
        setReminderTime(parsedRTime);
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

    // Validate comment: required for non-reminder types (action, task), optional for reminder
    if (localComm.type !== 'reminder' && !localComm.comment?.trim()) {
      errors.comment = t("Please enter a comment");
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
    const finalVendorName = (matchedVendor?.trade_name || matchedVendor?.company_name) || localComm.vendor_name || vendorSearch.trim() || '';

    return {
      ...localComm,
      vendor_id: finalVendorId,
      vendor_name: finalVendorName,
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
      maxWidthClass="max-w-5xl"
      hideCancel={true}
      secondaryAction={canAddOrder ? {
        label: isNew ? t("Add and Order") : t("Save and Order"),
        onClick: handleSaveAndOrder,
        className: "px-4 py-2 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 font-bold rounded-lg text-xs transition cursor-pointer select-none"
      } : undefined}
      onSave={handleSaveLocal}
      saveLabel={isNew ? t('Add Communication') : t('Save Communication')}
      onDelete={!isNew ? onDelete : undefined}
      deleteLabel={t("Delete")}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Initial Fields (exactly as they are) */}
        <div className="lg:col-span-6 space-y-4">
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
            <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.comment ? 'text-red-500' : 'text-gray-400'}`}>
              {t("Comment")} {localComm.type !== 'reminder' && '*'}
            </span>
            <textarea 
              rows={4}
              placeholder=""
              value={localComm.comment}
              onChange={(e) => {
                setLocalComm({...localComm, comment: e.target.value});
                if (fieldErrors.comment) {
                  setFieldErrors(prev => ({ ...prev, comment: '' }));
                }
              }}
              className={`block w-full px-3.5 py-4 md:py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans transition-all bg-white text-gray-900 ${
                fieldErrors.comment 
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
                  : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600'
              }`}
            />
            {fieldErrors.comment && (
              <p className="text-[10px] text-red-600 mt-1">{fieldErrors.comment}</p>
            )}
          </div>
        </div>

        {/* Right Column: Contacts (top) and Previous Communications (bottom), separated by light vertical line */}
        <div className="lg:col-span-6 lg:border-l lg:border-gray-200/80 lg:pl-6 space-y-4 w-full min-w-0">
          {/* Contacts Section - exact same as in suppliers form */}
          <VendorContactsSection
            contacts={contacts}
            onAddContact={handleAddContact}
            onModifyContact={handleModifyContact}
            onTogglePrimaryContact={handleTogglePrimaryContact}
            onReorderContacts={handleReorderContacts}
          />

          {/* Previous Communications Section - exact same small table as added to orders form */}
          <OrderCommunicationsSection
            vendorId={currentVendorId}
            vendor={matchedVendor}
            users={employees}
            currentUser={currentUser || employees[0]}
            onSaveCommunication={handleSaveSubComm}
            onDeleteCommunication={handleDeleteSubComm}
            title={t("Previous Communications")}
            panelId="comm-modal-previous-comms-panel"
            selectedCommId={localComm?.id}
          />
        </div>
      </div>

      {/* Vendor Contact Add / Edit Modal */}
      <VendorContactModal
        isOpen={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false);
          setActiveContact(null);
        }}
        activeContact={activeContact}
        onSave={handleSaveContact}
        onDelete={handleDeleteContact}
      />

      {/* Delete Contact Confirmation */}
      <ConfirmDeleteModal
        isOpen={isDeleteContactOpen}
        onClose={() => {
          setIsDeleteContactOpen(false);
          setContactToDeleteId(null);
        }}
        onConfirm={handleConfirmDeleteContact}
        title={t("Delete Contact?")}
        message={t("Are you sure you want to delete this contact?")}
      />
    </FormModal>
  );
}
