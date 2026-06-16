import React, { useState, useRef } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../../types';
import { 
  Search, Plus, Edit3, Trash2, FileSpreadsheet, 
  MessageSquare, ArrowLeft
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

  // Read-only and bulk-delete selection states
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  // Action triggers for child forms
  const formRef = useRef<{ save: () => void; fillDummy: () => void }>(null);

  const startEdit = (vendor: Vendor, readOnly = false) => {
    setEditingVendor(JSON.parse(JSON.stringify(vendor)));
    setIsNew(false);
    setIsReadOnly(readOnly);
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
    setIsReadOnly(false);
  };

  const handleBulkDeleteExecute = () => {
    selectedVendors.forEach(id => {
      const vend = vendors.find(v => v.id === id);
      onDelete(id, vend?.trade_name || '');
    });
    setSelectedVendors([]);
    setIsSelectionMode(false);
    setShowBulkDeleteConfirm(false);
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
      if (editingVendor?.id === deleteConfirmId) {
        setEditingVendor(null);
      }
    }
    setDeleteConfirmId(null);
    setDeleteConfirmName(null);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER WITH INTEGRATED ACTION CONTROLS */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-4 bg-[#f8fafc]/95 backdrop-blur-md border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left shadow-xs mb-6">
        <div className="flex items-center">
          {editingVendor && (
            <button
              onClick={() => setEditingVendor(null)}
              className="p-2 mr-3 hover:bg-slate-100 rounded-xl transition cursor-pointer text-gray-600 flex items-center justify-center border border-transparent hover:border-gray-200"
              title="Go Back"
              id="vendor-form-back-arrow"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 font-sans tracking-tight">Suppliers</h2>
          </div>
        </div>

          <div className="flex items-center gap-3">
            {editingVendor ? (
              <>
                {isNew && (
                  <button 
                    onClick={() => formRef.current?.fillDummy()}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer select-none"
                  >
                    Fill Dummy
                  </button>
                )}
                {!isNew && (
                  <button 
                    onClick={() => askDelete(editingVendor.id, editingVendor.trade_name)}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-xl text-xs transition cursor-pointer select-none"
                  >
                    Delete
                  </button>
                )}
                <button 
                  onClick={() => {
                    formRef.current?.save();
                  }}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <select
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'import') {
                        setIsImporting(true);
                      } else if (val === 'delete' && selectedVendors.length > 0) {
                        setShowBulkDeleteConfirm(true);
                      }
                      e.target.value = ''; // Reset select trigger
                    }}
                    className="px-3.5 py-2.5 pr-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-gray-200 cursor-pointer select-none focus:outline-none appearance-none font-sans"
                  >
                    <option value="" disabled hidden>Actions</option>
                    <option value="import">Import</option>
                    <option value="delete" disabled={selectedVendors.length === 0}>
                      Delete {selectedVendors.length > 0 ? `(${selectedVendors.length})` : ''}
                    </option>
                  </select>
                  <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
                    ▼
                  </span>
                </div>
                
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
          formRef={formRef}
        />
      ) : (
        <div className="space-y-6 text-left">
          
          {/* ADVANCED MULTI-PROPERTY SEARCH & FILTERS CONTROLS */}
          <div className="bg-white rounded-2xl border border-gray-150 p-4 shadow-sm select-none font-sans">
            
            {/* Search + City + District in a single compact row */}
            <div className="flex flex-col md:flex-row items-center gap-4">
              
              {/* Search input (flex-1) */}
              <div className="relative flex-1 w-full">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                  <Search size={15} />
                </span>
                <input 
                  id="vendors-search"
                  type="text"
                  placeholder="Search suppliers by trade name, legal entity, or registered taxation ID coordinates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 focus:outline-none transition-all text-gray-900 font-sans"
                />
              </div>

              {/* City Dropdown with relative label sitting on outline */}
              <div className="relative min-w-[140px] w-full md:w-auto">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-white select-none z-10 text-left font-sans uppercase tracking-wider">
                  City
                </span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedDistrict('');
                  }}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">All Cities</option>
                  {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              {/* District Dropdown with relative label sitting on outline */}
              <div className="relative min-w-[145px] w-full md:w-auto">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-white select-none z-10 text-left font-sans uppercase tracking-wider">
                  District
                </span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-50 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
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
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

            </div>
          </div>

          <VendorsList 
            filteredVendors={filteredVendors} 
            users={users} 
            startEdit={startEdit} 
            askDelete={askDelete}
            selectedVendors={selectedVendors}
            setSelectedVendors={setSelectedVendors} 
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

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border shadow-lg p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">Confirm Bulk Deletion</h4>
              <p className="text-[11.5px] text-gray-450 mt-2 font-sans leading-normal">
                Are you sure you want to soft delete <strong>{selectedVendors.length} selected suppliers</strong>? They will hide from the UI immediately.
              </p>
            </div>
            <div className="flex gap-2 font-sans pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 border hover:bg-slate-50 text-xs font-bold text-gray-600 rounded-xl"
              >
                No, Go Back
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteExecute}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-black text-white rounded-xl cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
