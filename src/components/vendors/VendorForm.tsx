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
import FormModal from '../FormModal';
import { StandardTable, ColumnConfig } from '../StandardTable';
import { FormInput, FormSelect } from '../FormInput';

import { MessageSquare, X, Trash2 } from 'lucide-react';

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
  const [activeComm, setActiveComm] = useState<Communication | null>(null);

  useEffect(() => {
    if (activeComm) {
      setNewCommDate(new Date(activeComm.date_time).toISOString().substring(0, 16));
      setNewCommType(activeComm.type);
      setNewCommReminderTime(activeComm.reminder_time ? new Date(activeComm.reminder_time).toISOString().substring(0, 16) : '');
      setNewCommContactId(activeComm.vendor_contact_id || '');
      setNewCommUserId(activeComm.user_id);
      setNewCommComment(activeComm.comment);
      setNewCommResponsibleUserId(activeComm.responsible_user_id || '');
      setNewCommTaskStatus(activeComm.task_status || 'pending');
    } else {
      setNewCommDate(new Date().toISOString().substring(0, 16));
      setNewCommType('action');
      setNewCommReminderTime('');
      setNewCommUserId(currentUser.id);
      setNewCommComment('');
      setNewCommResponsibleUserId('');
      setNewCommTaskStatus('pending');
    }
  }, [activeComm, isCommModalOpen]);

  // Initialize contacts list
  useEffect(() => {
    setTempContacts(editingVendor.contacts || []);
  }, [editingVendor.id]);

  // New communication form states
  const [newCommDate, setNewCommDate] = useState(new Date().toISOString().substring(0, 16));
  const [newCommType, setNewCommType] = useState<'action' | 'reminder' | 'task'>('action');
  const [newCommReminderTime, setNewCommReminderTime] = useState('');
  const [newCommContactId, setNewCommContactId] = useState('');
  const [newCommUserId, setNewCommUserId] = useState(currentUser.id);
  const [newCommComment, setNewCommComment] = useState('');
  const [newCommResponsibleUserId, setNewCommResponsibleUserId] = useState('');
  const [newCommTaskStatus, setNewCommTaskStatus] = useState('pending');
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

  const handleSaveCommunication = async () => {
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
      id: activeComm ? activeComm.id : '',
      date_time: new Date(newCommDate).toISOString(),
      type: newCommType,
      reminder_time: newCommType === 'reminder' && newCommReminderTime ? new Date(newCommReminderTime).toISOString() : undefined,
      user_id: newCommUserId,
      user_name: assignedUser ? assignedUser.name : currentUser.name,
      vendor_id: editingVendor.id,
      vendor_name: editingVendor.trade_name,
      vendor_contact_id: newCommContactId,
      vendor_contact_name: assignedContact ? assignedContact.name : 'Direct Interaction',
      comment: newCommComment.trim(),
      responsible_user_id: newCommType === 'task' ? (newCommResponsibleUserId || undefined) : undefined,
      responsible_user_name: newCommType === 'task' ? (users.find(u => u.id === newCommResponsibleUserId)?.name || '') : undefined,
      task_status: newCommType === 'task' ? newCommTaskStatus : undefined
    };

    try {
      if (onSaveCommunication) {
        await onSaveCommunication(commPayload);
        setNewCommComment('');
        setNewCommReminderTime('');
        setNewCommType('action');
        setNewCommDate(new Date().toISOString().substring(0, 16));
        setNewCommResponsibleUserId('');
        setNewCommTaskStatus('pending');
        setActiveComm(null);
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

  const commColumns: ColumnConfig<Communication>[] = [
    {
      header: 'Date & Time',
      key: 'date_time',
      render: (comm) => {
        const d = new Date(comm.date_time);
        return isNaN(d.getTime()) ? (
          <span className="font-mono text-xs">{comm.date_time}</span>
        ) : (
          <span className="font-mono text-xs">{d.toLocaleString()}</span>
        );
      }
    },
    {
      header: 'Type',
      key: 'type',
      render: (comm) => {
        const styleMap: Record<string, string> = {
          action: 'bg-emerald-50 text-emerald-800 border-emerald-100',
          reminder: 'bg-amber-50 text-amber-800 border-amber-100',
          task: 'bg-blue-50 text-blue-800 border-blue-105',
        };
        const labelMap: Record<string, string> = {
          action: 'Action',
          reminder: 'Reminder',
          task: 'Task',
        };
        const statusClass = styleMap[comm.type] || 'bg-slate-50 text-slate-700 border-slate-100';
        const label = labelMap[comm.type] || comm.type;
        return (
          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${statusClass}`}>
            {label}
          </span>
        );
      }
    },
    {
      header: 'Interaction Details / Comment',
      key: 'comment',
      className: 'whitespace-normal max-w-sm break-words text-slate-700',
      render: (comm) => comm.comment
    },
    {
      header: 'Logged By',
      key: 'user_name',
      render: (comm) => (
        <span className="font-medium text-slate-600">{comm.user_name || currentUser.name}</span>
      )
    },
    {
      header: 'Responsible',
      key: 'responsible_user_id',
      render: (comm) => {
        if (comm.type !== 'task') return <span className="text-gray-400">-</span>;
        const emp = users.find(u => u.id === comm.responsible_user_id);
        return emp ? <span className="font-medium text-blue-600">{emp.name}</span> : <span className="text-gray-400">-</span>;
      }
    },
    {
      header: 'Task Status',
      key: 'task_status',
      render: (comm) => {
        if (comm.type !== 'task' || !comm.task_status) return <span className="text-gray-400">-</span>;
        const labelMap: Record<string, string> = {
          pending: 'Pending',
          in_progress: 'In Progress',
          completed: 'Completed',
        };
        const styleMap: Record<string, string> = {
          pending: 'bg-rose-50 text-rose-800 border-rose-100',
          in_progress: 'bg-indigo-50 text-indigo-850 border-indigo-100',
          completed: 'bg-emerald-50 text-emerald-850 border-emerald-100'
        };
        return (
          <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-bold tracking-wide uppercase ${styleMap[comm.task_status] || 'bg-slate-50 text-slate-700'}`}>
            {labelMap[comm.task_status] || comm.task_status}
          </span>
        );
      }
    },
    {
      header: '',
      key: 'actions',
      className: 'text-right pr-4',
      render: (comm) => (
        <div className="flex justify-end gap-1">
          {!isReadOnly && onDeleteCommunication && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCommunication(comm.id);
              }}
              className="p-1 px-1.5 text-slate-400 hover:text-red-650 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Delete Log"
            >
              <Trash2 size={13.5} />
            </button>
          )}
        </div>
      )
    }
  ];

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

        {/* Communications Log Section */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider">
                  Communications
                </h4>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveComm(null);
                    setIsCommModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950 border border-emerald-205 rounded-xl text-xs font-bold font-sans cursor-pointer transition-all flex items-center gap-1.5 shadow-3xs"
                >
                  <MessageSquare size={13} />
                  Add Communication
                </button>
              )}
            </div>

            <div className="pt-1">
              <StandardTable
                data={communications.filter(c => c.vendor_id === editingVendor.id && !c.is_deleted)}
                columns={commColumns}
                onRowClick={(comm) => {
                  setActiveComm(comm);
                  setIsCommModalOpen(true);
                }}
                emptyMessage="No previous interactions logged for this supplier."
                hidePagination={true}
              />
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
      <FormModal
        isOpen={isCommModalOpen}
        onClose={() => setIsCommModalOpen(false)}
        title={activeComm ? "Edit Communication" : "New Communication"}
        maxWidthClass="max-w-md"
        onCancel={() => setIsCommModalOpen(false)}
        onSave={async () => {
          await handleSaveCommunication();
          setIsCommModalOpen(false);
        }}
        saveLabel={activeComm ? "Save Communication" : "Add Communication"}
      >
        <div className="space-y-4">
          <FormInput
            label="Date & Time *"
            type="datetime-local"
            value={newCommDate}
            onChange={(e) => setNewCommDate(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormSelect
              label="Type *"
              value={newCommType}
              onChange={(e) => setNewCommType(e.target.value as any)}
            >
              <option value="action">Action</option>
              <option value="reminder">Reminder</option>
              <option value="task">Task</option>
            </FormSelect>

            <FormSelect
              label="User Rep *"
              value={newCommUserId}
              onChange={(e) => setNewCommUserId(e.target.value)}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </FormSelect>
          </div>

          {newCommType === 'task' && (
            <div className="grid grid-cols-2 gap-3">
              <FormSelect
                label="Responsible User *"
                value={newCommResponsibleUserId}
                onChange={(e) => setNewCommResponsibleUserId(e.target.value)}
              >
                <option value="">Select Employee</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </FormSelect>

              <FormSelect
                label="Task Status *"
                value={newCommTaskStatus}
                onChange={(e) => setNewCommTaskStatus(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </FormSelect>
            </div>
          )}

          {newCommType === 'reminder' && (
            <FormInput
              label="Reminder Due Time *"
              type="datetime-local"
              value={newCommReminderTime}
              onChange={(e) => setNewCommReminderTime(e.target.value)}
            />
          )}

          <FormSelect
            label="Supplier"
            value={newCommContactId}
            onChange={(e) => setNewCommContactId(e.target.value)}
          >
            <option value="">Direct / No contact selected</option>
            {tempContacts.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.position})
              </option>
            ))}
          </FormSelect>

          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left text-gray-400">Notes / Discussion Content *</span>
            <textarea
              rows={4}
              placeholder="Discussed pricing rate terms / Scheduled upcoming grease pickup..."
              value={newCommComment}
              onChange={(e) => {
                setNewCommComment(e.target.value);
                if (commError) setCommError('');
              }}
              className="block w-full px-3.5 py-4 md:py-3 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900 font-sans"
            />
            {commError && (
              <p className="text-[10px] text-red-600 font-bold mt-1 text-left">{commError}</p>
            )}
          </div>
        </div>
      </FormModal>
    </div>
  );
}
