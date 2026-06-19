import React, { useState, useEffect } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District, Communication 
} from '../../types';

import VendorFormFields from './VendorFormFields';
import VendorContactsSection from './VendorContactsSection';
import VendorCommentsSection from './VendorCommentsSection';
import VendorContactModal from './VendorContactModal';
import VendorCommentModal from './VendorCommentModal';
import ConfirmDeleteModal from '../ConfirmDeleteModal';

import { MessageSquare, X } from 'lucide-react';

interface Props {
  editingVendor: Vendor;
  setEditingVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
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

  // Initialize contacts list
  useEffect(() => {
    setTempContacts(editingVendor.contacts || []);
  }, [editingVendor.id]);

  // New communication form states
  const [newCommDate, setNewCommDate] = useState(new Date().toISOString().substring(0, 16));
  const [newCommType, setNewCommType] = useState<'action' | 'reminder'>('action');
  const [newCommReminderTime, setNewCommReminderTime] = useState('');
  const [newCommContactId, setNewCommContactId] = useState('');
  const [newCommUserId, setNewCommUserId] = useState(currentUser.id);
  const [newCommComment, setNewCommComment] = useState('');
  const [commError, setCommError] = useState('');

  useEffect(() => {
    const primary = tempContacts.find(c => c.is_default);
    if (primary) {
      setNewCommContactId(primary.id);
    } else if (tempContacts.length > 0) {
      setNewCommContactId(tempContacts[0].id);
    } else {
      setNewCommContactId('');
    }
  }, [tempContacts]);

  const handleAddSupplierCommunication = async () => {
    if (!editingVendor.id) {
      alert("Please save this supplier before logging communication records.");
      return;
    }
    if (!newCommComment.trim()) {
      setCommError("Log comment is required.");
      return;
    }
    setCommError('');
    
    const assignedUser = users.find(u => u.id === newCommUserId);
    const assignedContact = tempContacts.find(c => c.id === newCommContactId);

    const commPayload: Communication = {
      id: '',
      date_time: new Date(newCommDate).toISOString(),
      type: newCommType,
      reminder_time: newCommType === 'reminder' && newCommReminderTime ? new Date(newCommReminderTime).toISOString() : undefined,
      user_id: newCommUserId,
      user_name: assignedUser ? assignedUser.name : currentUser.name,
      vendor_id: editingVendor.id,
      vendor_name: editingVendor.trade_name,
      vendor_contact_id: newCommContactId,
      vendor_contact_name: assignedContact ? assignedContact.name : 'Direct Interaction',
      comment: newCommComment.trim()
    };

    try {
      if (onSaveCommunication) {
        await onSaveCommunication(commPayload);
        setNewCommComment('');
        setNewCommReminderTime('');
        setNewCommType('action');
        setNewCommDate(new Date().toISOString().substring(0, 16));
      }
    } catch (e) {
      console.error(e);
    }
  };

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
          currentUser={currentUser}
        />

        {/* Contacts & Comments Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
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

        {/* Communications Log Section */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-6 mt-6">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider">
                  Communications
                </h4>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setIsCommModalOpen(true)}
                  className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-205 rounded-xl text-xs font-bold font-sans cursor-pointer transition-all flex items-center gap-1.5 shadow-3xs"
                >
                  <MessageSquare size={13} />
                  Add Communication
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              <span className="text-[11px] font-bold font-mono text-gray-400 uppercase tracking-widest block">
                Logged Interactions (List)
              </span>
              
