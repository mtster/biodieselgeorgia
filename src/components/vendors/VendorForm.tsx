import React, { useState, useEffect } from 'react';
import { t } from '../../utils/lang';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District, Communication, Direction 
} from '../../types';
import { saveUser } from '../../services/userService';
import { getVendorContacts } from '../../services/vendorService';

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

import { MessageSquare, X, Trash2, Edit3 } from 'lucide-react';

interface Props {
  editingVendor: Vendor;
  setEditingVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  directions: Direction[];
  currentUser: User;
  onSave: (vendor: Vendor) => Promise<any> | void;
  onCancel: () => void;
  formRef?: React.RefObject<{ save: () => void; fillDummy: () => void; saveAndOrder?: (onSuccess?: (savedVendorId: string) => void) => void }>;
  isReadOnly?: boolean;

  communications?: Communication[];
  onSaveCommunication?: (comm: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
  onSavingStateChange?: (isSaving: boolean) => void;
}

export default function VendorForm({
  editingVendor,
  setEditingVendor,
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
  communications = [],
  onSaveCommunication,
  onDeleteCommunication,
  onSavingStateChange
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; errorMsg: string }>({
    isOpen: false,
    title: '',
    errorMsg: ''
  });
  const [usernameInput, setUsernameInput] = useState(() => getCleanUsername(editingVendor.username));
  const [passwordInput, setPasswordInput] = useState('');

  // Initial snapshot to detect whether any data was modified before saving
  const initialSnapshotRef = React.useRef<{
    vendor: Vendor;
    username: string;
    contacts: VendorContact[];
  }>({
    vendor: JSON.parse(JSON.stringify(editingVendor)),
    username: getCleanUsername(editingVendor.username),
    contacts: editingVendor.contacts ? JSON.parse(JSON.stringify(editingVendor.contacts)) : []
  });

  useEffect(() => {
    setUsernameInput(getCleanUsername(editingVendor.username));
    setPasswordInput('');
    if (!editingVendor.working_hours) {
      setEditingVendor(prev => prev ? { ...prev, working_hours: '10:00 - 19:00' } : null);
    }
    initialSnapshotRef.current = {
      vendor: JSON.parse(JSON.stringify(editingVendor)),
      username: getCleanUsername(editingVendor.username),
      contacts: editingVendor.contacts ? JSON.parse(JSON.stringify(editingVendor.contacts)) : []
    };
  }, [editingVendor.id, editingVendor.username]);

  // Contacts helper states
  const [tempContacts, setTempContacts] = useState<VendorContact[]>([]);
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
      setTempContacts(editingVendor.contacts);
    } else {
      setTempContacts([]);
    }

