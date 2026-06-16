import React, { useState, useEffect } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../../types';

import { WorkingHoursInput } from './WorkingHoursInput';
import VendorContactsSection from './VendorContactsSection';
import VendorCommentsSection from './VendorCommentsSection';
import VendorContactModal from './VendorContactModal';
import VendorCommentModal from './VendorCommentModal';

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
  isReadOnly = false
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Contacts helper states
  const [tempContacts, setTempContacts] = useState<VendorContact[]>([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<VendorContact | null>(null);

  // Comment helper states
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [activeComment, setActiveComment] = useState<VendorComment | null>(null);

  // Initialize contacts list
  useEffect(() => {
    setTempContacts(editingVendor.contacts || []);
  }, [editingVendor.id]);

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
    setTempContacts(tempContacts.filter(c => c.id !== id));
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
    setIsCommentModalOpen(false);
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
    if (!editingVendor.id_code.trim()) {
      errs.id_code = 'Identification Code is required.';
    }
    if (!editingVendor.city) {
      errs.city = 'City is required.';
    }
    if (!editingVendor.district) {
      errs.district = 'District is required.';
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
      const banks = ['TB', 'BG', 'LB', 'NV'];
      const randomBank = banks[Math.floor(Math.random() * banks.length)] + '77';
      const digits = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
      const check = String(Math.floor(10 + Math.random() * 89));
      return `GE${check}${randomBank}${digits}`;
    };

    setEditingVendor({
      ...editingVendor,
      trade_name: 'Dummy Vendor ' + Math.floor(Math.random() * 1000),
      company_name: 'Dummy Co. ' + Math.floor(Math.random() * 1000),
      id_code: '123' + Math.floor(Math.random() * 100000000),
      bank_account: generateGeorgianIban(),
      city: cities[0]?.name || '',
      district: districts[0]?.name || '',
      address: 'Dummy St. 1',
      price_per_liter: 1.5,
      warehouse_id: warehouses[0]?.id || '',
      manager_id: users.find(u => u.role === 'manager')?.id || users[0]?.id || '',
      operator_id: users[0]?.id || '',
      working_hours: '09:00 - 18:00',
    });
    setTempContacts([{
        id: 'dummy-contact',
        name: 'John Doe',
        phone: '555-0100',
        position: 'director',
        is_default: true
    }]);
  };

  return (
    <div className="animate-in fade-in duration-200 max-w-4xl" id="vendors-form-panel">
      <fieldset disabled={isReadOnly} className="contents disabled:opacity-95">
        <div className="space-y-6 pt-2 text-left">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
          <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Core Supplier Parameters</span>
          
          <div className="relative">
            <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.trade_name ? 'text-red-500' : 'text-gray-400'}`}>
              Trade/Commercial Name *
            </span>
            <input 
              type="text"
              value={editingVendor.trade_name}
              onChange={(e) => {
                setEditingVendor({...editingVendor, trade_name: e.target.value});
                if (fieldErrors.trade_name) setFieldErrors(prev => ({ ...prev, trade_name: '' }));
              }}
              className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans transition-all ${
                fieldErrors.trade_name 
                  ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                  : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
              }`}
            />
            {fieldErrors.trade_name && (
              <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                {fieldErrors.trade_name}
              </p>
            )}
          </div>

          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
              Legal/Registered Name (Company Name)
            </span>
            <input 
              type="text"
              value={editingVendor.company_name}
              onChange={(e) => setEditingVendor({...editingVendor, company_name: e.target.value})}
              className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 text-left ${fieldErrors.id_code ? 'text-red-500' : 'text-gray-400'}`}>
                Identification Code *
              </span>
              <input 
                type="text"
                value={editingVendor.id_code}
                onChange={(e) => {
                  setEditingVendor({...editingVendor, id_code: e.target.value});
                  if (fieldErrors.id_code) setFieldErrors(prev => ({ ...prev, id_code: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-mono transition-all ${
                  fieldErrors.id_code 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-950' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              />
              {fieldErrors.id_code && (
                <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.id_code}
                </p>
              )}
            </div>

            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Code Assigned by Us *
              </span>
              <input 
                type="text"
                value={editingVendor.company_code || ''}
                onChange={(e) => setEditingVendor({...editingVendor, company_code: e.target.value})}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>

            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Base Price per Liter (₾) *
              </span>
              <input 
                type="number"
                step="0.01"
                value={editingVendor.price_per_liter || ''}
                onChange={(e) => setEditingVendor({...editingVendor, price_per_liter: parseFloat(e.target.value) || 0})}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                IBAN / Bank Account
              </span>
              <input 
                type="text"
                value={editingVendor.bank_account}
                onChange={(e) => {
                  let clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  let res = '';
                  for(let i=0; i<clean.length && i<22; i++) {
                    const c = clean[i];
                    if (i < 2) {
                      if (/[A-Z]/.test(c)) res += c;
                    } else if (i < 4) {
                      if (/[0-9]/.test(c)) res += c;
                    } else if (i < 6) {
                      if (/[A-Z]/.test(c)) res += c;
                    } else {
                      if (/[0-9]/.test(c)) res += c;
                    }
                  }
                  setEditingVendor({...editingVendor, bank_account: res});
                }}
                maxLength={22}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>

            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Working Hours *
              </span>
              <WorkingHoursInput
                value={editingVendor.working_hours || ''}
                onChange={(val) => setEditingVendor({ ...editingVendor, working_hours: val })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.city ? 'text-red-500' : 'text-gray-400'}`}>
                City *
              </span>
              <select
                value={editingVendor.city || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const cObj = cities.find(x => x.name === val);
                  const filtered = districts.filter(d => !cObj || d.city_id === cObj.id);
                  setEditingVendor({
                    ...editingVendor,
                    city: val,
                    district: filtered[0]?.name || ''
                  });
                  if (fieldErrors.city) setFieldErrors(prev => ({ ...prev, city: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
                  fieldErrors.city 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              >
                <option value="" hidden></option>
                {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              {fieldErrors.city && (
                <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.city}
                </p>
              )}
            </div>

            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.district ? 'text-red-500' : 'text-gray-400'}`}>
                District *
              </span>
              <select
                value={editingVendor.district || ''}
                onChange={(e) => {
                  setEditingVendor({...editingVendor, district: e.target.value});
                  if (fieldErrors.district) setFieldErrors(prev => ({ ...prev, district: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
                  fieldErrors.district 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              >
                <option value="" hidden></option>
                {districts
                  .filter(d => {
                    const cObj = cities.find(x => x.name === editingVendor.city);
                    return !cObj || d.city_id === cObj.id;
                  })
                  .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
                }
              </select>
              {fieldErrors.district && (
                <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.district}
                </p>
              )}
            </div>
          </div>

          <div className="relative">
            <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
              Exact Address (Details, Floor, Entry)
            </span>
            <input 
              type="text"
              value={editingVendor.address}
              onChange={(e) => setEditingVendor({...editingVendor, address: e.target.value})}
              className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.warehouse_id ? 'text-red-500' : 'text-gray-400'}`}>
                Assigned Base Warehouse *
              </span>
              <select
                value={editingVendor.warehouse_id || ''}
                onChange={(e) => {
                  setEditingVendor({...editingVendor, warehouse_id: e.target.value});
                  if (fieldErrors.warehouse_id) setFieldErrors(prev => ({ ...prev, warehouse_id: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
                  fieldErrors.warehouse_id 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              >
                <option value="" hidden></option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {fieldErrors.warehouse_id && (
                <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.warehouse_id}
                </p>
              )}
            </div>

            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.manager_id ? 'text-red-500' : 'text-gray-400'}`}>
                Acquisition Manager *
              </span>
              <select
                value={editingVendor.manager_id || ''}
                onChange={(e) => {
                  setEditingVendor({...editingVendor, manager_id: e.target.value});
                  if (fieldErrors.manager_id) setFieldErrors(prev => ({ ...prev, manager_id: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
                  fieldErrors.manager_id 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              >
                <option value="" hidden></option>
                {users.filter(u => u.role === 'manager').map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
                {editingVendor.manager_id && !users.filter(u => u.role === 'manager').some(u => u.id === editingVendor.manager_id) && (() => {
                  const assignedUser = users.find(u => u.id === editingVendor.manager_id);
                  return assignedUser ? (
                    <option key={assignedUser.id} value={assignedUser.id}>{assignedUser.name} ({assignedUser.role || 'Ad hoc'})</option>
                  ) : null;
                })()}
                {users.filter(u => u.role === 'manager').length === 0 && !editingVendor.manager_id && (
                  <option value={currentUser.id}>{currentUser.name} (Ad hoc)</option>
                )}
              </select>
              {fieldErrors.manager_id && (
                <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.manager_id}
                </p>
              )}
            </div>

            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.operator_id ? 'text-red-500' : 'text-gray-400'}`}>
                Systems Dispatcher *
              </span>
              <select
                value={editingVendor.operator_id || ''}
                onChange={(e) => {
                  setEditingVendor({...editingVendor, operator_id: e.target.value});
                  if (fieldErrors.operator_id) setFieldErrors(prev => ({ ...prev, operator_id: '' }));
                }}
                className={`block w-full px-3.5 py-3 text-xs border rounded-xl focus:outline-none focus:ring-1 font-sans cursor-pointer relative ${
                  fieldErrors.operator_id 
                    ? 'border-red-500 bg-red-50/10 focus:border-red-650 focus:ring-red-650 text-red-900' 
                    : 'border-gray-200 focus:border-emerald-600 focus:ring-emerald-600 bg-white text-gray-900'
                }`}
              >
                <option value="" hidden></option>
                {users.map(e => (
                  <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                ))}
                {editingVendor.operator_id && !users.some(u => u.id === editingVendor.operator_id) && (() => {
                  const assignedUser = users.find(u => u.id === editingVendor.operator_id);
                  return assignedUser ? (
                    <option key={assignedUser.id} value={assignedUser.id}>{assignedUser.name} ({assignedUser.role || 'Ad hoc'})</option>
                  ) : null;
                })()}
              </select>
              {fieldErrors.operator_id && (
                <p className="text-[10px] text-red-600 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
                  {fieldErrors.operator_id}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Part 1: Main Contact Person */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5 text-left">
          <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Part 1: Main Contact Person</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Main Contact Name *
              </span>
              <input 
                type="text"
                value={tempContacts.find(c => c.is_default)?.name || ''}
                onChange={(e) => updateMainContact('name', e.target.value)}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
              />
            </div>
            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Main Contact Phone *
              </span>
              <input 
                type="text"
                value={tempContacts.find(c => c.is_default)?.phone || ''}
                onFocus={(e) => { 
                  if (!tempContacts.find(c => c.is_default)?.phone) updateMainContact('phone', '+995 '); 
                }}
                onChange={(e) => {
                  const cleanPhone = e.target.value.replace(/[^0-9+]/g, '');
                  updateMainContact('phone', cleanPhone);
                }}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>
          </div>
        </div>

        {/* Contacts & Comments Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          <VendorContactsSection
            contacts={tempContacts}
            onAddContact={() => openContactModal()}
            onModifyContact={(c) => openContactModal(c)}
          />

          <VendorCommentsSection
            comments={editingVendor.comments || []}
            onAddComment={() => openCommentModal()}
            onModifyComment={(c) => openCommentModal(c)}
            onRemoveComment={handleRemoveComment}
          />
        </div>

      </div>
      </fieldset>

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
    </div>
  );
}