              {(() => {
                const sComms = communications.filter(c => c.vendor_id === editingVendor.id && !c.is_deleted);
                if (sComms.length === 0) {
                  return (
                    <div className="p-8 text-center text-xs text-gray-400 italic bg-slate-50/50 rounded-xl border border-dashed border-gray-200">
                      No previous interactions logged for this supplier.
                    </div>
                  );
                }
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sComms.map((comm) => (
                      <div key={comm.id} className="p-3.5 bg-slate-50/50 hover:bg-slate-55 border border-gray-100 rounded-xl space-y-2 transition relative group text-left">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                              comm.type === 'reminder' ? 'bg-amber-100 text-amber-850' : 'bg-emerald-100 text-emerald-850'
                            }`}>
                              {comm.type}
                            </span>
                            <span className="text-[10px] text-gray-500 font-semibold font-sans">
                              via {comm.vendor_contact_name || 'Direct'}
                            </span>
                          </div>
                          <span className="text-[9px] text-gray-400 font-mono">
                            {new Date(comm.date_time).toLocaleString()}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-700 font-sans leading-relaxed break-words">
                          {comm.comment}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-gray-150 text-[9px] text-gray-450">
                          <span className="font-semibold">
                            Logged by: <span className="text-gray-600">{comm.user_name || 'System'}</span>
                          </span>
                          {comm.reminder_time && (
                            <span className="text-amber-800 font-bold font-mono">
                              Due: {new Date(comm.reminder_time).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {!isReadOnly && onDeleteCommunication && (
                          <button
                            type="button"
                            onClick={() => onDeleteCommunication(comm.id)}
                            className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-650 hover:bg-white rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Delete communication log"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

      </div>
      </fieldset>

      <ConfirmDeleteModal
        isOpen={!!commentDeleteId}
        onClose={() => setCommentDeleteId(null)}
        onConfirm={() => commentDeleteId && handleRemoveComment(commentDeleteId)}
        title="Discard Comment?"
        message="Are you sure you want to discard this comment?"
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

      {/* Dynamic Add Communication Popup Modal */}
      {isCommModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-gray-200 text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-extrabold text-sm text-gray-800">Log Supplier Communication</h3>
              <button 
                type="button"
                onClick={() => setIsCommModalOpen(false)} 
                className="text-gray-400 hover:text-gray-650 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Date & Time */}
              <div>
                <label className="text-[10px] font-semibold text-gray-455 block mb-1">Date & Time *</label>
                <input
                  type="datetime-local"
                  value={newCommDate}
                  onChange={(e) => setNewCommDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-55 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-600 cursor-pointer text-gray-850 font-sans"
                />
              </div>

              {/* Log Type and User Rep */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-455 block mb-1">Type *</label>
                  <select
                    value={newCommType}
                    onChange={(e) => setNewCommType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-gray-55 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-600 cursor-pointer text-gray-800"
                  >
                    <option value="action">Action</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-gray-455 block mb-1">User Rep *</label>
                  <select
                    value={newCommUserId}
                    onChange={(e) => setNewCommUserId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-gray-55 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-600 cursor-pointer text-gray-800 text-ellipsis overflow-hidden"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reminder Time */}
              {newCommType === 'reminder' && (
                <div>
                  <label className="text-[10px] font-semibold text-amber-700 block mb-1">Reminder Due Time *</label>
                  <input
                    type="datetime-local"
                    value={newCommReminderTime}
                    onChange={(e) => setNewCommReminderTime(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-amber-200 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none focus:border-amber-600 cursor-pointer text-amber-900"
                  />
                </div>
              )}

              {/* Supplier Contact */}
              <div>
                <label className="text-[10px] font-semibold text-gray-455 block mb-1">Supplier Contact Point</label>
                <select
                  value={newCommContactId}
                  onChange={(e) => setNewCommContactId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-gray-55 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-600 cursor-pointer text-gray-800 text-ellipsis overflow-hidden"
                >
                  <option value="">Direct / No contact selected</option>
                  {tempContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.position})
                    </option>
                  ))}
                </select>
              </div>

              {/* Comment */}
              <div>
                <label className="text-[10px] font-semibold text-gray-455 block mb-1">Notes / Discussion Content *</label>
                <textarea
                  rows={4}
                  placeholder="Discussed pricing rate terms / Scheduled upcoming grease pickup..."
                  value={newCommComment}
                  onChange={(e) => {
                    setNewCommComment(e.target.value);
                    if (commError) setCommError('');
                  }}
                  className="w-full p-2.5 bg-gray-55 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none focus:border-emerald-600 font-sans text-gray-800"
                />
                {commError && (
                  <p className="text-[9px] text-red-650 font-bold block mt-0.5">{commError}</p>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2.5 font-sans">
              <button
                type="button"
                onClick={() => setIsCommModalOpen(false)}
                className="px-4 py-1.5 bg-gray-100 text-gray-750 hover:bg-gray-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newCommComment.trim()) {
                    setCommError("Log comment is required.");
                    return;
                  }
                  await handleAddSupplierCommunication();
                  setIsCommModalOpen(false);
                }}
                className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm animate-none"
              >
                Log Communication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