    if (editingVendor.id) {
      getVendorContacts(editingVendor.id).then(contacts => {
        if (isMounted && contacts && contacts.length > 0) {
          setTempContacts(contacts);
          initialSnapshotRef.current.contacts = JSON.parse(JSON.stringify(contacts));
          setEditingVendor(prev => prev ? { ...prev, contacts } : prev);
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
    save: () => handleSaveAll(),
    fillDummy: fillDummyData,
    saveAndOrder: (onSuccess?: (savedVendorId: string) => void) => handleSaveAll(onSuccess)
  }));

  // Contacts Actions
  const openContactModal = (contact?: VendorContact) => {
    setActiveContact(contact || null);
    setIsContactModalOpen(true);
  };

  const handleSaveContact = (contactData: Partial<VendorContact>) => {
    if (activeContact) {
      setTempContacts(tempContacts.map(c => c.id === activeContact.id ? { ...c, ...contactData } : c));
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
      setTempContacts([...tempContacts, newContact]);
    }
    setIsContactModalOpen(false);
  };

  const handleRemoveContact = (id: string) => {
    let updated = tempContacts.filter(c => c.id !== id);
    // If we removed the primary contact, make the first one primary
    if (updated.length > 0 && !updated.some(c => c.is_default)) {
      updated[0].is_default = true;
    }
    setTempContacts(updated);
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
        user_name: currentUser.name
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

  const hasVendorChanges = (): boolean => {
    // If it's a new vendor without an ID, saving is always required
    if (!editingVendor.id) return true;

    // Check account changes
    if (passwordInput.trim() !== '') return true;
    if (usernameInput.trim() !== initialSnapshotRef.current.username.trim()) return true;

    const initV = initialSnapshotRef.current.vendor;

    // Compare scalar fields
    const fieldsToCompare: (keyof Vendor)[] = [
      'trade_name', 'company_name', 'id_code', 'company_code',
      'city', 'district', 'address', 'warehouse_id', 'direction_id',
      'manager_id', 'operator_id', 'bank_account',
      'working_hours', 'planned_weekday'
    ];

    for (const f of fieldsToCompare) {
      const v1 = (editingVendor[f] ?? '').toString().trim();
      const v2 = (initV[f] ?? '').toString().trim();
      if (v1 !== v2) return true;
    }

    // Compare numeric and boolean values
    if (Number(editingVendor.price_per_liter || 0) !== Number(initV.price_per_liter || 0)) return true;
    if (Number(editingVendor.overdue_threshold_days || 0) !== Number(initV.overdue_threshold_days || 0)) return true;
    if (Boolean(editingVendor.is_active ?? true) !== Boolean(initV.is_active ?? true)) return true;
    if (Boolean(editingVendor.is_planned) !== Boolean(initV.is_planned)) return true;

    // Compare custom fields
    const allKeys = Array.from(new Set([...Object.keys(editingVendor), ...Object.keys(initV)]));
    for (const k of allKeys) {
      if (k.startsWith('custom_')) {
        if ((editingVendor as any)[k] !== (initV as any)[k]) return true;
      }
    }

    // Compare comments
    const initComments = JSON.stringify(initV.comments || []);
    const currComments = JSON.stringify(editingVendor.comments || []);
    if (initComments !== currComments) return true;

    // Compare contacts
    const initContacts = initialSnapshotRef.current.contacts || [];
    if (tempContacts.length !== initContacts.length) return true;

    for (let i = 0; i < tempContacts.length; i++) {
      const tc = tempContacts[i];
      if (tc.id.startsWith('cont-') || tc.id.startsWith('main-cont-')) return true;

      const matchedInit = initContacts.find(c => c.id === tc.id);
      if (!matchedInit) return true;

      if ((tc.name || '').trim() !== (matchedInit.name || '').trim()) return true;
      if ((tc.phone || '').trim() !== (matchedInit.phone || '').trim()) return true;
      if ((tc.position || '').toString() !== (matchedInit.position || '').toString()) return true;
      if ((tc.email || '').trim() !== (matchedInit.email || '').trim()) return true;
      if ((tc.note || '').trim() !== (matchedInit.note || '').trim()) return true;
      if (Boolean(tc.is_active ?? true) !== Boolean(matchedInit.is_active ?? true)) return true;
      if (Boolean(tc.is_default) !== Boolean(matchedInit.is_default)) return true;
    }

    return false;
  };

  const handleSaveAll = async (onSuccessCallback?: (savedVendorId: string) => void) => {
    const errs: Record<string, string> = {};

    if (!editingVendor.trade_name || !editingVendor.trade_name.trim()) {
      errs.trade_name = 'სავაჭრო სახელი სავალდებულოა.';
    }
    if (!editingVendor.city) {
      errs.city = 'ქალაქი სავალდებულოა.';
    }
    if (!editingVendor.district) {
      errs.district = 'რაიონი სავალდებულოა.';
    }
    if (!editingVendor.address || !editingVendor.address.trim()) {
      errs.address = 'ზუსტი მისამართი სავალდებულოა.';
    }
    if (!editingVendor.warehouse_id) {
      errs.warehouse_id = 'მინიჭებული საწყობი სავალდებულოა.';
    }
    if (!editingVendor.direction_id) {
      errs.direction_id = 'მიმართულება სავალდებულოა.';
    }
    if (tempContacts.length === 0) {
      errs.contacts = 'სულ მცირე ერთი კონტაქტი უნდა იყოს დამატებული.';
    }

    const cleanCurrentUsername = getCleanUsername(editingVendor.username || '');
    const isUsernameChanged = usernameInput.trim() !== cleanCurrentUsername;
    const hasExistingUser = !!editingVendor.user_id;

    let needsUserCreationOrUpdate = false;
    if (usernameInput.trim() || passwordInput.trim()) {
      if (!usernameInput.trim()) {
        errs.username = 'მომხმარებლის სახელი სავალდებულოა.';
      } else if (!passwordInput.trim() && (!hasExistingUser || isUsernameChanged)) {
        errs.password = 'პაროლი სავალდებულოა.';
      } else {
        needsUserCreationOrUpdate = true;
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});

    // If no changes were made to an existing supplier, do NOT send unnecessary DB update request
    if (!hasVendorChanges()) {
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

    const executeSave = async () => {
      onSavingStateChange?.(true);
      let finalUserId = editingVendor.user_id || '';
      let finalUsername = editingVendor.username || '';

      if (needsUserCreationOrUpdate) {
        try {
          const email = getEmailFromUsername(usernameInput);
          const pregeneratedVendorId = editingVendor.id || ('vendor-' + Math.random().toString(36).substring(2, 9));

          const userPayload: User = {
            id: editingVendor.user_id || '',
            name: editingVendor.trade_name || editingVendor.company_name,
            personal_id: editingVendor.id_code || '11111111111',
            email: email,
            password: passwordInput.trim() ? passwordInput.trim() : undefined,
            phone: tempContacts.find(c => c.is_default)?.phone || editingVendor.id_code || '599000000',
            role: 'vendor',
            permissions: {},
            vendor_id: pregeneratedVendorId
          };

          const savedUserResult = await saveUser(userPayload, currentUser.name || 'System');
          finalUserId = savedUserResult.id;
          finalUsername = usernameInput.trim();
          
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

      const payload: Vendor = {
        ...editingVendor,
        company_code: editingVendor.company_code || editingVendor.id_code || 'N/A',
        contacts: tempContacts,
        user_id: finalUserId || undefined,
        username: finalUsername || undefined
      };

      try {
        const savedRes = await onSave(payload);
        const finalSavedId = (savedRes && (savedRes as any).id) || payload.id || editingVendor.id;
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
    const randomCity = randomCityObj ? randomCityObj.name : 'Tbilisi';
    
    const matchingDistricts = districts.filter(d => !randomCityObj || d.city_id === randomCityObj.id);
    const randomDistrict = matchingDistricts.length > 0 
      ? matchingDistricts[Math.floor(Math.random() * matchingDistricts.length)].name 
      : (districts[0]?.name || 'Saburtalo');

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
        user_name: currentUser.name
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

  return (
    <div className="animate-in fade-in duration-200 max-w-4xl" id="vendors-form-panel">
      <fieldset disabled={isReadOnly} className="contents disabled:opacity-95">
        <div className="space-y-6 pt-2 text-left">
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
          <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 text-left">
            <span className="text-xs font-bold uppercase text-gray-400 tracking-wider block border-b border-gray-100 pb-2">
              {t("Supplier Login Account")}
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label={t("Username")}
                type="text"
                fontClass="font-mono"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  if (fieldErrors.username) setFieldErrors(prev => ({ ...prev, username: '' }));
                }}
                error={fieldErrors.username}
                autoComplete="new-password"
                name="vendor-username-field"
              />
              <FormInput
                label={t("Password (min. 6 symbols)")}
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                }}
                error={fieldErrors.password}
                autoComplete="new-password"
                name="vendor-password-field"
              />
            </div>
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
                // Reorder: sort by is_default desc
                updated.sort((a,b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
                // Update sort_orders based on index
                const reordered = updated.map((c, idx) => ({
                  ...c,
                  sort_order: updated.length - idx
                }));
                setTempContacts(reordered);
              }}
              onReorderContacts={(startIndex, endIndex) => {
                const updated = [...tempContacts];
                const [removed] = updated.splice(startIndex, 1);
                updated.splice(endIndex, 0, removed);
                
                // The default/primary contact must always remain at index 0 (top)
                const defaultIdx = updated.findIndex(c => c.is_default);
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
            />
          </div>

          <VendorCommunicationsSection
            communications={communications}
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
        title={t("Discard Comment?")}
        message={t("Are you sure you want to discard this comment?")}
      />

      <ConfirmDeleteModal
        isOpen={isCommDeleteModalOpen}
        onClose={() => setIsCommDeleteModalOpen(false)}
        onConfirm={() => {
          if (activeComm && onDeleteCommunication) {
            onDeleteCommunication(activeComm.id);
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
          if (onSaveCommunication) {
            onSaveCommunication(payload);
          }
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
