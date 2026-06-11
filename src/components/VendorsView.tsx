import React, { useState } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../types';
import { 
  Search, Plus, Edit3, Trash2, FileSpreadsheet, 
  Check, X, Phone, User as UserIcon, MessageSquare, Clock, ArrowRight,
  Database, UserCheck
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

  // Callback props for dynamically adding lookups directly from drop-downs
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
  
  // Active edit state
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');

  // Contacts temp creation helper state
  const [tempContacts, setTempContacts] = useState<VendorContact[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactPos, setNewContactPos] = useState<'accountant' | 'director' | 'operator' | 'other'>('accountant');
  const [newContactNote, setNewContactNote] = useState('');

  // Comment helper state
  const [newCommentText, setNewCommentText] = useState('');

  // Prompt dialog triggers
  const triggerAddCity = () => {
    const name = prompt('Enter new city name:');
    if (name && name.trim()) {
      if (onAddCity) {
        onAddCity(name.trim());
      }
    }
  };

  const triggerAddDistrict = (cityId?: string) => {
    // If no city is specified, find the current editing vendor's city
    let activeCityId = '';
    if (cityId) {
      activeCityId = cityId;
    } else if (editingVendor) {
      const cityObj = cities.find(c => c.name === editingVendor.city);
      if (cityObj) activeCityId = cityObj.id;
    }

    if (!activeCityId) {
      alert('Please select a city first to add corresponding district.');
      return;
    }

    const name = prompt('Enter new district name:');
    if (name && name.trim()) {
      if (onAddDistrict) {
        onAddDistrict(activeCityId, name.trim());
      }
    }
  };

  const triggerAddWarehouse = () => {
    const name = prompt('Enter new warehouse name:');
    if (name && name.trim()) {
      if (onAddWarehouse) {
        onAddWarehouse(name.trim());
      }
    }
  };

  // Import Excel Simulation
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
                comment: 'Imported from Excel',
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
      alert('Error during import. Verify your column structure.');
    }
  };

  const startEdit = (vendor: Vendor) => {
    setEditingVendor(JSON.parse(JSON.stringify(vendor)));
    setTempContacts(vendor.contacts || []);
    setIsNew(false);
    setNewCommentText('');
  };

  const startNew = () => {
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
    if (!editingVendor.trade_name.trim() || !editingVendor.id_code.trim()) {
      alert('Please fill in trade name and identification code.');
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
          <h2 className="text-xl font-extrabold text-gray-800">Suppliers (Vendors)</h2>
          <p className="text-xs text-gray-500 mt-1">Vendor/restaurant profiles, contacts, and historical log comments.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            id="btn-import-vendors"
            onClick={() => setIsImporting(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-250/60 rounded-xl text-xs font-bold text-gray-755 hover:bg-gray-150 transition cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            Import Excel
          </button>
          
          <button 
            id="btn-add-new-vendor"
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            New Supplier
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex flex-col md:flex-row gap-3">
        
        <div className="flex-1 relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            <Search size={15} />
          </span>
          <input 
            type="text"
            placeholder="Search (name, code, ID)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-250/75 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* City Filter */}
        <div className="w-full md:w-44">
          <select
            value={selectedCity}
            onChange={(e) => {
              if (e.target.value === 'ADD_NEW') {
                triggerAddCity();
                setSelectedCity('');
              } else {
                setSelectedCity(e.target.value);
                setSelectedDistrict('');
              }
            }}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-250/75 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Cities</option>
            {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            <option value="ADD_NEW" className="text-emerald-700 font-bold">+ New City...</option>
          </select>
        </div>

        {/* District Filter */}
        <div className="w-full md:w-44">
          <select
            value={selectedDistrict}
            onChange={(e) => {
              if (e.target.value === 'ADD_NEW') {
                const cityObj = cities.find(c => c.name === selectedCity);
                triggerAddDistrict(cityObj?.id);
                setSelectedDistrict('');
              } else {
                setSelectedDistrict(e.target.value);
              }
            }}
            disabled={!selectedCity}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200/80 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">All Districts</option>
            {districts
              .filter(d => {
                const cityObj = cities.find(c => c.name === selectedCity);
                return !cityObj || d.city_id === cityObj.id;
              })
              .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
            }
            <option value="ADD_NEW" className="text-emerald-700 font-bold">+ New District...</option>
          </select>
        </div>

      </div>

      {/* VENDORS LIST GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVendors.map((vendor) => {
          const defaultContact = vendor.contacts?.find(c => c.is_default) || vendor.contacts?.[0];
          return (
            <div 
              key={vendor.id} 
              className="bg-white border border-gray-100 hover:border-emerald-200 rounded-2xl p-5 shadow-xs transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-black text-gray-800 mt-1">
                      {vendor.trade_name}
                    </h3>
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => startEdit(vendor)}
                      className="text-gray-400 hover:text-emerald-700 p-1 bg-gray-50 rounded"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => onDelete(vendor.id, vendor.trade_name)}
                      className="text-gray-400 hover:text-red-630 p-1 bg-gray-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 space-y-1 pt-1 font-sans">
                  <p><strong>Legal Name:</strong> {vendor.company_name}</p>
                  <p><strong>Tax/ID Code:</strong> {vendor.id_code}</p>
                  <p><strong>Address:</strong> {vendor.city}, {vendor.district}, {vendor.address}</p>
                  <p><strong>Price per Liter:</strong> <span className="font-bold text-emerald-800">{vendor.price_per_liter} ₾</span></p>
                </div>
              </div>

              {/* Default Active Contact summary */}
              {defaultContact ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Primary Contact</span>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span className="flex items-center gap-1">
                      <UserIcon size={12} className="text-gray-400" />
                      {defaultContact.name}
                    </span>
                    <span className="text-[10px] bg-slate-200 px-1 rounded font-normal text-gray-500">
                      {defaultContact.position === 'accountant' ? 'Accountant' : defaultContact.position === 'director' ? 'Director' : 'Dispatcher'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 font-mono">
                    <Phone size={11} />
                    {defaultContact.phone}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-700 italic">
                  No contacts specified yet.
                </div>
              )}

              {/* Bottom detail stats */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span>Comments: {vendor.comments?.length || 0}</span>
                <span className="font-mono">
                  Last Collection: {vendor.last_pickup_date ? new Date(vendor.last_pickup_date).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </div>
          );
        })}

        {filteredVendors.length === 0 && (
          <div className="col-span-full text-center py-20 bg-white border border-gray-100 rounded-2xl text-xs text-gray-400">
            No vendors matched the filters.
          </div>
        )}
      </div>      {/* MODAL EDIT / CREATE FORM */}
      {editingVendor && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-xl border border-gray-150 transition-all scale-100">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-gray-800 text-base">
                {isNew ? 'Create New Supplier' : `Edit Supplier: ${editingVendor.trade_name}`}
              </h3>
              <button 
                onClick={() => setEditingVendor(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-405 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Editing Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Core Information Section */}
              <div className="space-y-4">
                <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest block border-b border-emerald-50 pb-1">
                  1. Company Legal & Commercial details
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">Trade Name *</label>
                    <input 
                      type="text"
                      value={editingVendor.trade_name}
                      onChange={(e) => setEditingVendor({...editingVendor, trade_name: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">Legal Company Name</label>
                    <input 
                      type="text"
                      value={editingVendor.company_name}
                      onChange={(e) => setEditingVendor({...editingVendor, company_name: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">Tax/ID Code *</label>
                    <input 
                      type="text"
                      value={editingVendor.id_code}
                      onChange={(e) => setEditingVendor({...editingVendor, id_code: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">Bank Account (IBAN)</label>
                    <input 
                      type="text"
                      placeholder="GE00TB00000..."
                      value={editingVendor.bank_account}
                      onChange={(e) => setEditingVendor({...editingVendor, bank_account: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-gray-400 block">City</label>
                        <button 
                          type="button"
                          onClick={triggerAddCity}
                          className="text-[9px] text-emerald-700 font-bold hover:underline"
                        >
                          + New
                        </button>
                      </div>
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
                        className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                      >
                        {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-gray-400 block">District</label>
                        <button 
                          type="button"
                          onClick={() => {
                            const activeCity = cities.find(c => c.name === editingVendor.city);
                            triggerAddDistrict(activeCity?.id);
                          }}
                          className="text-[9px] text-emerald-700 font-bold hover:underline"
                        >
                          + New
                        </button>
                      </div>
                      <select
                        value={editingVendor.district}
                        onChange={(e) => setEditingVendor({...editingVendor, district: e.target.value})}
                        className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
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

                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">Rate per Liter (₾)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editingVendor.price_per_liter}
                        onChange={(e) => setEditingVendor({...editingVendor, price_per_liter: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1 font-sans">Exact Address</label>
                    <input 
                      type="text"
                      value={editingVendor.address}
                      onChange={(e) => setEditingVendor({...editingVendor, address: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-gray-400 block">Warehouse</label>
                        <button 
                          type="button"
                          onClick={triggerAddWarehouse}
                          className="text-[9px] text-emerald-700 font-bold hover:underline"
                        >
                          + New
                        </button>
                      </div>
                      <select
                        value={editingVendor.warehouse_id}
                        onChange={(e) => setEditingVendor({...editingVendor, warehouse_id: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                      >
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">Working Hours</label>
                      <input 
                        type="text"
                        placeholder="11:00 - 23:00"
                        value={editingVendor.working_hours}
                        onChange={(e) => setEditingVendor({...editingVendor, working_hours: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">Acquisition Manager</label>
                      <select
                        value={editingVendor.manager_id}
                        onChange={(e) => setEditingVendor({...editingVendor, manager_id: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                      >
                        {users.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">Assigned Dispatcher</label>
                      <select
                        value={editingVendor.operator_id}
                        onChange={(e) => setEditingVendor({...editingVendor, operator_id: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                      >
                        {users.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                  </div>

                </div>

              </div>

              {/* Contacts and Comments Logging section */}
              <div className="space-y-6">
                
                {/* Contact List */}
                <div className="space-y-3">
                  <span className="text-xs font-extrabold text-indigo-800 uppercase tracking-widest block border-b border-indigo-50 pb-1">
                    2. Contact Personnel Management
                  </span>

                  {/* Add contact helpers inline */}
                  <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="text" 
                        placeholder="Full Name"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] focus:outline-none"
                      />
                      <input 
                        type="text" 
                        placeholder="Phone"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2.5">
                      <select
                        value={newContactPos}
                        onChange={(e) => setNewContactPos(e.target.value as any)}
                        className="flex-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[11px]"
                      >
                        <option value="accountant">Accountant</option>
                        <option value="director">Director</option>
                        <option value="operator">Dispatcher</option>
                        <option value="other">Other Position</option>
                      </select>
                      <input 
                        type="text" 
                        placeholder="Handover Note"
                        value={newContactNote}
                        onChange={(e) => setNewContactNote(e.target.value)}
                        className="flex-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[11px]"
                      />
                      <button 
                        onClick={handleAddContact}
                        className="px-3 py-1 bg-indigo-700 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-800 transition shadow-xs leading-none cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Rendered contacts in edit mode */}
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {tempContacts.map((c) => (
                      <div key={c.id} className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-center justify-between gap-2 text-[11px]">
                        <div>
                          <p className="font-semibold text-gray-800 flex items-center gap-1">
                            {c.name} 
                            <span className="text-[9px] text-gray-450 font-mono">
                              ({c.position === 'accountant' ? 'Accountant' : c.position === 'director' ? 'Director' : 'Dispatcher'})
                            </span>
                          </p>
                          <p className="font-mono text-emerald-700 font-bold">{c.phone}</p>
                          {c.note && <p className="text-[10px] text-gray-400 italic font-mono">{c.note}</p>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleSetDefaultContact(c.id)}
                            className={`p-1 rounded text-[10px] font-medium transition cursor-pointer ${
                              c.is_default 
                                ? 'bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-100' 
                                : 'bg-gray-50 text-gray-400 hover:text-gray-655'
                            }`}
                          >
                            Set Primary
                          </button>
                          <button 
                            onClick={() => handleRemoveContact(c.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

                {/* Comment Logger */}
                <div className="space-y-3">
                  <span className="text-xs font-extrabold text-purple-800 uppercase tracking-widest block border-b border-purple-50 pb-1">
                    3. Log Book Comments & Handler Notes
                  </span>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Type a comment..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                    />
                    <button 
                      onClick={handleAddComment}
                      className="px-3 bg-purple-705 text-white bg-purple-700 rounded-xl text-xs font-bold hover:bg-purple-800 transition cursor-pointer leading-none"
                    >
                      Add
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {editingVendor.comments?.map((c) => (
                      <div key={c.id} className="p-2 bg-purple-50/25 border border-purple-50/50 rounded-lg text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between text-gray-450 text-[10px] font-mono">
                          <span>{c.user_name}</span>
                          <span>{new Date(c.date).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Actions banner - NO redundant cancel button, only standard save */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
              <button 
                onClick={handleSaveAll}
                className="px-5 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition flex items-center gap-1.5 cursor-pointer shadow-sm ml-auto"
              >
                <Check size={14} />
                Save Supplier Profile
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EXCEL IMPORT SIMULATION MODAL */}
      {isImporting && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-150">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
              <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5">
                <FileSpreadsheet className="text-emerald-700" size={16} />
                Import Data from Excel File
              </h3>
              <button onClick={() => setIsImporting(false)} className="text-gray-400 hover:text-gray-650 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
              Copy and paste columns directly from Excel (Format: <strong>Trade Name, Legal Name, Tax ID Code</strong> separated by TAB or commas).
            </p>

            <textarea 
              rows={8}
              placeholder="e.g. Traditional Tavern LLC, 204857392"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            ></textarea>

            <div className="flex items-center justify-end gap-2.5">
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
