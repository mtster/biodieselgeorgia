import React, { useState, useEffect } from 'react';
import { t } from '../../utils/lang';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District, Communication, Direction 
} from '../../types';

import VendorFormFields from './VendorFormFields';
import VendorContactsSection from './VendorContactsSection';
import VendorCommentsSection from './VendorCommentsSection';
import VendorContactModal from './VendorContactModal';
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
  onSave: (vendor: Vendor) => void;
  onCancel: () => void;
  formRef?: React.RefObject<{ save: () => void; fillDummy: () => void }>;
  isReadOnly?: boolean;

  communications?: Communication[];
  onSaveCommunication?: (comm: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
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
  onDeleteCommunication
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    setTempContacts(editingVendor.contacts || []);
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
    save: handleSaveAll,
    fillDummy: fillDummyData
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

  const handleSaveAll = () => {
    const errs: Record<string, string> = {};

    if (!editingVendor.trade_name.trim()) {
      errs.trade_name = 'Trade / Commercial Name is required.';
    }
    if (!editingVendor.company_name.trim()) {
      errs.company_name = 'Legal Name is required.';
    }
    if (!editingVendor.id_code.trim()) {
      errs.id_code = 'Identification Code is required.';
    }
    if (!editingVendor.company_code?.trim()) {
      errs.company_code = 'Code is required.';
    }
    if (!editingVendor.price_per_liter) {
      errs.price_per_liter = 'Base Price is required.';
    }
    if (!editingVendor.working_hours.trim()) {
      errs.working_hours = 'Working Hours is required.';
    }
    if (!editingVendor.bank_account.trim()) {
      errs.bank_account = 'Bank Account is required.';
    }
    if (!editingVendor.city) {
      errs.city = 'City is required.';
    }
    if (!editingVendor.district) {
      errs.district = 'District is required.';
    }
    if (!editingVendor.address.trim()) {
      errs.address = 'Address is required.';
    }
    if (!editingVendor.warehouse_id) {
      errs.warehouse_id = 'Base warehouse is required.';
    }
    if (!editingVendor.manager_id) {
      errs.manager_id = 'Manager is required.';
    }
    if (!editingVendor.operator_id) {
      errs.operator_id = 'Systems Dispatcher is required.';
    }
    if (!editingVendor.direction_id) {
      errs.direction_id = 'Direction is required.';
    }
    if (tempContacts.length === 0) {
      errs.contacts = 'At least one contact must be added.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});

    const payload: Vendor = {
      ...editingVendor,
      company_code: editingVendor.company_code || editingVendor.id_code,
      contacts: tempContacts
    };

    onSave(payload);
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
    const hours = ['08:00 - 17:00', '09:00 - 18:00', '10:00 - 19:00'];
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

    const possibleManagers = users.filter(u => u.role === 'manager' || u.role === 'admin');
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
                setTempContacts(updated);
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
        onSaveCommunication={async (payload) => {
          if (onSaveCommunication) {
            await onSaveCommunication(payload);
          }
          setActiveComm(null);
        }}
        onDeleteCommunication={onDeleteCommunication ? async (id) => {
          await onDeleteCommunication(id);
          setActiveComm(null);
        } : undefined}
      />
    </div>
  );
}
