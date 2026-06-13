import React, { useState } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../types';
import { 
  Search, Plus, Edit3, Trash2, FileSpreadsheet, 
  Check, X, Phone, User as UserIcon, MessageSquare, Clock, ArrowRight,
  Database, UserCheck, CheckCircle2, ShieldAlert
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
    setTimeout(() => {
      document.getElementById('vendor-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
    setTimeout(() => {
      document.getElementById('vendor-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

    const final: Vendor = {
      ...editingVendor,
      company_code: editingVendor.company_code || 'BIO-' + Math.floor(1000 + Math.random() * 9000),
      contacts: tempContacts
    };
    onSave(final);
    setEditingVendor(null);
  };

  // Excel simulation import
  const handleImportExcel = () => {
    if (!importText.trim()) return;
    try {
      const lines = importText.split('\n');
      let importCount = 0;
      
      lines.forEach((line) => {
        const parts = line.split(/[\t,]/);
        if (parts.length >= 3) {
          const tradeName = parts[0].trim();
          const legalName = parts[1].trim();
          const idCode = parts[2].trim();
          const code = 'V-' + Math.floor(100 + Math.random() * 900);
          const address = parts[3]?.trim() || 'Tbilisi, Georgia';
          
          if (tradeName && idCode) {
            const rawVendor: Vendor = {
              id: 'vendor-' + Math.random().toString(36).substring(2, 9),
              id_code: idCode,
              company_name: legalName || tradeName,
              trade_name: tradeName,
              company_code: code,
              bank_account: 'GE00TB0000000000000000',
              city: cities[0]?.name || 'Tbilisi',
              district: districts.filter(d => d.city_id === cities[0]?.id)[0]?.name || 'Saburtalo',
              address: address,
              price_per_liter: 1.5,
              warehouse_id: warehouses[0]?.id || '',
              manager_id: users.find(e => e.role === 'manager')?.id || currentUser.id,
              operator_id: currentUser.id,
              contacts: [],
              comments: [{
                id: 'c-1',
                comment: 'Imported from spreadsheet format',
                date: new Date().toISOString(),
                user_name: currentUser.name
              }],
              working_hours: '10:00 - 20:00',
              created_at: new Date().toISOString()
            };
            onSave(rawVendor);
            importCount++;
          }
        }
      });
      alert(`Imported ${importCount} suppliers successfully!`);
      setIsImporting(false);
      setImportText('');
    } catch (e) {
      alert('Error importing data from Excel. Verify column structure.');
    }
  };

  // Filter logic
  const filteredVendors = vendors.filter(v => {
    const matchesSearch = v.trade_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           v.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           v.company_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           v.id_code.includes(searchTerm);
    const matchesCity = selectedCity === '' || v.city === selectedCity;
    const matchesDistrict = selectedDistrict === '' || v.district === selectedDistrict;
    return matchesSearch && matchesCity && matchesDistrict;
  });

  return (
    <div className="space-y-6" id="vendors-view-panel">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 tracking-tight font-sans">Suppliers Directory</h2>
          <p className="text-xs text-gray-500 mt-1">Vendor/restaurant profiles, financial rates, contacts, and logs.</p>
        </div>
        
        <div className="flex items-center gap-2 select-none">
          <button 
            id="btn-import-vendors"
            onClick={() => setIsImporting(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <FileSpreadsheet size={15} className="text-emerald-800" />
            Excel Import
          </button>
          
          <button 
            id="btn-add-new-vendor"
            onClick={startNew}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition-all cursor-pointer shadow-sm"
          >
            <Plus size={15} />
            New Supplier
          </button>
        </div>
      </div>

      {/* ON-SCREEN EDIT / CREATE FORM INSTEAD OF MODAL VIEW */}
      {editingVendor && (
        <div id="vendor-form-anchor" className="bg-white border rounded-2xl p-6 shadow-sm space-y-6 animate-in fade-in duration-200 border-emerald-300">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm">
                {isNew ? '✨ Create New Supplier Listing' : `✏️ Edit Supplier Listing: ${editingVendor.trade_name}`}
              </h3>
              <p className="text-[11px] text-gray-400">All coordinates and settings below reflect in real-time orders routing</p>
            </div>
            
            <button 
              onClick={() => setEditingVendor(null)}
              className="p-1 text-gray-400 hover:text-gray-600 bg-gray-150 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-750 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert size={14} className="text-red-700" />
              <span className="font-sans font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Column 1: Core details with FLOATING LABELS */}
            <div className="space-y-4">
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest block border-b pb-1">
                1. Company Information & Billing Rates
              </span>

              <div className="space-y-4">
                
                {/* Floating label Trade Name */}
                <div className="relative">
                  <input 
                    type="text"
                    value={editingVendor.trade_name}
                    onChange={(e) => setEditingVendor({...editingVendor, trade_name: e.target.value})}
                    placeholder=" "
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                    Trade Name / Commercial Banner *
                  </label>
                </div>

                {/* Floating label Legal Company Name */}
                <div className="relative">
                  <input 
                    type="text"
                    value={editingVendor.company_name || ''}
                    onChange={(e) => setEditingVendor({...editingVendor, company_name: e.target.value})}
                    placeholder=" "
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                    Legal Entities Registration Name
                  </label>
                </div>

                {/* Floating label Tax/ID Code */}
                <div className="relative">
                  <input 
                    type="text"
                    value={editingVendor.id_code}
                    onChange={(e) => setEditingVendor({...editingVendor, id_code: e.target.value})}
                    placeholder=" "
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                  <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                    Tax / ID Code (Identification Number) *
                  </label>
                </div>

                {/* Bank Account (IBAN) & Price per Liter sitting together */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bank Account */}
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder=" "
                      value={editingVendor.bank_account || ''}
                      onChange={(e) => setEditingVendor({...editingVendor, bank_account: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                    <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                      Georgian Bank Account IBAN
                    </label>
                  </div>

                  {/* Price per Liter renamed and sitting right next */}
                  <div className="relative">
                    <input 
                      type="number"
                      step="0.01"
                      placeholder=" "
                      value={editingVendor.price_per_liter}
                      onChange={(e) => setEditingVendor({...editingVendor, price_per_liter: parseFloat(e.target.value) || 0})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                    <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                      Price per Liter (₾) *
                    </label>
                  </div>
                </div>

                {/* City and District selection */}
                <div className="grid grid-cols-2 gap-4">
                  {/* City selection floating label */}
                  <div className="relative">
                    <select
                      value={editingVendor.city}
                      onChange={(e) => {
                        const val = e.target.value;
                        const filtered = districts.filter(d => {
                          const cObj = cities.find(x => x.name === val);
                          return cObj && d.city_id === cObj.id;
                        });
                        setEditingVendor({
                          ...editingVendor,
                          city: val,
                          district: filtered[0]?.name || ''
                        });
                      }}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-sans"
                    >
                      {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.pointer-events-none font-bold">
                      City
                    </label>
                  </div>

                  {/* District selection floating label */}
                  <div className="relative">
                    <select
                      value={editingVendor.district}
                      onChange={(e) => setEditingVendor({...editingVendor, district: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer font-sans"
                    >
                      {districts
                        .filter(d => {
                          const cObj = cities.find(x => x.name === editingVendor.city);
                          return !cObj || d.city_id === cObj.id;
                        })
                        .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
                      }
                    </select>
                    <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.pointer-events-none font-bold">
                      District Director
                    </label>
                  </div>
                </div>

                {/* Address Floating Label */}
                <div className="relative">
                  <input 
                    type="text"
                    value={editingVendor.address}
                    onChange={(e) => setEditingVendor({...editingVendor, address: e.target.value})}
                    placeholder=" "
                    className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                  />
                  <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                    Exact Address (Details, Floor, Entry)
                  </label>
                </div>

                {/* Warehouse & Working Hours */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <select
                      value={editingVendor.warehouse_id}
                      onChange={(e) => setEditingVendor({...editingVendor, warehouse_id: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none cursor-pointer"
                    >
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.pointer-events-none font-bold">
                      Assigned Base Warehouse
                    </label>
                  </div>

                  <div className="relative">
                    <input 
                      type="text"
                      placeholder=" "
                      value={editingVendor.working_hours}
                      onChange={(e) => setEditingVendor({...editingVendor, working_hours: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:bg-white transition rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <label className="absolute text-[10px] text-gray-400 duration-150 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-90 peer-focus:-translate-y-3.5 peer-focus:text-emerald-800 pointer-events-none font-bold">
                      Working Hours (Schedule)
                    </label>
                  </div>
                </div>

                {/* Managers-only dropdown and Dispatcher all-users selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <select
                      value={editingVendor.manager_id}
                      onChange={(e) => setEditingVendor({...editingVendor, manager_id: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer focus:outline-none"
                    >
                      {/* Filtered to only display managers */}
                      {users.filter(u => u.role === 'manager').map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                      {users.filter(u => u.role === 'manager').length === 0 && (
                        <option value={currentUser.id}>{currentUser.name} (Ad hoc)</option>
                      )}
                    </select>
                    <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.pointer-events-none font-bold font-sans">
                      Acquisition Manager (Managers Only) *
                    </label>
                  </div>

                  <div className="relative">
                    <select
                      value={editingVendor.operator_id}
                      onChange={(e) => setEditingVendor({...editingVendor, operator_id: e.target.value})}
                      className="peer block w-full px-3.5 pt-5 pb-1.5 text-xs text-gray-900 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer focus:outline-none"
                    >
                      {/* Displays all users */}
                      {users.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
                      ))}
                    </select>
                    <label className="absolute text-[10px] text-emerald-800 transform -translate-y-3.5 scale-90 top-3.5 origin-[0] left-3.pointer-events-none font-bold">
                      Assigned Systems Dispatcher
                    </label>
                  </div>
                </div>

              </div>
            </div>

            {/* Column 2: Interactive Lists (Contacts & Comments logs) */}
            <div className="space-y-6">
              
              {/* Contact personnel */}
              <div className="bg-slate-50 border p-4.5 rounded-2xl space-y-3 shadow-2xs">
                <span className="text-[11px] font-black tracking-wider text-indigo-850 uppercase block border-b pb-1">
                  2. Supplier Contacts Desk
                </span>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input 
                    type="text" 
                    placeholder="Full Contact Name"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="Mobile Phone"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={newContactPos}
                    onChange={(e) => setNewContactPos(e.target.value as any)}
                    className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs"
                  >
                    <option value="accountant">Accountant</option>
                    <option value="director">Director/Owner</option>
                    <option value="operator">Operations Mgr</option>
                    <option value="other">Other Position</option>
                  </select>
                  
                  <input 
                    type="text"
                    placeholder="Short description/note"
                    value={newContactNote}
                    onChange={(e) => setNewContactNote(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none"
                  />

                  <button 
                    type="button"
                    onClick={handleAddContact}
                    className="px-4.5 bg-indigo-880 bg-indigo-700 text-white rounded-xl text-xs font-bold hover:bg-indigo-805 transition cursor-pointer select-none"
                  >
                    Add
                  </button>
                </div>

                {/* Form Contact cards roster */}
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {tempContacts.map((c) => (
                    <div key={c.id} className="p-2.5 bg-white border border-gray-150 rounded-xl flex items-center justify-between text-xs transition">
                      <div className="font-sans">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-800">{c.name}</span>
                          <span className="text-[10px] text-gray-400 capitalize bg-slate-50 px-1.5 py-0.2 rounded border">
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
                            c.is_default ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gray-50 text-gray-400 hover:text-gray-700'
                          }`}
                        >
                          Default
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleRemoveContact(c.id)}
                          className="p-1 hover:bg-red-50 text-red-500 rounded transition cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Log Book Comments Area */}
              <div className="bg-purple-50/20 border border-purple-100 p-4.5 rounded-2xl space-y-3">
                <span className="text-[11px] font-black tracking-wider text-purple-900 uppercase block border-b pb-1">
                  3. Log Book Comments & Dispatch Notes
                </span>

                {/* Only the comment text input is visible, other telemetry (author name, timestamp) is automated */}
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Enter logging update comment here..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-white border border-gray-250/75 rounded-xl text-xs focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={handleAddComment}
                    className="px-4.5 bg-purple-700 text-white rounded-xl text-xs font-bold hover:bg-purple-800 transition shadow-2xs select-none"
                  >
                    Post Log
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {editingVendor.comments?.map((c) => (
                    <div key={c.id} className="p-2.5 bg-white border border-purple-100/50 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span className="font-sans font-extrabold text-purple-905">{c.user_name}</span>
                        <span>{new Date(c.date).toLocaleString('en-US')}</span>
                      </div>
                      <p className="text-gray-700 font-sans leading-relaxed">{c.comment}</p>
                    </div>
                  ))}
                  {(!editingVendor.comments || editingVendor.comments.length === 0) && (
                    <p className="text-center py-4 text-[10px] text-gray-400 italic">No notes created for this supplier yet.</p>
                  )}
                </div>
              </div>

            </div>

          </div>

          <div className="pt-4 border-t flex justify-end gap-3 select-none">
            <button 
              onClick={() => setEditingVendor(null)}
              className="px-4 py-2 bg-white border hover:bg-gray-50 font-bold rounded-xl text-xs text-gray-700 cursor-pointer transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveAll}
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 font-extrabold rounded-xl text-xs text-white cursor-pointer shadow-sm flex items-center gap-1.5 transition"
            >
              <CheckCircle2 size={13} />
              Save Supplier Coordinates
            </button>
          </div>

        </div>
      )}

      {/* SEARCH/FILTER CONTROLLER */}
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
            className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
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
            className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:outline-none disabled:opacity-50"
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

      {/* SPREADSHEET BEAUTIFUL TABLE FORMAT PREVENTING SINGLE CARDS */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-gray-700">
            <thead>
              <tr className="border-b text-[10px] text-gray-400 uppercase font-mono bg-slate-50 select-none">
                <th className="py-3 px-4 font-bold">Trade / Legal Name</th>
                <th className="py-3 px-4">Registry Code</th>
                <th className="py-3 px-4">Tax / ID Code</th>
                <th className="py-3 px-4">City & District</th>
                <th className="py-3 px-4 text-emerald-800">Price per Liter</th>
                <th className="py-3 px-4">Primary Contact & Phone</th>
                <th className="py-3 px-4 text-center">Comments</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredVendors.map((vendor) => {
                const defaultContact = vendor.contacts?.find(c => c.is_default) || vendor.contacts?.[0];
                return (
                  <tr key={vendor.id} className="hover:bg-slate-50/30 text-xs transition-colors">
                    
                    {/* Trade & Legal */}
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-gray-800 block text-xs">
                        {vendor.trade_name}
                      </span>
                      <span className="text-[10px] text-gray-400 block max-w-[180px] truncate">
                        {vendor.company_name || vendor.trade_name}
                      </span>
                    </td>

                    {/* Registry Code */}
                    <td className="py-3 px-4 font-mono font-bold text-gray-550">
                      {vendor.company_code}
                    </td>

                    {/* ID code */}
                    <td className="py-3 px-4 font-mono">
                      {vendor.id_code}
                    </td>

                    {/* City / District / Address */}
                    <td className="py-3 px-4 font-sans max-w-[190px] truncate">
                      <span className="font-bold text-gray-700 block">{vendor.city} - {vendor.district}</span>
                      <span className="text-[10px] text-gray-400 block truncate">{vendor.address}</span>
                    </td>

                    {/* Price per Liter */}
                    <td className="py-3 px-4 font-mono font-extrabold text-emerald-800 text-[13px]">
                      {vendor.price_per_liter.toFixed(2)} ₾
                    </td>

                    {/* Contact detail */}
                    <td className="py-3 px-4 font-sans">
                      {defaultContact ? (
                        <div>
                          <span className="font-bold text-gray-800 block">{defaultContact.name}</span>
                          <span className="text-[11px] text-emerald-700 font-mono font-bold block">{defaultContact.phone}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-600 block italic bg-amber-50 rounded px-1.5 py-0.5 w-fit">No contacts</span>
                      )}
                    </td>

                    {/* Comments count */}
                    <td className="py-3 px-4 text-center font-mono select-none">
                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-750 font-bold font-sans rounded-md text-[10px]">
                        {vendor.comments?.length || 0}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1 select-none">
                        <button 
                          onClick={() => startEdit(vendor)}
                          className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                          title="Edit supplier coordinates"
                        >
                          <Edit3 size={13.5} />
                        </button>
                        <button 
                          onClick={() => onDelete(vendor.id, vendor.trade_name)}
                          className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                          title="Soft delete record"
                        >
                          <Trash2 size={13.5} />
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
            No supplier data matches current filtration criteria.
          </div>
        )}
      </div>

      {/* EXCEL IMPORT SIMULATION MODAL */}
      {isImporting && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-150">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
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
