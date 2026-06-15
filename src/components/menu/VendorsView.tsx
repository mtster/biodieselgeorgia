import React, { useState } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../../types';
import { 
  Search, Plus, Edit3, Trash2, FileSpreadsheet, 
  MessageSquare
} from 'lucide-react';

// Modular child components
import VendorForm from '../vendors/VendorForm';
import VendorDeleteModal from '../vendors/VendorDeleteModal';
import VendorImportModal from '../vendors/VendorImportModal';
import VendorsList from '../vendors/VendorsList';

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
  currentUser, onSave, onDelete
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  
  // Active edit state (On-screen form)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState('');

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  // Action triggers for child forms
  const [formSubmitTrigger, setFormSubmitTrigger] = useState<(() => void) | null>(null);
  const [formDummyTrigger, setFormDummyTrigger] = useState<(() => void) | null>(null);

  const startEdit = (vendor: Vendor) => {
    setEditingVendor(JSON.parse(JSON.stringify(vendor)));
    setIsNew(false);
  };

  const startNew = () => {
    const defaultVendor: Vendor = {
      id: '',
      id_code: '',
      company_name: '',
      trade_name: '',
      company_code: '', 
      bank_account: '',
      city: '', 
      district: '', 
      address: '',
      price_per_liter: 1.40,
      warehouse_id: '', 
      manager_id: '', 
      operator_id: '', 
      contacts: [],
      comments: [],
      working_hours: '09:00 - 18:00',
      created_at: new Date().toISOString()
    };
    setEditingVendor(defaultVendor);
    setIsNew(true);
  };

  const handleSaveFromForm = (payload: Vendor) => {
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
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-4 bg-[#f8fafc]/95 backdrop-blur-md border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left shadow-xs mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Suppliers</h2>
          <p className="text-xs text-gray-550 mt-1 font-sans">
              {editingVendor 
                ? (isNew ? 'Creating Supplier' : `Editing: ${editingVendor.trade_name}`)
                : 'Manage commercial biodiesel suppliers, purchase pricing rates, bank account targets, and contact lists.'
              }
            </p>
          </div>

          <div className="flex items-center gap-3">
            {editingVendor ? (
              <>
                <button 
                  onClick={() => {
                    if (formDummyTrigger) formDummyTrigger();
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-xs text-slate-700 transition cursor-pointer select-none"
                >
                  Fill Dummy
                </button>
                <button 
                  onClick={() => setEditingVendor(null)}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-slate-50 font-bold rounded-xl text-xs text-gray-700 transition cursor-pointer select-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (formSubmitTrigger) formSubmitTrigger();
                  }}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsImporting(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer select-none"
                  title="Import suppliers from spreadsheet files"
                >
                  <FileSpreadsheet size={15} />
                  Bulk Import
                </button>
                
                <button 
                  id="btn-add-new-vendor"
                  onClick={startNew}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 active:bg-emerald-950 transition-all duration-150 cursor-pointer shadow-sm select-none"
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
        <VendorForm
          editingVendor={editingVendor}
          setEditingVendor={setEditingVendor}
          warehouses={warehouses}
          users={users}
          cities={cities}
          districts={districts}
          currentUser={currentUser}
          onSave={handleSaveFromForm}
          onCancel={() => setEditingVendor(null)}
          onRegisterTriggers={(triggers) => {
            setFormSubmitTrigger(() => triggers.save);
            setFormDummyTrigger(() => triggers.fillDummy);
          }}
        />
      ) : (
        <div className="space-y-6 text-left">
          
          {/* ADVANCED MULTI-PROPERTY SEARCH & FILTERS CONTROLS */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3.5 select-none font-sans">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                <Search size={15} />
              </span>
              <input 
                id="vendors-search"
                type="text"
                placeholder="Search suppliers by trade name, legal entity, or registered taxation ID coordinates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex gap-2.5 items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0 w-12 text-right">City:</span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedDistrict('');
                  }}
                  className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">All Cities</option>
                  {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex gap-2.5 items-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0 w-16 text-right">District:</span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="">All Districts</option>
                  {districts
                    .filter(d => {
                      const cObj = cities.find(x => x.name === selectedCity);
                      return !cObj || d.city_id === cObj.id;
                    })
                    .map(d => <option key={d.id} value={d.name}>{d.name}</option>)
                  }
                </select>
              </div>
            </div>
          </div>

          <VendorsList 
            filteredVendors={filteredVendors} 
            users={users} 
            startEdit={startEdit} 
            askDelete={askDelete} 
          />
        </div>
      )}

      {/* EXCEL BULK IMPORT MODAL */}
      <VendorImportModal
        isOpen={isImporting}
        onClose={() => setIsImporting(false)}
        importText={importText}
        setImportText={setImportText}
        onImport={handleImportExcel}
      />

      {/* DELETE CONFIRMATION SYSTEM MODAL */}
      <VendorDeleteModal
        vendorName={deleteConfirmName}
        onClose={() => {
          setDeleteConfirmId(null);
          setDeleteConfirmName(null);
        }}
        onConfirm={confirmDelete}
      />

    </div>
  );
}
