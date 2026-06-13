import React, { useState } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../types';
import { 
  Search, Plus, Edit3, Trash2, FileSpreadsheet, 
  X, Phone, CheckCircle2, ShieldAlert
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

  // Callback props for lookups if needed (optional)
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

  // Contacts temp creation helper state
  const [tempContacts, setTempContacts] = useState<VendorContact[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactPos, setNewContactPos] = useState<'accountant' | 'director' | 'operator' | 'other'>('accountant');
  const [newContactNote, setNewContactNote] = useState('');

  // Comment helper state
  const [newCommentText, setNewCommentText] = useState('');

  const startEdit = (vendor: Vendor) => {
    setErrorMessage(null);
    setEditingVendor(JSON.parse(JSON.stringify(vendor)));
    setTempContacts(vendor.contacts || []);
    setIsNew(false);
    setNewCommentText('');
  };

  const startNew = () => {
    setErrorMessage(null);
    const defaultVendor: Vendor = {
      id: '',
      id_code: '',
      company_name: '',
      trade_name: '',
      company_code: 'BIO-' + Math.floor(1000 + Math.random() * 9000),
      bank_account: '',
      city: cities[0]?.name || 'Tbilisi',
      district: districts.filter(d => d.city_id === cities[0]?.id)[0]?.name || 'Saburtalo',
      address: '',
      price_per_liter: 1.40,
      warehouse_id: warehouses[0]?.id || '',
      manager_id: users.find(e => e.role === 'manager')?.id || currentUser.id,
      operator_id: currentUser.id,
      contacts: [],
      comments: [],
      working_hours: '09:00 - 18:00',
      created_at: new Date().toISOString()
    };
    setEditingVendor(defaultVendor);
    setTempContacts([]);
    setIsNew(true);
    setNewCommentText('');
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    const isFirst = tempContacts.length === 0;
    const contact: VendorContact = {
      id: 'cont-' + Math.random().toString(36).substring(2, 9),
      name: newContactName,
      phone: newContactPhone,
      position: newContactPos,
      note: newContactNote,
      is_default: isFirst ? true : false
    };
    setTempContacts([...tempContacts, contact]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactNote('');
  };

  const handleRemoveContact = (id: string) => {
    setTempContacts(tempContacts.filter(c => c.id !== id));
  };

  const handleSetDefaultContact = (id: string) => {
    setTempContacts(tempContacts.map(c => ({
      ...c,
      is_default: c.id === id
    })));
  };

  const handleAddComment = () => {
    if (!newCommentText.trim() || !editingVendor) return;
    const newComment: VendorComment = {
      id: 'comm-' + Math.random().toString(36).substring(2, 9),
      comment: newCommentText,
      date: new Date().toISOString(),
      user_name: currentUser.name
    };
    setEditingVendor({
      ...editingVendor,
      comments: [newComment, ...(editingVendor.comments || [])]
    });
    setNewCommentText('');
  };

  const handleSaveAll = () => {
    if (!editingVendor) return;
    setErrorMessage(null);

    if (!editingVendor.trade_name.trim()) {
      setErrorMessage('Trade/Commercial Name is required.');
      return;
    }
    if (!editingVendor.id_code.trim()) {
      setErrorMessage('Tax Identification Code (ID Code) is required.');
      return;
    }

    const payload: Vendor = {
      ...editingVendor,
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
            company_code: 'BIO-' + Math.floor(1000 + Math.random() * 9000),
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
    if (v.is_deleted) return false; // Hard rule: do not display soft deleted items
    
    // search text match
    const matchesSearch = 
      v.trade_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.id_code.includes(searchTerm) ||
      v.company_code.includes(searchTerm);

    // city district matches
    const matchesCity = !selectedCity || v.city === selectedCity;
    const matchesDistrict = !selectedDistrict || v.district === selectedDistrict;

    return matchesSearch && matchesCity && matchesDistrict;
  });

  // architecture view replacement if form is visible
  if (editingVendor) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200" id="vendors-form-panel">
        <div className="bg-white border rounded-2xl shadow-sm flex flex-col relative overflow-hidden max-w-5xl min-h-[500px]">
          
          {/* Sticky header containing Action with Cancel & Save */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100 py-3.5 px-6 flex justify-between items-center select-none">
            <div>
              <h3 className="font-extrabold text-gray-950 text-sm">
                {isNew ? '✨ Creating supplier' : `✏️ Editing: ${editingVendor.trade_name}`}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5 font-sans">
                {isNew ? 'Fill in commercial entity parameters to save' : `Update supplier properties and save changes`}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setEditingVendor(null)}
                className="px-4 py-2 bg-white border border-gray-250 hover:bg-slate-50 font-bold rounded-xl text-xs text-gray-700 transition cursor-pointer select-none"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveAll}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
              >
                Save
              </button>
            </div>
          </div>

          <div className="p-6">
            {errorMessage && (
              <div className="mb-5 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl flex items-center gap-2 font-sans font-medium">
                <ShieldAlert size={14} className="text-red-650" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Relaxed 2-column layout but elements on left and relaxed spaced design */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Core Fields (Take 7 spans) */}
              <div className="lg:col-span-7 space-y-5 max-w-xl">
                
                {/* Trade / Commercial Name floating label */}
                <div className="relative">
                  <input 
                    type="text"
                    id="v-trade-name"
                    placeholder=" "
                    value={editingVendor.trade_name}
                    onChange={(e) => setEditingVendor({...editingVendor, trade_name: e.target.value})}
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans transition-all"
                  />
                  <label 
                    htmlFor="v-trade-name" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                  >
                    Trade / Commercial Name *
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
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans transition-all"
                  />
                  <label 
                    htmlFor="v-company-name" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                  >
                    Legal/Registered Name (Company Name)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Tax Identification Code */}
                  <div className="relative">
                    <input 
                      type="text"
                      id="v-id-code"
                      placeholder=" "
                      value={editingVendor.id_code}
                      onChange={(e) => setEditingVendor({...editingVendor, id_code: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                    />
                    <label 
                      htmlFor="v-id-code" 
                      className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                    >
                      Tax Identification Code (ID) *
                    </label>
                  </div>

                  {/* Company/Registry Code */}
                  <div className="relative">
                    <input 
                      type="text"
                      id="v-company-code"
                      placeholder=" "
                      value={editingVendor.company_code}
                      onChange={(e) => setEditingVendor({...editingVendor, company_code: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                    />
                    <label 
                      htmlFor="v-company-code" 
                      className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                    >
                      State Registry Code
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Current Price per liter */}
                  <div className="relative">
                    <input 
                      type="number"
                      step="0.01"
                      id="v-price"
                      placeholder=" "
                      value={editingVendor.price_per_liter}
                      onChange={(e) => setEditingVendor({...editingVendor, price_per_liter: parseFloat(e.target.value) || 0})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                    />
                    <label 
                      htmlFor="v-price" 
                      className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                    >
                      Base Price per Liter (₾) *
                    </label>
                  </div>

                  {/* Bank account details */}
                  <div className="relative">
                    <input 
                      type="text"
                      id="v-bank"
                      placeholder=" "
                      value={editingVendor.bank_account}
                      onChange={(e) => setEditingVendor({...editingVendor, bank_account: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-mono transition-all"
                    />
                    <label 
                      htmlFor="v-bank" 
                      className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                    >
                      IBAN / Bank Account
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* City selection with notch styling */}
                  <div className="relative">
                    <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10">
                      City
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
                      className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                    >
                      {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>

                  {/* District selection with notch styling */}
                  <div className="relative">
                    <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                      District
                    </span>
                    <select
                      value={editingVendor.district}
                      onChange={(e) => setEditingVendor({...editingVendor, district: e.target.value})}
                      className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                    >
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
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans transition-all"
                  />
                  <label 
                    htmlFor="v-address" 
                    className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                  >
                    Exact Address (Details, Floor, Entry)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Assigned base warehouse notch dropdown */}
                  <div className="relative">
                    <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                      Assigned Base Warehouse
                    </span>
                    <select
                      value={editingVendor.warehouse_id}
                      onChange={(e) => setEditingVendor({...editingVendor, warehouse_id: e.target.value})}
                      className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                    >
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>

                  {/* Working hours notch */}
                  <div className="relative">
                    <input 
                      type="text"
                      id="v-hours"
                      placeholder=" "
                      value={editingVendor.working_hours}
                      onChange={(e) => setEditingVendor({...editingVendor, working_hours: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans transition-all"
                    />
                    <label 
                      htmlFor="v-hours" 
                      className="absolute text-[10px] text-gray-400 bg-white px-1 leading-none transition-all duration-155 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-gray-400 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-indigo-600 font-bold select-none pointer-events-none"
                    >
                      Working Hours (Schedule)
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Acquisition Manager notch dropdown */}
                  <div className="relative">
                    <span className="absolute -top-1.5 left-3 px-1 text-[10px] font-bold text-gray-400 bg-white select-none z-10 font-sans">
                      Acquisition Manager
                    </span>
                    <select
                      value={editingVendor.manager_id}
                      onChange={(e) => setEditingVendor({...editingVendor, manager_id: e.target.value})}
                      className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                    >
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
                      Systems Dispatcher
                    </span>
                    <select
                      value={editingVendor.operator_id}
                      onChange={(e) => setEditingVendor({...editingVendor, operator_id: e.target.value})}
                      className="block w-full px-3.5 py-3 text-xs bg-white border border-gray-250 focus:border-indigo-600 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-600 font-sans cursor-pointer relative"
                    >
                      {users.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* Right Column: Interaction segments (Contacts, Comments ledger) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Supplier Contacts Desk */}
                <div className="bg-slate-50 border p-4.5 rounded-2xl space-y-3.5 shadow-2xs">
                  <span className="text-[11px] font-black tracking-wider text-indigo-900 uppercase block border-b pb-1 font-sans">
                    Supplier Contact Persons
                  </span>

                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Contact Name"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs focus:outline-none"
                    />
                    <input 
                      type="text" 
                      placeholder="Mobile Phone Number"
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-xs font-mono focus:outline-none"
                    />
                    
                    <div className="flex gap-2.5">
                      <select
                        value={newContactPos}
                        onChange={(e) => setNewContactPos(e.target.value as any)}
                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-sans cursor-pointer"
                      >
                        <option value="accountant">Accountant</option>
                        <option value="director">Director/Owner</option>
                        <option value="operator">Operations Mgr</option>
                        <option value="other">Other Position</option>
                      </select>
                      
                      <button 
                        type="button"
                        onClick={handleAddContact}
                        className="px-5 bg-indigo-700 hover:bg-indigo-850 text-white rounded-xl text-xs font-semibold transition cursor-pointer select-none"
                      >
                        Add
                      </button>
                    </div>

                    <input 
                      type="text"
                      placeholder="Short Note (e.g. Call after 2:00 PM)"
                      value={newContactNote}
                      onChange={(e) => setNewContactNote(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none"
                    />
                  </div>

                  {/* Form Contact cards roster */}
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {tempContacts.map((c) => (
                      <div key={c.id} className="p-2.5 bg-white border border-gray-150 rounded-xl flex items-center justify-between text-xs transition">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-800">{c.name}</span>
                            <span className="text-[9px] text-gray-400 capitalize bg-slate-50 px-1.5 py-0.2 rounded border">
                              {c.position}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-emerald-800 font-bold mt-0.5">{c.phone}</p>
                          {c.note && <span className="text-[10px] text-gray-400 block font-mono">Note: {c.note}</span>}
                        </div>

                        <div className="flex items-center gap-2 select-none">
                          <button 
                            type="button"
                            onClick={() => handleSetDefaultContact(c.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                              c.is_default ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gray-50 text-gray-400 hover:text-gray-750'
                            }`}
                          >
                            Default
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleRemoveContact(c.id)}
                            className="p-1 hover:bg-rose-50 text-rose-500 rounded transition cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {tempContacts.length === 0 && (
                      <div className="text-center py-4 text-[10px] text-gray-400 italic">No contact personnel added yet.</div>
                    )}
                  </div>
                </div>

                {/* Log Book Comments & Dispatch Notes */}
                <div className="bg-purple-50/20 border border-purple-100 p-4.5 rounded-2xl space-y-3.5">
                  <span className="text-[11px] font-black tracking-wider text-purple-900 uppercase block border-b pb-1 font-sans">
                    Log Book Comments & Dispatch Notes
                  </span>

                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Add logging comment to supplier ledger..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-grow px-3 py-2 bg-white border border-gray-200 focus:border-purple-500 rounded-xl text-xs focus:outline-none"
                    />
                    <button 
                      type="button" 
                      onClick={handleAddComment}
                      className="px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition cursor-pointer select-none"
                    >
                      Post
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {editingVendor.comments?.map((c) => (
                      <div key={c.id} className="p-2.5 bg-white border border-purple-150/70 rounded-xl text-[11px] space-y-1">
                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono">
                          <span className="font-sans font-extrabold text-purple-900">{c.user_name}</span>
                          <span>{new Date(c.date).toLocaleString('en-US')}</span>
                        </div>
                        <p className="text-gray-700 font-sans leading-relaxed">{c.comment}</p>
                      </div>
                    ))}
                    {(!editingVendor.comments || editingVendor.comments.length === 0) && (
                      <p className="text-center py-4 text-[10px] text-gray-400 italic">No specific log comments recorded.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>
      </div>
    );
  }

  // default primary screen showing full list spreadsheet if not editing/creating
  return (
    <div className="space-y-6" id="vendors-view-panel">
      
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Suppliers Register</h2>
          <p className="text-xs text-gray-550 mt-1 font-sans">
            Manage commercial biodiesel suppliers, purchase pricing rates, bank account targets, and contact lists.
          </p>
        </div>

        <div className="flex items-center gap-2 select-none">
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
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4.5 shadow-xs flex flex-col md:flex-row gap-3 select-none">
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
            <Search size={15} />
          </span>
          <input 
            type="text"
            placeholder="Filter suppliers by trade name, legal name, tax code or registry code..."
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

      {/* SPREADSHEET HORIZONTALLY SCROLLABLE TABLE WITH FIXED LORE HEADER */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs text-left text-gray-700 relative border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 shadow-xs border-b border-gray-150">
              <tr className="text-[10px] text-gray-450 uppercase font-mono">
                {/* Fixed columns with specified min-widths so they remain scrollable but separate */}
                <th className="py-3 px-4 font-bold bg-slate-50 min-w-[140px]">Trade Name</th>
                <th className="py-3 px-4 bg-slate-50 min-w-[200px]">Legal Name / Company Name</th>
                <th className="py-3 px-4 bg-slate-50 min-w-[100px]">Registry Code</th>
                <th className="py-3 px-4 bg-slate-50 min-w-[110px]">Tax ID Code</th>
                <th className="py-3 px-4 bg-slate-50 min-w-[140px]">City & District</th>
                <th className="py-3 px-4 bg-slate-50 min-w-[100px]">Price per Liter</th>
                <th className="py-3 px-4 bg-slate-50 min-w-[180px]">Primary Contact</th>
                <th className="py-3 px-4 bg-slate-50 min-w-[60px] text-center">Comments</th>
                <th className="py-3 px-4 bg-slate-50 text-right min-w-[90px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVendors.map((vendor) => {
                const defaultContact = vendor.contacts?.find(c => c.is_default) || vendor.contacts?.[0];
                return (
                  <tr key={vendor.id} className="hover:bg-slate-50/50 text-xs transition-colors">
                    
                    {/* Separate Column 1: Trade Name */}
                    <td className="py-3 px-4 font-extrabold text-gray-900">
                      {vendor.trade_name}
                    </td>

                    {/* Separate Column 2: Legal Name */}
                    <td className="py-3 px-4 text-gray-650 font-medium">
                      {vendor.company_name || vendor.trade_name}
                    </td>

                    {/* Separate Column 3: Registry Code */}
                    <td className="py-3 px-4 font-mono font-bold text-gray-500">
                      {vendor.company_code}
                    </td>

                    {/* Separate Column 4: Tax ID */}
                    <td className="py-3 px-4 font-mono">
                      {vendor.id_code}
                    </td>

                    {/* City and details */}
                    <td className="py-3 px-4 font-sans text-xs">
                      <span className="font-bold text-gray-700 block">{vendor.city} ({vendor.district})</span>
                      <span className="text-[10px] text-gray-400 block truncate max-w-[130px]">{vendor.address}</span>
                    </td>

                    {/* Price column with restored elegant system styling (reverted from plain green column header, looking cohesive) */}
                    <td className="py-3 px-4 font-mono font-extrabold text-emerald-800 text-[12.5px]">
                      {vendor.price_per_liter.toFixed(2)} ₾
                    </td>

                    {/* Contact Person */}
                    <td className="py-3 px-4 font-sans text-[11px]">
                      {defaultContact ? (
                        <div>
                          <span className="font-extrabold text-gray-800 block">{defaultContact.name}</span>
                          <span className="text-emerald-800 font-mono font-bold block bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-0.5 mt-[1px]">{defaultContact.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-600 block italic bg-amber-50 rounded px-1.5 py-0.5 w-fit">No contacts</span>
                      )}
                    </td>

                    {/* Comment count */}
                    <td className="py-3 px-4 text-center font-mono select-none">
                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-750 font-bold rounded text-[10px]">
                        {vendor.comments?.length || 0}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1 select-none">
                        <button 
                          onClick={() => startEdit(vendor)}
                          className="p-1.5 text-gray-400 hover:text-emerald-750 hover:text-emerald-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                          title="Edit supplier properties"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button 
                          onClick={() => onDelete(vendor.id, vendor.trade_name)}
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

      {/* BULK IMPORT MODAL */}
      {isImporting && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-150">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2 bg-slate-50 p-2.5 rounded-t-xl">
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                <FileSpreadsheet className="text-emerald-700" size={16} />
                Import Data from Excel File
              </h3>
              <button onClick={() => setIsImporting(false)} className="text-gray-400 hover:text-gray-655 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
              Copy and paste columns directly from Excel (Format: <strong>Trade Name, Legal Name, Tax ID Code</strong> separated by TAB or commas).
            </p>

            <textarea 
              rows={8}
              placeholder="e.g. Traditional Georgian Khinkali LLC, 204857392"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            ></textarea>

            <div className="flex items-center justify-end gap-2.5 select-none">
              <button 
                onClick={() => setIsImporting(false)} 
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleImportExcel}
                className="px-4 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-900 transition inline-flex items-center gap-1 cursor-pointer"
              >
                Launch Import
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
