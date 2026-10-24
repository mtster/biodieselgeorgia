import React, { useState, useEffect } from 'react';
import { t } from '../../utils/lang';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District, Communication, Direction 
} from '../../types';
import { saveUser } from '../../services/userService';
import { saveSupplierAccount } from '../../services/supplierAccountService';
import { getVendorContacts, generateUuid, sortVendorContacts, computeNextFreeCompanyCode, checkCompanyCodeDuplicate } from '../../services/vendorService';
import { saveCommunication } from '../../services/communicationService';

function getCleanUsername(u: string | undefined): string {
  if (!u) return '';
  const trimmed = u.trim();
  if (trimmed.endsWith('@biodiesel.ge')) {
    return trimmed.substring(0, trimmed.length - '@biodiesel.ge'.length);
  }
  return trimmed;
}

function getEmailFromUsername(u: string): string {
  const trimmed = u.trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) {
    return trimmed;
  }
  return `${trimmed}@biodiesel.ge`;
}

import VendorFormFields from './VendorFormFields';
import VendorContactsSection from './VendorContactsSection';
import VendorCommentsSection from './VendorCommentsSection';
import VendorContactModal from './VendorContactModal';
import ErrorModal from '../ErrorModal';
import VendorCommentModal from './VendorCommentModal';
import VendorCommunicationModal from './VendorCommunicationModal';
import VendorCommunicationsSection from './VendorCommunicationsSection';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import FormModal from '../FormModal';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { FormInput, FormSelect } from '../FormInput';
import { useVendorValidation } from './form/useVendorValidation';
import { VendorAccountSection } from './form/VendorAccountSection';

import { MessageSquare, X, Trash2, Edit3 } from 'lucide-react';

interface Props {
  editingVendor: Vendor;
  setEditingVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
  existingVendors?: Vendor[];
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  directions: Direction[];
  currentUser: User;
  onSave: (vendor: Vendor) => Promise<any> | void;
  onCancel: () => void;
  formRef?: React.RefObject<{ save: (onSuccess?: (savedVendorId: string) => void) => void; fillDummy: () => void; saveAndOrder?: (onSuccess?: (savedVendorId: string) => void) => void }>;
  isReadOnly?: boolean;
  isNew?: boolean;

  communications?: Communication[];
  onSaveCommunication?: (comm: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
  onSavingStateChange?: (isSaving: boolean) => void;
}

export default function VendorForm({
  editingVendor,
  setEditingVendor,
  existingVendors = [],
  warehouses,
  users,
  cities,
  districts,
  directions,
  currentUser,
  onSave,
  onCancel,
  formRef,
  isReadOnly = false,
  isNew: isNewProp,
  communications = [],
  onSaveCommunication,
  onDeleteCommunication,
  onSavingStateChange
}: Props) {
  const isNew = isNewProp !== undefined ? isNewProp : !editingVendor.id;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; errorMsg: string }>({
    isOpen: false,
    title: '',
    errorMsg: ''
  });
  const [usernameInput, setUsernameInput] = useState(() => getCleanUsername(editingVendor.username));
  const [passwordInput, setPasswordInput] = useState('');
  const [tempContacts, setTempContacts] = useState<VendorContact[]>([]);
  const [tempCommunications, setTempCommunications] = useState<Communication[]>([]);

  const {
    initialSnapshotRef,
    updateSnapshot,
    hasVendorChanges,
    validateVendorForm
  } = useVendorValidation(editingVendor, tempContacts, usernameInput, passwordInput, isNew, tempCommunications);

  useEffect(() => {
    setUsernameInput(getCleanUsername(editingVendor.username));
    setPasswordInput('');
    const defaultHours = editingVendor.working_hours || '10:00 - 19:00';
    if (!editingVendor.working_hours) {
      setEditingVendor(prev => prev ? { ...prev, working_hours: defaultHours } : null);
    }
    updateSnapshot(editingVendor);
  }, [editingVendor.id, editingVendor.username, updateSnapshot]);

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<VendorContact | null>(null);

