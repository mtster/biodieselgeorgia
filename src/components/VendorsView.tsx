import React, { useState } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../types';
import { 
  Search, Plus, Edit3, Trash2, FileSpreadsheet, 
  X, Phone, CheckCircle2, ShieldAlert, Edit2, MessageSquare
} from 'lucide-react';

interface Props {
  vendors: Vendor[];
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  currentUser: User;
  onSave: (vendor: Vendor) => void;
  onDelete: (id: string, tradeName: string) => void;

  onAddCity?: (name: string) => void;
  onAddDistrict?: (cityId: string, name: string) => void;
  onAddWarehouse?: (name: string) => void;
}

export default function VendorsView({ 
  vendors, warehouses, users, cities, districts, 
  currentUser, onSave, onDelete,
  onAddCity, onAddDistrict, onAddWarehouse
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  
  // Active edit state (On-screen form)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  const startEdit = (vendor: Vendor) => {
    setErrorMessage(null);
    setEditingVendor(JSON.parse(JSON.stringify(vendor)));
    setTempContacts(vendor.contacts || []);
    setIsNew(false);
  };

  const startNew = () => {
    setErrorMessage(null);
    const defaultVendor: Vendor = {
      id: '',
      id_code: '',
      company_name: '',
      trade_name: '',
      company_code: '', // we make this blank as we only want one code on the UI
      bank_account: '',
      city: '', // empty to prevent prefilling
      district: '', // empty to prevent prefilling
      address: '',
      price_per_liter: 1.40,
      warehouse_id: '', // empty to prevent prefilling
      manager_id: '', // empty to prevent prefilling
      operator_id: '', // empty to prevent prefilling
      contacts: [],
      comments: [],
      working_hours: '09:00 - 18:00',
      created_at: new Date().toISOString()
    };
    setEditingVendor(defaultVendor);
    setTempContacts([]);
    setIsNew(true);
  };

  // Contacts small modal actions
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
      // Editing existing
      setTempContacts(tempContacts.map(c => c.id === activeContact.id ? {
        ...c,
        name: contactName,
        phone: contactPhone,
        position: contactPos,
        note: contactNote
      } : c));
    } else {
      // Adding new
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

  // Comments small modal actions
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
    if (!commentText.trim() || !editingVendor) return;

    if (activeComment) {
      const updatedComments = (editingVendor.comments || []).map(c => 
        c.id === activeComment.id ? { ...c, comment: commentText } : c
      );
      setEditingVendor({
        ...editingVendor,
        comments: updatedComments
      });
    } else {
      const newComment: VendorComment = {
        id: 'comm-' + Math.random().toString(36).substring(2, 9),
        comment: commentText,
        date: new Date().toISOString(),
        user_name: currentUser.name
      };
      setEditingVendor({
        ...editingVendor,
        comments: [newComment, ...(editingVendor.comments || [])]
      });
    }

    setIsCommentModalOpen(false);
  };

  const handleRemoveComment = (id: string) => {
    if (!editingVendor) return;
    setEditingVendor({
      ...editingVendor,
      comments: (editingVendor.comments || []).filter(c => c.id !== id)
    });
    setIsCommentModalOpen(false);
  };

  const handleSetDefaultContact = (id: string) => {
    setTempContacts(tempContacts.map(c => ({
      ...c,
      is_default: c.id === id
    })));
  };

  const handleSaveAll = () => {
    if (!editingVendor) return;
    setErrorMessage(null);

    if (!editingVendor.trade_name.trim()) {
      setErrorMessage('Trade / Commercial Name is required.');
      return;
    }
    if (!editingVendor.id_code.trim()) {
      setErrorMessage('Identification Code is required.');
      return;
    }
    if (!editingVendor.city) {
      setErrorMessage('Please select a City.');
      return;
    }
    if (!editingVendor.district) {
      setErrorMessage('Please select a District.');
      return;
    }
    if (!editingVendor.warehouse_id) {
      setErrorMessage('Please select an Assigned Base Warehouse.');
      return;
    }
    if (!editingVendor.manager_id) {
      setErrorMessage('Please select an Acquisition Manager.');
      return;
    }
    if (!editingVendor.operator_id) {
      setErrorMessage('Please select a Systems Dispatcher.');
      return;
    }

    const payload: Vendor = {
      ...editingVendor,
      company_code: editingVendor.id_code, // Sync company_code with id_code in background
      contacts: tempContacts
    };

    onSave(payload);
    setEditingVendor(null);
  };

  const handleImportExcel = () => {
    if (!importText.trim()) return;
    const lines = importText.split('\n');
    let count = 0;

    lines.forEach(line => {
      const parts = line.split(/[\t,]+/);
      if (parts.length >= 2) {
        const trName = parts[0]?.trim();
        const legName = parts[1]?.trim() || trName;
        const taxVal = parts[2]?.trim() || '204857392';

        if (trName) {
          const mockV: Vendor = {
            id: '',
            id_code: taxVal,
            company_name: legName,
            trade_name: trName,
            company_code: taxVal,
            bank_account: 'GE80TB0000000' + Math.floor(1000000000 + Math.random() * 9000000000),
            city: cities[0]?.name || 'Tbilisi',
            district: districts.filter(d => d.city_id === cities[0]?.id)[0]?.name || 'Saburtalo',
            address: 'Imported address coordinates',
            price_per_liter: 1.40,
            warehouse_id: warehouses[0]?.id || '',
            manager_id: currentUser.id,
            operator_id: currentUser.id,
            contacts: [],
            comments: [{
              id: 'comm-imp',
              comment: 'Bulk imported entry successfully added.',
              date: new Date().toISOString(),
              user_name: currentUser.name
            }],
            working_hours: '09:00 - 18:00',
            created_at: new Date().toISOString()
          };
          onSave(mockV);
          count++;
        }
      }
    });

    setIsImporting(false);
    setImportText('');
    alert(`Successfully processed and imported ${count} supplier records.`);
  };

  const filteredVendors = vendors.filter(v => {
    if (v.is_deleted) return false;
    
    const matchesSearch = 
      v.trade_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.id_code.includes(searchTerm);

    const matchesCity = !selectedCity || v.city === selectedCity;
    const matchesDistrict = !selectedDistrict || v.district === selectedDistrict;

    return matchesSearch && matchesCity && matchesDistrict;
  });

  // Custom Delete Confirmation handler
  const askDelete = (id: string, name: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId, deleteConfirmName || '');
    }
    setDeleteConfirmId(null);
    setDeleteConfirmName(null);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER WITH INTEGRATED ACTION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5 select-none text-left">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Suppliers</h2>
          <p className="text-xs text-gray-500 mt-1 font-sans">
            {editingVendor 
              ? (isNew ? 'Creating supplier' : `Editing: ${editingVendor.trade_name}`)
              : 'Manage commercial biodiesel suppliers, purchase pricing rates, bank account targets, and contact lists.'
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          {editingVendor ? (
            <>
              <button 
                onClick={() => setEditingVendor(null)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 font-bold rounded-xl text-xs text-gray-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                Save
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setIsImporting(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                title="Import suppliers from spreadsheet files"
              >
                <FileSpreadsheet size={15} />
                Bulk Import
              </button>
              
              <button 
                id="btn-add-new-vendor"
                onClick={startNew}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-950 transition cursor-pointer shadow-xs"
              >
                <Plus size={15} />
                Add Supplier
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. FORM OR LIST SPREADSHEET CANVAS */}
      {editingVendor ? (
        <div className="animate-in fade-in duration-200 max-w-4xl" id="vendors-form-panel">
          {errorMessage && (
            <div className="mb-5 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-sans font-medium text-left">
              <ShieldAlert size={14} className="text-red-650" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Layout: Relaxed, beautiful top-to-bottom vertical single column flow */}
          <div className="space-y-6 pt-2 text-left">
            
            <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
              <span className="text-xs font-black uppercase text-gray-400 tracking-wider block border-b pb-2">Core Supplier Parameters</span>
              
              {/* Trade / Commercial Name floating label */}
              <div className="relative">
                <input 
                  type="text"
                  id="v-trade-name"
                  placeholder=" "
                  value={editingVendor.trade_name}
                  onChange={(e) => setEditingVendor({...editingVendor, trade_name: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
                />
                <label 
                  htmlFor="v-trade-name" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-700 font-bold select-none pointer-events-none"
                >
                  Trade/Commercial Name *
                </label>
              </div>

              {/* Legal Name / Company Name */}
              <div className="relative">
                <input 
                  type="text"
                  id="v-company-name"
                  placeholder=" "
                  value={editingVendor.company_name}
                  onChange={(e) => setEditingVendor({...editingVendor, company_name: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
                />
                <label 
                  htmlFor="v-company-name" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-700 font-bold select-none pointer-events-none"
                >
                  Legal/Registered Name (Company Name)
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Identification Code */}
                <div className="relative">
                  <input 
                    type="text"
                    id="v-id-code"
                    placeholder=" "
                    value={editingVendor.id_code}
                    onChange={(e) => setEditingVendor({...editingVendor, id_code: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
                  />
                  <label 
                    htmlFor="v-id-code" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-700 font-bold select-none pointer-events-none"
                  >
                    Identification Code *
                  </label>
                </div>

                {/* Current Price per liter */}
                <div className="relative">
                  <input 
                    type="number"
                    step="0.01"
                    id="v-price"
                    placeholder=" "
                    value={editingVendor.price_per_liter || ''}
                    onChange={(e) => setEditingVendor({...editingVendor, price_per_liter: parseFloat(e.target.value) || 0})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
                  />
                  <label 
                    htmlFor="v-price" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-700 font-bold select-none pointer-events-none"
                  >
                    Base Price per Liter (₾) *
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank account details */}
                <div className="relative">
                  <input 
                    type="text"
                    id="v-bank"
                    placeholder=" "
                    value={editingVendor.bank_account}
                    onChange={(e) => setEditingVendor({...editingVendor, bank_account: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono transition-all"
                  />
                  <label 
                    htmlFor="v-bank" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-700 font-bold select-none pointer-events-none"
                  >
                    IBAN / Bank Account
                  </label>
                </div>

                {/* Working hours notch */}
                <div className="relative">
                  <input 
                    type="text"
                    id="v-hours"
                    placeholder=" "
                    value={editingVendor.working_hours}
                    onChange={(e) => setEditingVendor({...editingVendor, working_hours: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
                  />
                  <label 
                    htmlFor="v-hours" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-700 font-bold select-none pointer-events-none"
                  >
                    Working Hours (Schedule)
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* City selection with notch styling */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
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
                    }}
                    className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
                  >
                    <option value="" disabled>--- SELECT CITY ---</option>
                    {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                {/* District selection with notch styling */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                    District *
                  </span>
                  <select
                    value={editingVendor.district}
                    onChange={(e) => setEditingVendor({...editingVendor, district: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
                  >
                    <option value="" disabled>--- SELECT DISTRICT ---</option>
                    {districts
                      .filter(d => {
                        const cObj = cities.find(x => x.name === editingVendor.city);
                        return !cObj || d.city_id === cObj.id;
                      })
                      .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
                    }
                  </select>
                </div>
              </div>

              {/* Address Floating notch */}
              <div className="relative">
                <input 
                  type="text"
                  id="v-address"
                  placeholder=" "
                  value={editingVendor.address}
                  onChange={(e) => setEditingVendor({...editingVendor, address: e.target.value})}
                  className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans transition-all"
                />
                <label 
                  htmlFor="v-address" 
                  className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-700 font-bold select-none pointer-events-none"
                >
                  Exact Address (Details, Floor, Entry)
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Assigned base warehouse notch dropdown */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                    Assigned Base Warehouse *
                  </span>
                  <select
                    value={editingVendor.warehouse_id}
                    onChange={(e) => setEditingVendor({...editingVendor, warehouse_id: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
                  >
                    <option value="" disabled>--- SELECT WAREHOUSE ---</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>

                {/* Acquisition Manager notch dropdown */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                    Acquisition Manager *
                  </span>
                  <select
                    value={editingVendor.manager_id}
                    onChange={(e) => setEditingVendor({...editingVendor, manager_id: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
                  >
                    <option value="" disabled>--- SELECT MANAGER ---</option>
                    {users.filter(u => u.role === 'manager').map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                    {users.filter(u => u.role === 'manager').length === 0 && (
                      <option value={currentUser.id}>{currentUser.name} (Ad hoc)</option>
                    )}
                  </select>
                </div>

                {/* Systems Dispatcher notch dropdown */}
                <div className="relative">
                  <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                    Systems Dispatcher *
                  </span>
                  <select
                    value={editingVendor.operator_id}
                    onChange={(e) => setEditingVendor({...editingVendor, operator_id: e.target.value})}
                    className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-200 focus:border-emerald-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans cursor-pointer relative"
                  >
                    <option value="" disabled>--- SELECT DISPATCHER ---</option>
                    {users.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contacts & Comments Sections placed directly at the bottom of the form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              
              {/* Contact Personnel Section inside main form */}
              <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b pb-2 mb-4">
                    <span className="text-xs font-black uppercase text-gray-500 tracking-wider font-sans">Supplier Contact Persons</span>
                    <button
                      type="button"
                      onClick={() => openContactModal()}
                      className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border text-slate-700 font-black rounded-lg transition inline-flex items-center gap-1 select-none cursor-pointer"
                    >
                      <Plus size={12} /> Add Contact
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {tempContacts.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs transition">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-800">{c.name}</span>
                            <span className="text-[9px] text-indigo-700 capitalize bg-indigo-50/55 px-1.5 py-0.2 rounded font-sans font-semibold">
                              {c.position}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-emerald-800 font-bold mt-0.5">{c.phone}</p>
                          {c.note && <span className="text-[10px] text-gray-400 block max-w-sm truncate">Note: {c.note}</span>}
                        </div>

                        <div className="flex items-center gap-1 select-none">
                          <button 
                            type="button"
                            onClick={() => handleSetDefaultContact(c.id)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                              c.is_default ? 'bg-emerald-50 border-emerald-200 text-emerald-850 font-black' : 'bg-white text-gray-400 hover:text-gray-700'
                            }`}
                          >
                            Default
                          </button>
                          <button
                            type="button"
                            onClick={() => openContactModal(c)}
                            className="p-1 text-gray-400 hover:text-emerald-700 transition cursor-pointer"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveContact(c.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {tempContacts.length === 0 && (
                      <div className="text-center py-10 text-[10px] text-gray-400 italic">No contact personnel added.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Comments ledger Section */}
              <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b pb-2 mb-4">
                    <span className="text-xs font-black uppercase text-gray-500 tracking-wider font-sans">Comments</span>
                    <button
                      type="button"
                      onClick={() => openCommentModal()}
                      className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border text-slate-700 font-black rounded-lg transition inline-flex items-center gap-1 select-none cursor-pointer"
                    >
                      <Plus size={12} /> Add Comment
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {editingVendor.comments?.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-[9px] text-gray-400 font-mono">
                            <span className="font-sans font-black text-slate-700">{c.user_name}</span>
                            <span>{new Date(c.date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-gray-700 text-[11px] leading-relaxed break-words">{c.comment}</p>
                        </div>

                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openCommentModal(c)}
                            className="p-1 text-gray-400 hover:text-emerald-700 transition cursor-pointer"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveComment(c.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!editingVendor.comments || editingVendor.comments.length === 0) && (
                      <div className="text-center py-10 text-[10px] text-gray-400 italic">No specific comments recorded.</div>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4.5 shadow-xs flex flex-col md:flex-row gap-3 select-none text-left">
            <div className="flex-1 relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Search size={15} />
              </span>
              <input 
                type="text"
                placeholder="Filter suppliers by trade name, legal name, or identification code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none transition"
              />
            </div>

            <div className="w-full md:w-44">
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setSelectedDistrict('');
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:outline-none cursor-pointer"
              >
                <option value="">All Cities</option>
                {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>

            <div className="w-full md:w-44">
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                disabled={!selectedCity}
                className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:outline-none disabled:opacity-50 cursor-pointer"
              >
                <option value="">All Districts</option>
                {districts
                  .filter(d => {
                    const cityObj = cities.find(c => c.name === selectedCity);
                    return !cityObj || d.city_id === cityObj.id;
                  })
                  .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
                }
              </select>
            </div>
          </div>

          {/* SPREADSHEET TABLE */}
          <div className="bg-white rounded-2xl border border-gray-150 shadow-xs overflow-hidden text-left">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-xs text-left text-gray-700 relative border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-50 shadow-xs border-b border-gray-150">
                  <tr className="text-[10px] text-gray-400 uppercase font-mono">
                    <th className="py-3 px-4 font-bold bg-slate-50 min-w-[140px]">Trade Name</th>
                    <th className="py-3 px-4 bg-slate-50 min-w-[200px]">Legal Name</th>
                    <th className="py-3 px-4 bg-slate-50 min-w-[125px]">Identification Code</th>
                    <th className="py-3 px-4 bg-slate-50 min-w-[140px]">City & District</th>
                    <th className="py-3 px-4 bg-slate-50 min-w-[100px]">Price per Liter</th>
                    <th className="py-3 px-4 bg-slate-50 min-w-[180px]">Primary Contact</th>
                    <th className="py-3 px-4 bg-slate-50 min-w-[140px]">Latest Comment</th>
                    <th className="py-3 px-4 bg-slate-50 text-right min-w-[90px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredVendors.map((vendor) => {
                    const defaultContact = vendor.contacts?.find(c => c.is_default) || vendor.contacts?.[0];
                    const latestComment = vendor.comments?.[0];

                    return (
                      <tr key={vendor.id} className="hover:bg-slate-50/50 text-xs transition-colors">
                        <td className="py-3 px-4 font-extrabold text-gray-900">
                          {vendor.trade_name}
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-medium">
                          {vendor.company_name || vendor.trade_name}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-gray-500">
                          {vendor.id_code}
                        </td>
                        <td className="py-3 px-4 font-sans text-xs">
                          <span className="font-bold text-gray-700 block">{vendor.city} ({vendor.district})</span>
                          <span className="text-[10px] text-gray-400 block truncate max-w-[130px]">{vendor.address}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-extrabold text-emerald-800 text-[12.5px]">
                          {vendor.price_per_liter.toFixed(2)} ₾
                        </td>
                        <td className="py-3 px-4 font-sans text-[11px]">
                          {defaultContact ? (
                            <div>
                              <span className="font-extrabold text-gray-800 block">{defaultContact.name}</span>
                              <span className="text-emerald-800 font-mono font-bold block bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-0.5">{defaultContact.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-600 block italic bg-amber-50 rounded px-1.5 py-0.5 w-fit">No contacts</span>
                          )}
                        </td>

                        {/* Comment section: Shows beginning of the latest comment, beautiful custom hover popup for full details */}
                        <td className="py-3 px-4 text-left relative group select-none min-w-[140px]">
                          {latestComment ? (
                            <div className="cursor-pointer max-w-[140px]">
                              <p className="truncate font-sans text-gray-650 inline-flex items-center gap-1">
                                <MessageSquare size={11} className="text-purple-400" />
                                {latestComment.comment}
                              </p>
                              
                              {/* Hover Tooltip display full comments beautifully */}
                              <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white rounded-xl p-3 shadow-xl text-[11px] leading-relaxed z-40 space-y-2 pointer-events-none border border-slate-700">
                                <p className="font-bold font-sans border-b border-slate-700 pb-1 text-[10px] text-purple-300">
                                  Comments Ledger ({vendor.comments?.length || 0})
                                </p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {vendor.comments?.map(c => (
                                    <div key={c.id} className="border-b border-slate-800 last:border-0 pb-1">
                                      <div className="flex justify-between items-center text-[9px] text-gray-400">
                                        <span>{c.user_name}</span>
                                        <span>{new Date(c.date).toLocaleDateString()}</span>
                                      </div>
                                      <p className="mt-0.5 font-sans break-words">{c.comment}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">No comments</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-1 select-none">
                            <button 
                              onClick={() => startEdit(vendor)}
                              className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                              title="Edit supplier properties"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button 
                              onClick={() => askDelete(vendor.id, vendor.trade_name)}
                              className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                              title="Soft delete supplier"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredVendors.length === 0 && (
              <div className="text-center py-20 text-xs text-gray-400 italic">
                No supplier data matches current search criteria.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. EXCEL BULK IMPORT MODAL */}
      {isImporting && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-150 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                <FileSpreadsheet className="text-emerald-700" size={16} />
                Import Data from Excel File
              </h3>
              <button onClick={() => setIsImporting(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed font-sans text-left">
              Copy and paste columns directly from Excel (Format: <strong>Trade Name, Legal Name, Identification Code</strong> separated by TAB or commas).
            </p>

            <textarea 
              rows={8}
              placeholder="e.g. Traditional Georgian Biodiesel, Bio-Petrol LLC, 204857392"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            ></textarea>

            <div className="flex items-center justify-end gap-2.5 select-none">
              <button 
                onClick={() => setIsImporting(false)} 
                className="px-3.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleImportExcel}
                className="px-4 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-950 transition inline-flex items-center gap-1 cursor-pointer"
              >
                Launch Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EXPLICIT CONTACT MODAL (SMALL OVERLAY) */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wide">
                {activeContact ? '✏️ Edit Contact Person' : '✨ Add Contact Person'}
              </h4>
              <button onClick={() => setIsContactModalOpen(false)} className="p-1 hover:bg-slate-50 rounded text-gray-400">
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3.5 text-left">
              <div className="relative">
                <input 
                  type="text" 
                  id="cm-name"
                  placeholder=" "
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="peer block w-full px-3 py-4 pt-4 pb-1.5 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
                <label htmlFor="cm-name" className="absolute text-[9px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3 top-3 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-focus:scale-95 peer-focus:-translate-y-3 peer-focus:text-emerald-705 font-bold pointer-events-none">
                  Contact Name *
                </label>
              </div>

              <div className="relative">
                <input 
                  type="text" 
                  id="cm-phone"
                  placeholder=" "
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="peer block w-full px-3 py-4 pt-4 pb-1.5 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-none font-mono"
                />
                <label htmlFor="cm-phone" className="absolute text-[9px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3 top-3 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-focus:scale-95 peer-focus:-translate-y-3 peer-focus:text-emerald-705 font-bold pointer-events-none">
                  Mobile Phone Number *
                </label>
              </div>

              <div className="relative">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-white select-none z-10">
                  Position / Role
                </span>
                <select
                  value={contactPos}
                  onChange={(e) => setContactPos(e.target.value as any)}
                  className="block w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-sans cursor-pointer focus:outline-none"
                >
                  <option value="accountant">Accountant</option>
                  <option value="director">Director/Owner</option>
                  <option value="operator">Operations Mgr</option>
                  <option value="other">Other Position</option>
                </select>
              </div>

              <div className="relative">
                <input 
                  type="text" 
                  id="cm-note"
                  placeholder=" "
                  value={contactNote}
                  onChange={(e) => setContactNote(e.target.value)}
                  className="peer block w-full px-3 py-4 pt-4 pb-1.5 bg-white border border-gray-200 focus:border-emerald-600 rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                />
                <label htmlFor="cm-note" className="absolute text-[9px] text-gray-400 bg-white px-1 leading-none transition-all duration-150 transform -translate-y-3 top-3 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0.5 peer-focus:scale-95 peer-focus:-translate-y-3 peer-focus:text-emerald-705 font-bold pointer-events-none">
                  Short Note (e.g. call instructions)
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
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
                className="px-4 py-1.5 bg-emerald-805 bg-emerald-800 hover:bg-emerald-950 text-white rounded-lg text-xs font-bold transition select-none cursor-pointer"
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
                {activeComment ? '✏️ Edit Comment' : '✨ Post Comment'}
              </h4>
              <button onClick={() => setIsCommentModalOpen(false)} className="p-1 hover:bg-slate-50 rounded text-gray-400">
                <X size={14} />
              </button>
            </div>

            <div className="text-left space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Comment content</label>
              <textarea 
                rows={4}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write specific supplier memo here..."
                className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              ></textarea>
            </div>

            <div className="flex gap-2.5 justify-end pt-1">
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
                className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-950 text-white rounded-lg text-xs font-bold transition select-none cursor-pointer"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. SYSTEM CUSTOM DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="mx-auto w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-sm text-gray-950">Are you sure you want to delete?</h3>
              <p className="text-xs text-gray-450 leading-relaxed font-sans">
                You are about to soft delete supplier <strong>"{deleteConfirmName}"</strong> from systems logs. Active dispatch coordinates and billing will be frozen.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2 select-none">
              <button 
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteConfirmName(null);
                }} 
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
