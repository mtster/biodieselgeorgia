import React, { useState, useEffect } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../../types';
import { 
  Plus, Trash2, X, Phone, ShieldAlert, MessageSquare 
} from 'lucide-react';

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
  onRegisterTriggers?: (triggers: { save: () => void; fillDummy: () => void }) => void;
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
  onRegisterTriggers
}: Props) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Contacts helper states
  const [tempContacts, setTempContacts] = useState<VendorContact[]>([]);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [activeContact, setActiveContact] = useState<VendorContact | null>(null);
  
  // Contact field temporary states
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactPos, setContactPos] = useState<'accountant' | 'director' | 'operator' | 'other'>('accountant');
  const [contactNote, setContactNote] = useState('');

  // Comment helper states
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [activeComment, setActiveComment] = useState<VendorComment | null>(null);
  const [commentText, setCommentText] = useState('');

  // Initialize contacts list
  useEffect(() => {
    setTempContacts(editingVendor.contacts || []);
  }, [editingVendor.id]);

  // Hook form save and dummy triggers into sticky top header
  useEffect(() => {
    if (onRegisterTriggers) {
      onRegisterTriggers({
        save: handleSaveAll,
        fillDummy: fillDummyData
      });
    }
  }, [onRegisterTriggers, editingVendor, tempContacts]);

  // Contacts Actions
  const openContactModal = (contact?: VendorContact) => {
    if (contact) {
      setActiveContact(contact);
      setContactName(contact.name);
      setContactPhone(contact.phone);
      setContactPos(contact.position);
      setContactNote(contact.note || '');
    } else {
      setActiveContact(null);
      setContactName('');
      setContactPhone('');
      setContactPos('accountant');
      setContactNote('');
    }
    setIsContactModalOpen(true);
  };

  const handleSaveContactModal = () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      alert("Please fill in contact name and phone number");
      return;
    }

    if (activeContact) {
      setTempContacts(tempContacts.map(c => c.id === activeContact.id ? {
        ...c,
        name: contactName,
        phone: contactPhone,
        position: contactPos,
        note: contactNote
      } : c));
    } else {
      const isFirst = tempContacts.length === 0;
      const newContact: VendorContact = {
        id: 'cont-' + Math.random().toString(36).substring(2, 9),
        name: contactName,
        phone: contactPhone,
        position: contactPos,
        note: contactNote,
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
    if (comment) {
      setActiveComment(comment);
      setCommentText(comment.comment);
    } else {
      setActiveComment(null);
      setCommentText('');
    }
    setIsCommentModalOpen(true);
  };

  const handleSaveCommentModal = () => {
    if (!commentText.trim()) return;

    if (activeComment) {
      const updatedComments = (editingVendor.comments || []).map(c => 
        c.id === activeComment.id ? { ...c, comment: commentText } : c
      );
      setEditingVendor(prev => prev ? {
        ...prev,
        comments: updatedComments
      } : null);
    } else {
      const newComment: VendorComment = {
        id: 'comm-' + Math.random().toString(36).substring(2, 9),
        comment: commentText,
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

  const handleSetDefaultContact = (id: string) => {
    setTempContacts(tempContacts.map(c => ({
      ...c,
      is_default: c.id === id
    })));
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
      errs.city = 'Please select a City.';
    }
    if (!editingVendor.district) {
      errs.district = 'Please select a District.';
    }
    if (!editingVendor.warehouse_id) {
      errs.warehouse_id = 'Please select an Assigned Base Warehouse.';
    }
    if (!editingVendor.manager_id) {
      errs.manager_id = 'Please select an Acquisition Manager.';
    }
    if (!editingVendor.operator_id) {
      errs.operator_id = 'Please select a Systems Dispatcher.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});

    const payload: Vendor = {
      ...editingVendor,
      company_code: editingVendor.company_code || editingVendor.id_code, // Maintain separate editable Assigned Code, fallback to id_code if empty
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
      manager_id: users[0]?.id || '',
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
                onChange={(e) => setEditingVendor({...editingVendor, bank_account: e.target.value})}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>

            <div className="relative">
              <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 text-left">
                Working Hours *
              </span>
              <input 
                type="text"
                placeholder="e.g. 10:00 - 16:00"
                value={editingVendor.working_hours}
                onChange={(e) => {
                  const val = e.target.value;
                  const digits = val.replace(/\D/g, '').slice(0, 8);
                  let formatted = digits;
                  if (digits.length > 6) {
                    formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)} - ${digits.slice(4, 6)}:${digits.slice(6)}`;
                  } else if (digits.length > 4) {
                    formatted = `${digits.slice(0, 2)}:${digits.slice(2, 4)} - ${digits.slice(4)}`;
                  } else if (digits.length > 2) {
                    formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
                  }
                  setEditingVendor({...editingVendor, working_hours: formatted});
                }}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <span className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${fieldErrors.city ? 'text-red-500' : 'text-gray-400'}`}>
                City *
              </span>
              <select
                value={editingVendor.city}
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
                <option value="" disabled></option>
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
                value={editingVendor.district}
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
                <option value="" disabled></option>
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
                value={editingVendor.warehouse_id}
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
                <option value="" disabled></option>
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
                value={editingVendor.manager_id}
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
                <option value="" disabled></option>
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
                value={editingVendor.operator_id}
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
                <option value="" disabled></option>
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
                onChange={(e) => updateMainContact('phone', e.target.value)}
                className="block w-full px-3.5 py-3 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
              />
            </div>
          </div>
        </div>

        {/* Contacts & Comments Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-2 mb-4">
                <span className="text-xs font-black uppercase text-gray-500 tracking-wider font-sans">Part 2: Additional Contact Persons</span>
                <button
                  type="button"
                  onClick={() => openContactModal()}
                  className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border text-slate-700 font-black rounded-lg transition inline-flex items-center gap-1 select-none cursor-pointer"
                >
                  <Plus size={12} /> Add Contact
                </button>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {tempContacts.filter(c => !c.is_default).map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs text-left group">
                    <div>
                      <span className="font-extrabold text-gray-800 block text-xs">{c.name}</span>
                      <span className="text-[10px] text-gray-400 font-sans uppercase tracking-wider block font-medium mt-0.5">{c.position}</span>
                      <span className="text-[10.5px] text-emerald-800 font-mono font-bold mt-1 block select-all inline-flex items-center gap-1">
                        <Phone size={10} /> {c.phone}
                      </span>
                    </div>
                    <div className="flex gap-1 select-none">
                      <button
                        type="button"
                        onClick={() => openContactModal(c)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 border text-gray-650 rounded-lg text-[10px] font-bold cursor-pointer transition"
                      >
                        Modify
                      </button>
                    </div>
                  </div>
                ))}

                {tempContacts.filter(c => !c.is_default).length === 0 && (
                  <div className="text-center py-10 text-gray-400 text-xs italic font-sans">
                    No alternative/additional contact recorded.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-2 mb-4">
                <span className="text-xs font-black uppercase text-gray-500 tracking-wider font-sans">Part 3: Memos / Internal Comments</span>
                <button
                  type="button"
                  onClick={() => openCommentModal()}
                  className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border text-slate-700 font-black rounded-lg transition inline-flex items-center gap-1 select-none cursor-pointer"
                >
                  <Plus size={12} /> Add Memo
                </button>
              </div>

              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {(editingVendor.comments || []).map((c) => (
                  <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs text-left">
                    <div className="flex justify-between text-[10px] text-gray-400 font-sans font-bold">
                      <span className="text-emerald-700 font-extrabold">{c.user_name}</span>
                      <span>{new Date(c.date).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-700 font-medium leading-relaxed font-sans select-all">{c.comment}</p>
                    <div className="flex justify-end gap-1 select-none font-sans pt-1">
                      <button
                        type="button"
                        onClick={() => openCommentModal(c)}
                        className="text-[10px] font-bold text-gray-450 hover:text-emerald-700 cursor-pointer"
                      >
                        Edit
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveComment(c.id)}
                        className="text-[10px] font-bold text-gray-450 hover:text-red-700 cursor-pointer"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ))}

                {(!editingVendor.comments || editingVendor.comments.length === 0) && (
                  <div className="text-center py-10 text-gray-400 text-xs italic font-sans">
                    No supplier memo entered.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ADDITIONAL SMALL OVERLAY CONTROLLERS */}

      {/* 4. EXPLICIT CONTACT MODAL (SMALL OVERLAY) */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wide">
                {activeContact ? 'Edit Contact Person' : 'Add Contact Person'}
              </h4>
              <button onClick={() => setIsContactModalOpen(false)} className="p-1 hover:bg-slate-50 rounded text-gray-400">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3.5 text-left">
              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-white select-none z-10">
                  Contact Name *
                </span>
                <input 
                  type="text" 
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="block w-full px-3 py-3 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-white select-none z-10 font-mono">
                  Mobile Phone Number *
                </span>
                <input 
                  type="text" 
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="block w-full px-3 py-3 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-none font-mono"
                />
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-white select-none z-10">
                  Position / Role
                </span>
                <select
                  value={contactPos}
                  onChange={(e) => setContactPos(e.target.value as any)}
                  className="block w-full px-3 py-2 bg-white border border-gray-205 rounded-xl text-xs font-sans cursor-pointer focus:outline-none"
                >
                  <option value="accountant">Accountant</option>
                  <option value="director">Director/Owner</option>
                  <option value="operator">Operations Mgr</option>
                  <option value="other">Other Position</option>
                </select>
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-white select-none z-10">
                  Short Note (e.g. call instructions)
                </span>
                <input 
                  type="text" 
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  className="block w-full px-3 py-3 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2 font-sans select-none">
              {activeContact && (
                <button
                  type="button"
                  onClick={() => handleRemoveContact(activeContact.id)}
                  className="mr-auto px-3 py-1.5 border border-rose-250 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition flex items-center gap-1 select-none cursor-pointer"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="px-3 py-1.5 bg-gray-100 text-gray-650 rounded-lg text-xs font-bold transition select-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveContactModal}
                className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-lg text-xs font-extrabold transition select-none cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. EXPLICIT COMMENT MODAL (SMALL OVERLAY) */}
      {isCommentModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wide">
                Comment
              </h4>
              <button onClick={() => setIsCommentModalOpen(false)} className="p-1 hover:bg-slate-50 rounded text-gray-400">
                <X size={14} />
              </button>
            </div>

            <div className="text-left space-y-1.5">
              <textarea 
                rows={4}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write specific supplier memo here..."
                className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              ></textarea>
            </div>

            <div className="flex gap-2.5 justify-end pt-1 font-sans select-none">
              {activeComment && (
                <button
                  type="button"
                  onClick={() => handleRemoveComment(activeComment.id)}
                  className="mr-auto px-3 py-1.5 border border-rose-250 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition flex items-center gap-1 select-none cursor-pointer"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCommentModalOpen(false)}
                className="px-3 py-1.5 bg-gray-100 text-gray-650 rounded-lg text-xs font-bold transition select-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCommentModal}
                className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-lg text-xs font-extrabold transition select-none cursor-pointer"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