  // Comment helper states
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [activeComment, setActiveComment] = useState<VendorComment | null>(null);
  const [commentDeleteId, setCommentDeleteId] = useState<string | null>(null);

  // Communication modal open state
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [isCommDeleteModalOpen, setIsCommDeleteModalOpen] = useState(false);
  const [activeComm, setActiveComm] = useState<Communication | null>(null);

  // Initialize contacts list
  useEffect(() => {
    let isMounted = true;
    if (editingVendor.contacts && editingVendor.contacts.length > 0) {
      setTempContacts(sortVendorContacts(editingVendor.contacts));
    } else {
      setTempContacts([]);
    }

    if (editingVendor.id) {
      getVendorContacts(editingVendor.id).then(contacts => {
        if (isMounted && contacts) {
          const sorted = sortVendorContacts(contacts);
          setTempContacts(sorted);
          initialSnapshotRef.current.contacts = JSON.parse(JSON.stringify(sorted));
          if (!editingVendor.contacts || editingVendor.contacts.length !== sorted.length) {
            setEditingVendor(prev => prev ? { ...prev, contacts: sorted } : prev);
          }
        }
      }).catch(err => {
        console.warn('Failed to load contacts for vendor:', err);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [editingVendor.id]);

  useEffect(() => {
    if (tempContacts.length > 0 && fieldErrors.contacts) {
      setFieldErrors(prev => {
        const copy = { ...prev };
        delete copy.contacts;
        return copy;
      });
    }
  }, [tempContacts]);

  React.useImperativeHandle(formRef, () => ({
    save: (onSuccess?: (savedVendorId: string) => void) => handleSaveAll(onSuccess),
    fillDummy: fillDummyData,
    saveAndOrder: (onSuccess?: (savedVendorId: string) => void) => {
      if (!isNew && editingVendor.id && !hasVendorChanges()) {
        onSuccess?.(editingVendor.id);
        return;
      }
      handleSaveAll(onSuccess);
    }
  }));

  // Contacts Actions
  const openContactModal = (contact?: VendorContact) => {
    setActiveContact(contact || null);
    setIsContactModalOpen(true);
  };

  const handleSaveContact = (contactData: Partial<VendorContact>) => {
    let updated: VendorContact[];
    if (activeContact) {
      updated = tempContacts.map(c => c.id === activeContact.id ? { ...c, ...contactData } : c);
    } else {
      const isFirst = tempContacts.length === 0;
      const newContact: VendorContact = {
        id: 'cont-' + Math.random().toString(36).substring(2, 9),
        name: contactData.name || '',
        phone: contactData.phone || '',
        position: contactData.position as any,
        note: contactData.note,
        email: contactData.email,
        is_active: contactData.is_active !== undefined ? contactData.is_active : true,
        is_default: isFirst
      };
      updated = [...tempContacts, newContact];
    }
    const sorted = sortVendorContacts(updated);
    const reordered = sorted.map((c, idx) => ({
      ...c,
      sort_order: sorted.length - idx
    }));
    setTempContacts(reordered);
    setIsContactModalOpen(false);
  };

  const handleRemoveContact = (id: string) => {
    let updated = tempContacts.filter(c => c.id !== id);
    // If we removed the primary contact, make the first one primary
    if (updated.length > 0 && !updated.some(c => c.is_default === true || (c.is_default as any) === 'true')) {
      updated[0].is_default = true;
    }
    const sorted = sortVendorContacts(updated);
    const reordered = sorted.map((c, idx) => ({
      ...c,
      sort_order: sorted.length - idx
    }));
    setTempContacts(reordered);
    setIsContactModalOpen(false);
  };

  // Comments Actions
  const openCommentModal = (comment?: VendorComment) => {
    setActiveComment(comment || null);
    setIsCommentModalOpen(true);
  };

  const handleSaveComment = (text: string) => {
    if (activeComment) {
      const updatedComments = (editingVendor.comments || []).map(c => 
        c.id === activeComment.id ? { ...c, comment: text } : c
      );
      setEditingVendor(prev => prev ? { ...prev, comments: updatedComments } : null);
    } else {
      const newComment: VendorComment = {
        id: 'comm-' + Math.random().toString(36).substring(2, 9),
        comment: text,
        date: new Date().toISOString(),
        user_id: currentUser.id
      };
      setEditingVendor(prev => prev ? {
        ...prev,
        comments: [newComment, ...(prev.comments || [])]
      } : null);
    }
    setIsCommentModalOpen(false);
  };

  const handleRemoveComment = (id: string) => {
    setEditingVendor(prev => prev ? {
      ...prev,
      comments: (prev.comments || []).filter(c => c.id !== id)
    } : null);
    setCommentDeleteId(null);
  };

  const updateMainContact = (field: 'name' | 'phone', value: string) => {
    const defaultContact = tempContacts.find(c => c.is_default);
    if (defaultContact) {
      setTempContacts(tempContacts.map(c => c.is_default ? { ...c, [field]: value } : c));
    } else if (tempContacts.length > 0) {
      setTempContacts(tempContacts.map((c, idx) => idx === 0 ? { ...c, is_default: true, [field]: value } : c));
    } else {
      const newContact: VendorContact = {
        id: 'main-cont-' + Math.random().toString(36).substring(2, 9),
        name: field === 'name' ? value : '',
        phone: field === 'phone' ? value : '',
        position: 'director',
        is_default: true
      };
      setTempContacts([newContact]);
    }
  };

  const handleSaveAll = async (onSuccessCallback?: (savedVendorId: string) => void) => {
    // 1. If this is an existing supplier and no user changes were made, immediately transition or close
    if (!isNew && editingVendor.id && !hasVendorChanges()) {
      onSavingStateChange?.(false);
      if (onSuccessCallback) {
        // Direct transition on "Save and Order" without network delay
        onSuccessCallback(editingVendor.id);
      } else {
        // Direct close on "Save"
        onCancel();
      }
      return;
    }

    const isOperator = currentUser?.role === 'operator';
    let needsUserCreationOrUpdate = false;
    if (!isOperator) {
      const valRes = validateVendorForm();
      const codeInput = (editingVendor.company_code || '').trim();

      // Check if there are missing/invalid mandatory fields OTHER than company_code
      const otherErrors: Record<string, string> = {};
      for (const [key, msg] of Object.entries(valRes.errs)) {
        if (key !== 'company_code') {
          otherErrors[key] = msg;
        }
      }

      // Gatekeeping: If ANY other mandatory field is not filled in, stop immediately
      // Do NOT trigger any company_code network queries or next code calculations!
      if (Object.keys(otherErrors).length > 0) {
        if (!codeInput) {
          otherErrors.company_code = 'კოდი სავალდებულო და უნიკალურია.';
        }
        setFieldErrors(otherErrors);
        return;
      }

      // ONLY when all other mandatory fields are completely filled in:
      // If company_code is missing, compute next free code from memory/cache
      if (!codeInput) {
        const nextCode = await computeNextFreeCompanyCode(editingVendor.id, existingVendors);
        setFieldErrors({
          company_code: `კოდი სავალდებულო და უნიკალურია. შემდეგი თავისუფალი კოდი: ${nextCode}`
        });
        return;
      }

      // Check for duplicate company_code (in-memory first, fast indexed Supabase query if needed)
      const isDuplicate = await checkCompanyCodeDuplicate(codeInput, editingVendor.id, existingVendors);
      if (isDuplicate) {
        const nextCode = await computeNextFreeCompanyCode(editingVendor.id, existingVendors);
        setFieldErrors({
          company_code: `აღნიშნული კოდი უკვე დაკავებულია. შემდეგი თავისუფალი კოდი: ${nextCode}`
        });
        return;
      }

      needsUserCreationOrUpdate = valRes.needsUserCreationOrUpdate;
    }
    setFieldErrors({});

    // If no changes were made to an existing supplier, do NOT send unnecessary DB update request
    if (!hasVendorChanges()) {
      onSavingStateChange?.(false);
      if (onSuccessCallback) {
        onSuccessCallback(editingVendor.id);
      } else {
        onCancel();
      }
      return;
    }

    const executeSave = async () => {
      onSavingStateChange?.(true);
      let finalUserId = editingVendor.user_id || '';
      let finalUsername = editingVendor.username || '';

      if (needsUserCreationOrUpdate) {
        try {
          const pregeneratedVendorId = editingVendor.id || generateUuid();
          const accountResult = await saveSupplierAccount({
            vendorId: pregeneratedVendorId,
            username: usernameInput.trim(),
            password: passwordInput.trim() || undefined,
            authUserId: editingVendor.user_id || undefined,
            tradeName: (editingVendor.trade_name || '').trim(),
            companyName: (editingVendor.company_name || '').trim()
          });

          finalUserId = accountResult.userId;
          finalUsername = accountResult.username;
          editingVendor.id = pregeneratedVendorId;
        } catch (e: any) {
          onSavingStateChange?.(false);
          console.error('Error creating/updating supplier account:', e);
          setErrorModal({
            isOpen: true,
            title: 'მომხმარებლის ანგარიშის შექმნა/განახლება ვერ მოხერხდა',
            errorMsg: e.message || 'უცნობი შეცდომა'
          });
          return;
        }
      } else if (!usernameInput.trim() && !passwordInput.trim()) {
        // If cleared, unlink the account
        finalUserId = '';
        finalUsername = '';
      }

      const resolvedVendorId = editingVendor.id ? editingVendor.id : (isNew ? '' : generateUuid());
      if (editingVendor.id) {
        editingVendor.id = resolvedVendorId;
      }

      // Strip leading and trailing spaces from all string fields in editingVendor
      const trimmedVendor: any = { ...editingVendor };
      for (const [key, val] of Object.entries(trimmedVendor)) {
        if (typeof val === 'string') {
          trimmedVendor[key] = val.trim();
        }
      }

      const cleanCode = (trimmedVendor.company_code || '').trim();
      const rawContacts = tempContacts.length > 0 ? tempContacts : (editingVendor.contacts || []);
      const trimmedContacts = rawContacts.map(c => ({
        ...c,
        name: typeof c.name === 'string' ? c.name.trim() : (c.name || ''),
        phone: typeof c.phone === 'string' ? c.phone.trim() : (c.phone || ''),
        email: typeof c.email === 'string' ? c.email.trim() : (c.email || ''),
        note: typeof c.note === 'string' ? c.note.trim() : (c.note || '')
      }));

      let payload: Vendor = {
        ...trimmedVendor,
        id: resolvedVendorId,
        company_code: cleanCode,
        contacts: trimmedContacts,
        user_id: finalUserId || undefined,
        username: finalUsername || undefined
      };

      if (isOperator && (initialSnapshotRef.current?.vendor?.id || editingVendor.id)) {
        // Enforce that operator payload strictly preserves all core vendor parameters from initial snapshot
        const init = initialSnapshotRef.current?.vendor || editingVendor;
        payload = {
          ...init,
          id: resolvedVendorId,
          comments: editingVendor.comments || [],
          contacts: trimmedContacts.length > 0 ? trimmedContacts : (init.contacts || [])
        };
      }

      try {
        const savedRes = await onSave(payload);
        if (savedRes === null) {
          onSavingStateChange?.(false);
          return;
        }
        const finalSavedId = (savedRes && (savedRes as any).id) || payload.id || resolvedVendorId;

        // Persist any buffered communications created during new supplier creation with the valid saved vendor ID
        if (tempCommunications.length > 0 && finalSavedId) {
          for (const comm of tempCommunications) {
            try {
              await saveCommunication({
                ...comm,
                id: comm.id && !comm.id.startsWith('temp-comm-') ? comm.id : generateUuid(),
                vendor_id: finalSavedId,
                vendor_name: payload.trade_name || payload.company_name || ''
              }, currentUser.name || 'System', currentUser.id);
            } catch (commErr) {
              console.error('Failed to save communication for new supplier:', commErr);
            }
          }
        }

        onSavingStateChange?.(false);
        if (onSuccessCallback) {
          onSuccessCallback(finalSavedId);
        } else {
          // On success, close the form in the UI
          onCancel();
        }
      } catch (e: any) {
        onSavingStateChange?.(false);
        console.error('Error saving supplier:', e);
        setErrorModal({
          isOpen: true,
          title: 'მომწოდებლის შენახვის შეცდომა',
          errorMsg: e.message || 'შეამოწმეთ კავშირი ან უფლებები.'
        });
      }
    };

    executeSave();
  };

  const fillDummyData = () => {
    const generateGeorgianIban = () => {
      const banks = ['TB', 'BG', 'LB', 'NV', 'BC'];
      const randomBank = banks[Math.floor(Math.random() * banks.length)] + '77';
      const digits = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
      const check = String(Math.floor(10 + Math.random() * 89));
      return `GE${check}${randomBank}${digits}`;
    };

    const tradeNames = ['GlowFuel Co', 'ECO-Diesel Georgia', 'Green Refine Ltd', 'Batumi Bio Refinery', 'Kutaisi Recyclers', 'Tbilisi Bio-Oil', 'Caucasus Green Fuels', 'Svaneti Pure Energy'];
    const companyNames = ['Biodiesel Processing LLC', 'Eco Logistics Joint Venture', 'Green Oil Corporation', 'Black Sea Bio Refineries Ltd', 'Imeri Recycling Systems LLC', 'Georgian Bioenergy Group JSC'];
    const streets = ['Rustaveli Ave 45', 'Chavchavadze Ave 12', 'Agmashenebeli Alley km 12', 'Melikishvili St 88', 'Parnavaz St 14', 'Gorgasali St 33'];
    const hours = ['10:00 - 19:00', '10:00 - 19:00', '10:00 - 19:00'];
    const contactNames = ['Giorgi Meladze', 'Nino Abashidze', 'Lasha Kapanadze', 'Mariam Tsereteli', 'Irakli Khizanishvili', 'Ana Shengelia'];
    const commentsTexts = ['Established connection with director', 'Good logistics access. Prompt replies.', 'Agreed on 1.45 base rate fallback.', 'Requested additional tankers for pickup.', 'High quality ester biodiesel provided.'];

    const chosenTrade = tradeNames[Math.floor(Math.random() * tradeNames.length)] + ' ' + Math.floor(10 + Math.random() * 90);
    const chosenCompany = companyNames[Math.floor(Math.random() * companyNames.length)] + ' ' + Math.floor(10 + Math.random() * 90);
    const chosenStreet = streets[Math.floor(Math.random() * streets.length)] + ', ' + Math.floor(1 + Math.random() * 150);
    const chosenHours = hours[Math.floor(Math.random() * hours.length)];

    const randomCityObj = cities.length > 0 ? cities[Math.floor(Math.random() * cities.length)] : null;
    const randomCity = randomCityObj ? randomCityObj.id : (cities[0]?.id || '');
    
    const matchingDistricts = districts.filter(d => !randomCityObj || d.city_id === randomCityObj.id);
    const randomDistrict = matchingDistricts.length > 0 
      ? matchingDistricts[Math.floor(Math.random() * matchingDistricts.length)].id 
      : (districts[0]?.id || '');

    const randomWarehouse = warehouses.length > 0 
      ? warehouses[Math.floor(Math.random() * warehouses.length)].id 
      : '';

    const possibleManagers = users.filter(u => u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin');
    const randomManager = possibleManagers.length > 0 
      ? possibleManagers[Math.floor(Math.random() * possibleManagers.length)].id 
      : (users[0]?.id || 'user-admin');

    const randomOperator = users.length > 0 
      ? users[Math.floor(Math.random() * users.length)].id 
      : 'user-admin';

    const cleanIdCode = String(Math.floor(100000000 + Math.random() * 900000000));
    const phonePref = ['599', '595', '577', '555', '591'];
    const cleanPhone = phonePref[Math.floor(Math.random() * phonePref.length)] + String(Math.floor(100000 + Math.random() * 900000));

    setEditingVendor({
      ...editingVendor,
      trade_name: chosenTrade,
      company_name: chosenCompany,
      id_code: cleanIdCode,
      company_code: cleanIdCode,
      bank_account: generateGeorgianIban(),
      city: randomCity,
      district: randomDistrict,
      address: chosenStreet,
      price_per_liter: parseFloat((1.10 + Math.random() * 0.80).toFixed(2)),
      warehouse_id: randomWarehouse,
      manager_id: randomManager,
      operator_id: randomOperator,
      working_hours: chosenHours,
      comments: [{
        id: 'comm-' + Math.random().toString(36).substring(2, 9),
        comment: commentsTexts[Math.floor(Math.random() * commentsTexts.length)],
        date: new Date().toISOString(),
        user_id: currentUser.id
      }]
    });

    setTempContacts([
      {
        id: 'dummy-contact-1',
        name: contactNames[Math.floor(Math.random() * contactNames.length)],
        phone: cleanPhone,
        position: 'director',
        is_default: true
      },
      {
        id: 'dummy-contact-2',
        name: contactNames[(Math.floor(Math.random() * contactNames.length) + 1) % contactNames.length],
        phone: '599' + String(Math.floor(100000 + Math.random() * 900000)),
        position: 'accountant',
        is_default: false
      }
    ]);
  };

  const isOperator = currentUser?.role === 'operator';

  return (
    <div className="animate-in fade-in duration-200 max-w-4xl" id="vendors-form-panel">
      <fieldset disabled={isReadOnly} className="contents disabled:opacity-95">
        <div className="space-y-6 pt-2 text-left">
          <div 
            className={`space-y-5 ${isOperator ? "pointer-events-none select-none" : ""}`}
            onFocusCapture={(e) => {
              if (isOperator) {
                (e.target as HTMLElement).blur?.();
              }
            }}
            onKeyDownCapture={(e) => {
              if (isOperator) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            aria-readonly={isOperator ? true : undefined}
          >
            <VendorFormFields
              editingVendor={editingVendor}
              setEditingVendor={setEditingVendor}
              fieldErrors={fieldErrors}
              setFieldErrors={setFieldErrors}
              warehouses={warehouses}
              users={users}
              cities={cities}
              districts={districts}
              directions={directions}
              currentUser={currentUser}
            />

            {/* Supplier Login Account Fields */}
            <VendorAccountSection
              usernameInput={usernameInput}
              setUsernameInput={setUsernameInput}
              passwordInput={passwordInput}
              setPasswordInput={setPasswordInput}
              usernameError={fieldErrors.username}
              passwordError={fieldErrors.password}
              onClearErrors={(field) => setFieldErrors(prev => ({ ...prev, [field]: '' }))}
            />
          </div>

          {/* Contacts & Comments Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-0">
            <VendorContactsSection
              contacts={tempContacts}
              onAddContact={() => openContactModal()}
              onModifyContact={(c) => openContactModal(c)}
              onTogglePrimaryContact={(id) => {
                const updated = tempContacts.map(c => ({
                  ...c,
                  is_default: c.id === id
                }));
                // Reorder: sort with primary contact first
                const sorted = sortVendorContacts(updated);
                // Update sort_orders based on index
                const reordered = sorted.map((c, idx) => ({
                  ...c,
                  sort_order: sorted.length - idx
                }));
                setTempContacts(reordered);
              }}
              onReorderContacts={(startIndex, endIndex) => {
                const updated = [...tempContacts];
                const [removed] = updated.splice(startIndex, 1);
                updated.splice(endIndex, 0, removed);
                
                // The default/primary contact must always remain at index 0 (top)
                const defaultIdx = updated.findIndex(c => c.is_default === true || (c.is_default as any) === 'true');
                if (defaultIdx > 0) {
                  const [defaultContact] = updated.splice(defaultIdx, 1);
                  updated.unshift(defaultContact);
                }
                
                // Re-assign sort_orders based on position in array
                const reordered = updated.map((c, idx) => ({
                  ...c,
                  sort_order: updated.length - idx
                }));
                setTempContacts(reordered);
              }}
              error={fieldErrors.contacts}
            />

            <VendorCommentsSection
              comments={editingVendor.comments || []}
              onAddComment={() => openCommentModal()}
              onModifyComment={(c) => openCommentModal(c)}
              onRemoveComment={(id) => setCommentDeleteId(id)}
              users={users}
            />
          </div>

          <VendorCommunicationsSection
            communications={tempCommunications}
            editingVendor={editingVendor}
            currentUser={currentUser}
            users={users}
            isReadOnly={isReadOnly}
            onAddComm={() => {
              setActiveComm(null);
              setIsCommModalOpen(true);
            }}
            onEditComm={(comm) => {
              setActiveComm(comm);
              setIsCommModalOpen(true);
            }}
            onTriggerDeleteComm={(comm) => {
              setActiveComm(comm);
              setIsCommDeleteModalOpen(true);
            }}
            onSaveCommunication={onSaveCommunication}
            onDeleteCommunication={onDeleteCommunication}
          />
        </div>
      </fieldset>

      <ConfirmDeleteModal
        isOpen={!!commentDeleteId}
        onClose={() => setCommentDeleteId(null)}
        onConfirm={() => commentDeleteId && handleRemoveComment(commentDeleteId)}
        title={t("Discard Comment")}
        message={
          <span>
            {t("Are you sure you want to delete comment")}{' '}
            <strong>"{((editingVendor.comments || []).find(c => c.id === commentDeleteId)?.comment || '')}"</strong>{' '}
            {t("deletion text ending")}
          </span>
        }
      />

      <ConfirmDeleteModal
        isOpen={isCommDeleteModalOpen}
        onClose={() => setIsCommDeleteModalOpen(false)}
        onConfirm={() => {
          if (activeComm) {
            setTempCommunications(prev => prev.filter(c => c.id !== activeComm.id));
            if (activeComm.id && !activeComm.id.startsWith('temp-comm-') && onDeleteCommunication) {
              onDeleteCommunication(activeComm.id);
            }
          }
          setIsCommDeleteModalOpen(false);
          setActiveComm(null);
        }}
        title={t("Delete Communication?")}
        message={t("Are you sure you want to delete this communication record?")}
      />

      <VendorContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        activeContact={activeContact}
        onSave={handleSaveContact}
        onDelete={handleRemoveContact}
      />

      <VendorCommentModal
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        activeComment={activeComment}
        onSave={handleSaveComment}
        onDelete={handleRemoveComment}
      />

      <VendorCommunicationModal
        isOpen={isCommModalOpen}
        onClose={() => setIsCommModalOpen(false)}
        activeComm={activeComm}
        currentUser={currentUser}
        users={users}
        tempContacts={tempContacts}
        editingVendor={editingVendor}
        onSaveCommunication={(payload) => {
          const commId = payload.id || 'temp-comm-' + Math.random().toString(36).substring(2, 9);
          const formattedPayload: Communication = {
            ...payload,
            id: commId,
            vendor_id: editingVendor.id || '',
            vendor_name: editingVendor.trade_name || editingVendor.company_name || ''
          };
          setTempCommunications(prev => {
            const idx = prev.findIndex(c => c.id === commId);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = formattedPayload;
              return copy;
            }
            return [formattedPayload, ...prev];
          });
          setIsCommModalOpen(false);
          setActiveComm(null);
        }}
        onDeleteCommunication={onDeleteCommunication ? (id) => {
          setIsCommModalOpen(false);
          setIsCommDeleteModalOpen(true);
        } : undefined}
      />

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
        title={errorModal.title}
        errorMsg={errorModal.errorMsg}
      />
    </div>
  );
}
