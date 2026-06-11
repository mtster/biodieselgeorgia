import React, { useState } from 'react';
import { 
  Supplier, SupplierContact, SupplierComment, 
  Warehouse, Employee, City, District 
} from '../types';
import { 
  Search, Plus, Edit3, Trash2, FileSpreadsheet, 
  Check, X, Phone, User, MessageSquare, Clock, ArrowRight,
  Database, UserCheck
} from 'lucide-react';

interface Props {
  suppliers: Supplier[];
  warehouses: Warehouse[];
  employees: Employee[];
  cities: City[];
  districts: District[];
  currentEmployee: Employee;
  onSave: (supplier: Supplier) => void;
  onDelete: (id: string, tradeName: string) => void;
}

export default function SuppliersView({ 
  suppliers, warehouses, employees, cities, districts, 
  currentEmployee, onSave, onDelete 
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  
  // Active edit state
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');

  // Contacts temp creation helper state
  const [tempContacts, setTempContacts] = useState<SupplierContact[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactPos, setNewContactPos] = useState<'accountant' | 'director' | 'operator' | 'other'>('accountant');
  const [newContactNote, setNewContactNote] = useState('');

  // Comment helper state
  const [newCommentText, setNewCommentText] = useState('');

  // Import Excel Simulation
  const handleImportExcel = () => {
    if (!importText.trim()) return;
    try {
      // Clean parsing simulation (tab-separated or comma-separated raw values)
      const lines = importText.split('\n');
      let importCount = 0;
      
      lines.forEach((line) => {
        const parts = line.split(/[\t,]/);
        if (parts.length >= 3) {
          const tradeName = parts[0].trim();
          const legalName = parts[1].trim();
          const idCode = parts[2].trim();
          const code = parts[3]?.trim() || 'I-' + Math.floor(100 + Math.random() * 900);
          const address = parts[4]?.trim() || 'თბილისი, საქართველო';
          
          if (tradeName && idCode) {
            const rawSup: Supplier = {
              id: 'sup-' + Math.random().toString(36).substring(2, 9),
              id_code: idCode,
              company_name: legalName || tradeName,
              trade_name: tradeName,
              company_code: code,
              bank_account: 'GE00TB0000000000000000',
              city: cities[0]?.name || 'თბილისი',
              district: districts.filter(d => d.city_id === cities[0]?.id)[0]?.name || 'საბურთალო',
              address: address,
              price_per_liter: 1.5,
              warehouse_id: warehouses[0]?.id || '',
              manager_id: employees.find(e => e.role === 'manager')?.id || currentEmployee.id,
              operator_id: currentEmployee.id,
              contacts: [],
              comments: [{
                id: 'c-1',
                comment: 'იმპორტირებულია ექსელიდან',
                date: new Date().toISOString(),
                employee_name: currentEmployee.name
              }],
              working_hours: '10:00 - 20:00',
              created_at: new Date().toISOString()
            };
            onSave(rawSup);
            importCount++;
          }
        }
      });
      alert(`წარმატებით იმპორტირდა ${importCount} მომწოდებელი!`);
      setIsImporting(false);
      setImportText('');
    } catch (e) {
      alert('იმპორტის დროს მოხდა შეცდომა. დარწმუნდით რომ ფორმატი სწორია.');
    }
  };

  const startEdit = (sup: Supplier) => {
    setEditingSupplier(JSON.parse(JSON.stringify(sup)));
    setTempContacts(sup.contacts || []);
    setIsNew(false);
    setNewCommentText('');
  };

  const startNew = () => {
    const defaultSup: Supplier = {
      id: '',
      id_code: '',
      company_name: '',
      trade_name: '',
      company_code: 'BIO-' + Math.floor(1000 + Math.random() * 9000),
      bank_account: '',
      city: cities[0]?.name || 'თბილისი',
      district: districts.filter(d => d.city_id === cities[0]?.id)[0]?.name || 'საბურთალო',
      address: '',
      price_per_liter: 1.40,
      warehouse_id: warehouses[0]?.id || '',
      manager_id: employees.find(e => e.role === 'manager')?.id || currentEmployee.id,
      operator_id: currentEmployee.id,
      contacts: [],
      comments: [],
      working_hours: '09:00 - 18:00',
      created_at: new Date().toISOString()
    };
    setEditingSupplier(defaultSup);
    setTempContacts([]);
    setIsNew(true);
    setNewCommentText('');
  };

  const handleAddContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    const isFirst = tempContacts.length === 0;
    const contact: SupplierContact = {
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
    if (!newCommentText.trim() || !editingSupplier) return;
    const newComment: SupplierComment = {
      id: 'comm-' + Math.random().toString(36).substring(2, 9),
      comment: newCommentText,
      date: new Date().toISOString(),
      employee_name: currentEmployee.name
    };
    setEditingSupplier({
      ...editingSupplier,
      comments: [newComment, ...(editingSupplier.comments || [])]
    });
    setNewCommentText('');
  };

  const handleSaveAll = () => {
    if (!editingSupplier) return;
    if (!editingSupplier.trade_name.trim() || !editingSupplier.id_code.trim()) {
      alert('გთხოვთ შეავსოთ ობიექტის სავაჭრო დასახელება და საიდენტიფიკაციო კოდი');
      return;
    }
    const final: Supplier = {
      ...editingSupplier,
      company_code: editingSupplier.company_code || 'BIO-' + Math.floor(1000 + Math.random() * 9000),
      contacts: tempContacts
    };
    onSave(final);
    setEditingSupplier(null);
  };

  // Filter logic
  const filteredSuppliers = suppliers.filter(sup => {
    const matchesSearch = sup.trade_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sup.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          sup.company_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          sup.id_code.includes(searchTerm);
    const matchesCity = selectedCity === '' || sup.city === selectedCity;
    const matchesDistrict = selectedDistrict === '' || sup.district === selectedDistrict;
    return matchesSearch && matchesCity && matchesDistrict;
  });

  return (
    <div className="space-y-6">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800">მომწოდებლები</h2>
          <p className="text-xs text-gray-500 mt-1">მომწოდებელი ობიექტების (რესტორნების) სრული მონაცემები, კონტაქტები და კომენტარები.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsImporting(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-250/60 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-150 transition"
          >
            <FileSpreadsheet size={15} />
            იმპორტი ექსელიდან
          </button>
          
          <button 
            onClick={startNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition shadow-sm"
          >
            <Plus size={15} />
            ახალი მომწოდებელი
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
            placeholder="ძებნა (დასახელება, კოდი, საიდენტიფიკაციო)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200/80 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* City Filter */}
        <div className="w-full md:w-44">
          <select
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value);
              setSelectedDistrict('');
            }}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200/80 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">ყველა ქალაქი</option>
            {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {/* District Filter */}
        <div className="w-full md:w-44">
          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={!selectedCity}
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200/80 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          >
            <option value="">ყველა უბანი</option>
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

      {/* SUPPLIERS LIST GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map((sup) => {
          const defaultContact = sup.contacts?.find(c => c.is_default) || sup.contacts?.[0];
          return (
            <div 
              key={sup.id} 
              className="bg-white border border-gray-100 hover:border-emerald-200 rounded-2xl p-5 shadow-xs transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-black text-gray-800 mt-1">
                      {sup.trade_name}
                    </h3>
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => startEdit(sup)}
                      className="text-gray-400 hover:text-emerald-700 p-1 bg-gray-50 rounded"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => onDelete(sup.id, sup.trade_name)}
                      className="text-gray-400 hover:text-red-630 p-1 bg-gray-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 space-y-1 pt-1 font-sans">
                  <p><strong>იურიდიული სახელი:</strong> {sup.company_name}</p>
                  <p><strong>საიდენტიფიკაციო კოდი:</strong> {sup.id_code}</p>
                  <p><strong>მისამართი:</strong> {sup.city}, {sup.district}, {sup.address}</p>
                  <p><strong>ფასი ლიტრზე:</strong> <span className="font-bold text-emerald-800">{sup.price_per_liter} ₾</span></p>
                </div>
              </div>

              {/* Default Active Contact summary */}
              {defaultContact ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">მთავარი კონტაქტი</span>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                    <span className="flex items-center gap-1">
                      <User size={12} className="text-gray-400" />
                      {defaultContact.name}
                    </span>
                    <span className="text-[10px] bg-slate-200 px-1 rounded font-normal text-gray-500">
                      {defaultContact.position === 'accountant' ? 'ბუღალტერი' : defaultContact.position === 'director' ? 'დირექტორი' : 'ოპერატორი'}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1 font-mono">
                    <Phone size={11} />
                    {defaultContact.phone}
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[10px] text-amber-700 italic">
                  კონტაქტები არ არის მითითებული.
                </div>
              )}

              {/* Bottom detail stats */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span>კომენტარები: {sup.comments?.length || 0}</span>
                <span className="font-mono">
                  ბოლო კოლექცია: {sup.last_pickup_date ? new Date(sup.last_pickup_date).toLocaleDateString() : 'არასდროს'}
                </span>
              </div>
            </div>
          );
        })}

        {filteredSuppliers.length === 0 && (
          <div className="col-span-full text-center py-20 bg-white border border-gray-100 rounded-2xl text-xs text-gray-400">
            მომწოდებელი ობიექტები არ მოიძებნა.
          </div>
        )}
      </div>

      {/* MODAL EDIT / CREATE FORM */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-xl border border-gray-150 transition-all scale-100">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-black text-gray-800 text-base">
                {isNew ? 'ახალი მომწოდებლის შექმნა' : `მომწოდებლის რედაქტირება: ${editingSupplier.trade_name}`}
              </h3>
              <button 
                onClick={() => setEditingSupplier(null)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-405"
              >
                <X size={18} />
              </button>
            </div>

            {/* Editing Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Core Information Section */}
              <div className="space-y-4">
                <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest block border-b border-emerald-50 pb-1">
                  1. კომპანიის იურიდიული და სავაჭრო მონაცემები
                </span>

                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">ობიექტის სავაჭრო დასახელება *</label>
                    <input 
                      type="text"
                      value={editingSupplier.trade_name}
                      onChange={(e) => setEditingSupplier({...editingSupplier, trade_name: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">კომპანიის იურიდიული დასახელება</label>
                    <input 
                      type="text"
                      value={editingSupplier.company_name}
                      onChange={(e) => setEditingSupplier({...editingSupplier, company_name: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">საიდენტიფიკაციო კოდი *</label>
                    <input 
                      type="text"
                      value={editingSupplier.id_code}
                      onChange={(e) => setEditingSupplier({...editingSupplier, id_code: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1">საბანკო ანგარიში (IBAN)</label>
                    <input 
                      type="text"
                      placeholder="GE00TB00000..."
                      value={editingSupplier.bank_account}
                      onChange={(e) => setEditingSupplier({...editingSupplier, bank_account: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">ქალაქი</label>
                      <select
                        value={editingSupplier.city}
                        onChange={(e) => {
                          const val = e.target.value;
                          const filtered = districts.filter(d => {
                            const cObj = cities.find(x => x.name === val);
                            return cObj && d.city_id === cObj.id;
                          });
                          setEditingSupplier({
                            ...editingSupplier,
                            city: val,
                            district: filtered[0]?.name || ''
                          });
                        }}
                        className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">უბანი</label>
                      <select
                        value={editingSupplier.district}
                        onChange={(e) => setEditingSupplier({...editingSupplier, district: e.target.value})}
                        className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {districts
                          .filter(d => {
                            const cObj = cities.find(x => x.name === editingSupplier.city);
                            return !cObj || d.city_id === cObj.id;
                          })
                          .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
                        }
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">ლიტრის ფასი (₾)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={editingSupplier.price_per_liter}
                        onChange={(e) => setEditingSupplier({...editingSupplier, price_per_liter: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 block mb-1 font-sans">ზუსტი მისამართი</label>
                    <input 
                      type="text"
                      value={editingSupplier.address}
                      onChange={(e) => setEditingSupplier({...editingSupplier, address: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">საწყობი</label>
                      <select
                        value={editingSupplier.warehouse_id}
                        onChange={(e) => setEditingSupplier({...editingSupplier, warehouse_id: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                      >
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">სამუშაო საათები</label>
                      <input 
                        type="text"
                        placeholder="11:00 - 23:00"
                        value={editingSupplier.working_hours}
                        onChange={(e) => setEditingSupplier({...editingSupplier, working_hours: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">მომწერი მენეჯერი</label>
                      <select
                        value={editingSupplier.manager_id}
                        onChange={(e) => setEditingSupplier({...editingSupplier, manager_id: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                      >
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-400 block mb-1">აქტიური ოპერატორი</label>
                      <select
                        value={editingSupplier.operator_id}
                        onChange={(e) => setEditingSupplier({...editingSupplier, operator_id: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs"
                      >
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                  </div>

                </div>

              </div>

              {/* Contacts and Comments Logging section */}
              <div className="space-y-6">
                
                {/* Contact List */}
                <div className="space-y-3">
                  <span className="text-xs font-extrabold text-blue-800 uppercase tracking-widest block border-b border-blue-50 pb-1">
                    2. საკონტაქტო პირების მართვა
                  </span>

                  {/* Add contact helpers inline */}
                  <div className="p-3 bg-blue-50/30 rounded-xl border border-blue-100/50 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        type="text" 
                        placeholder="სახელი და გვარი"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        className="px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] focus:outline-none"
                      />
                      <input 
                        type="text" 
                        placeholder="ტელეფონი"
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
                        <option value="accountant">ბუღალტერი</option>
                        <option value="director">დირექტორი</option>
                        <option value="operator">ოპერატორი</option>
                        <option value="other">სხვა პოზიცია</option>
                      </select>
                      <input 
                        type="text" 
                        placeholder="შენიშვნა"
                        value={newContactNote}
                        onChange={(e) => setNewContactNote(e.target.value)}
                        className="flex-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[11px]"
                      />
                      <button 
                        onClick={handleAddContact}
                        className="px-3 py-1 bg-blue-700 text-white rounded-lg text-[11px] font-bold hover:bg-blue-800 transition shadow-xs"
                      >
                        დამატება
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
                              ({c.position === 'accountant' ? 'ბუღალტერი' : c.position === 'director' ? 'დირექტორი' : 'ოპერატორი'})
                            </span>
                          </p>
                          <p className="font-mono text-emerald-700 font-bold">{c.phone}</p>
                          {c.note && <p className="text-[10px] text-gray-400 italic font-mono">{c.note}</p>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => handleSetDefaultContact(c.id)}
                            className={`p-1 rounded text-[10px] font-medium transition ${
                              c.is_default 
                                ? 'bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-100' 
                                : 'bg-gray-50 text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            მთავარი
                          </button>
                          <button 
                            onClick={() => handleRemoveContact(c.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
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
                    3. კომენტარები და ოპერატორის შენიშვნები
                  </span>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="დაწერეთ კომენტარი..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none"
                    />
                    <button 
                      onClick={handleAddComment}
                      className="px-3 bg-purple-700 text-white rounded-xl text-xs font-bold hover:bg-purple-800 transition"
                    >
                      დამატება
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {editingSupplier.comments?.map((c) => (
                      <div key={c.id} className="p-2 bg-purple-50/25 border border-purple-50/50 rounded-lg text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono">
                          <span>{c.employee_name}</span>
                          <span>{new Date(c.date).toLocaleString()}</span>
                        </div>
                        <p className="text-gray-700">{c.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Actions banner */}
            <div className="pt-4 border-t border-gray-100 flex items-center justify-end shrink-0">
              <button 
                onClick={handleSaveAll}
                className="px-5 py-2 bg-emerald-850 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 transition flex items-center gap-1.5"
              >
                <Check size={14} />
                მონაცემების შენახვა
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
                მონაცემების იმპორტი ექსელიდან
              </h3>
              <button onClick={() => setIsImporting(false)} className="text-gray-400 hover:text-gray-650">
                <X size={16} />
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
              დააკოპირეთ და ჩასვით სვეტები Excel-დან (სვეტების ფორმატი: <strong>ობიექტის სახელი, იურიდიული სახელი, საიდენტიფიკაციო კოდი</strong> (გამოყავით Tab-ით ან მძიმით).
            </p>

            <textarea 
              rows={8}
              placeholder="მაგ: ხინკლის სახლი, შპს ქართული საქმე, 204857392"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            ></textarea>

            <div className="flex items-center justify-end gap-2.5">
              <button 
                onClick={() => setIsImporting(false)} 
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold"
              >
                გაუქმება
              </button>
              <button 
                onClick={handleImportExcel}
                className="px-4 py-1.5 bg-emerald-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-900 transition inline-flex items-center gap-1"
              >
                დაწყება
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
