import React, { useState } from 'react';
import { 
  Vendor, VendorContact, VendorComment, 
  Warehouse, User, City, District 
} from '../types';
import { 
  Search, Plus, Edit3, Trash2, FileSpreadsheet, 
  MessageSquare
} from 'lucide-react';

// Modular child components
import VendorForm from './vendors/VendorForm';
import VendorDeleteModal from './vendors/VendorDeleteModal';
import VendorImportModal from './vendors/VendorImportModal';

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

  // Hover state for comment tooltip to render nicely outside overflow boundaries
  const [hoveredComments, setHoveredComments] = useState<{
    comments: VendorComment[];
    rect: { top: number; left: number; width: number; height: number } | null;
  } | null>(null);

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
      <div className="-mt-4 -mx-4 md:-mt-6 md:-mx-6 mb-6">
        <div className="sticky top-0 z-20 bg-[#f8fafc]/95 backdrop-blur-md py-4 px-4 md:px-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none text-left shadow-xs">
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
            {!editingVendor && (
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
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 active:bg-emerald-950 transition-all duration-150 cursor-pointer shadow-sm select-none"
                >
                  <Plus size={15} />
                  Add Supplier
                </button>
              </>
            )}
          </div>
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

          {/* SPREADSHEET TABLE */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-700">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] text-gray-400 uppercase font-mono bg-slate-50 select-none">
                    <th className="py-3 px-4">Trade Name</th>
                    <th className="py-3 px-4">Taxation ID</th>
                    <th className="py-3 px-4">Rate (₾)</th>
                    <th className="py-3 px-4">Working Hours</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Assigned Code</th>
                    <th className="py-3 px-4">Primary Contact</th>
                    <th className="py-3 px-4">Additional Contacts</th>
                    <th className="py-3 px-4">Acquisition Mgr</th>
                    <th className="py-3 px-4">System Dispatch</th>
                    <th className="py-3 px-4">Memos / Internal Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredVendors.map((vendor) => {
                    const manager = users.find(u => u.id === vendor.manager_id);
                    const dispatcher = users.find(u => u.id === vendor.operator_id);
                    const defaultContact = (vendor.contacts || []).find(c => c.is_default);
                    const additionalContacts = (vendor.contacts || []).filter(c => !c.is_default);
                    
                    // Retrieve latest comments safely
                    const latestComment = vendor.comments && vendor.comments.length > 0 
                      ? vendor.comments[0] 
                      : null;

                    return (
                      <tr key={vendor.id} className="hover:bg-slate-50/50">
                        {/* Trade Name */}
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-gray-900 block text-[13px]">{vendor.trade_name}</span>
                          <span className="text-[10px] text-gray-400 block truncate max-w-[150px]" title={vendor.company_name}>{vendor.company_name}</span>
                        </td>

                        {/* Taxation ID */}
                        <td className="py-3 px-4 font-mono font-bold text-gray-550 select-all">
                          {vendor.id_code}
                        </td>

                        {/* Rate */}
                        <td className="py-3 px-4 font-mono font-extrabold text-emerald-800 text-[12px]">
                          ₾ {vendor.price_per_liter.toFixed(2)}
                        </td>

                        {/* Working Hours */}
                        <td className="py-3 px-4 font-sans text-gray-550 font-semibold select-none">
                          {vendor.working_hours}
                        </td>

                        {/* Location */}
                        <td className="py-3 px-4 font-sans">
                          <span className="font-bold text-gray-700 block">{vendor.city} ({vendor.district})</span>
                          <span className="text-[10px] text-gray-400 block truncate max-w-[200px]" title={vendor.address}>{vendor.address}</span>
                        </td>

                        {/* Code Assigned by Us */}
                        <td className="py-3 px-4 font-mono text-gray-500">
                          {vendor.company_code || <span className="text-gray-300">-</span>}
                        </td>

                        {/* Primary Phone */}
                        <td className="py-3 px-4 font-sans text-[11px]">
                          {defaultContact ? (
                            <div>
                              <span className="font-extrabold text-gray-800 block">{defaultContact.name}</span>
                              <span className="text-emerald-800 font-mono font-bold block bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-0.5 select-all">{defaultContact.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-semibold bg-gray-50 px-1 rounded">No Primary Contact</span>
                          )}
                        </td>

                        {/* Additional Phones */}
                        <td className="py-3 px-4 font-sans text-[10px]">
                          {additionalContacts.length > 0 ? (
                            <div className="space-y-1">
                              {additionalContacts.map(c => (
                                <div key={c.id} className="leading-tight">
                                  <span className="font-bold text-gray-600 block">{c.name} ({c.position}):</span>
                                  <span className="text-emerald-800 font-mono font-bold select-all">{c.phone}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>

                        {/* Acquisition Manager */}
                        <td className="py-3 px-4 text-gray-700 font-sans">
                          {manager?.name ? (
                            <span className="font-semibold">{manager.name}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>

                        {/* Systems Dispatcher */}
                        <td className="py-3 px-4 text-gray-700 font-sans">
                          {dispatcher?.name ? (
                            <span className="font-semibold">{dispatcher.name}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>

                        {/* Comment section */}
                        <td 
                          className="py-3 px-4 text-left relative select-none min-w-[160px] cursor-pointer"
                          onMouseEnter={(e) => {
                            if (latestComment && vendor.comments && vendor.comments.length > 0) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredComments({
                                comments: vendor.comments,
                                rect: {
                                  top: rect.top,
                                  left: rect.left,
                                  width: rect.width,
                                  height: rect.height,
                                }
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredComments(null)}
                        >
                          {latestComment ? (
                            <div className="max-w-[150px]">
                              <p className="truncate font-sans text-gray-650 inline-flex items-center gap-1">
                                <MessageSquare size={11} className="text-emerald-500 animate-pulse" />
                                {latestComment.comment}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic font-sans">No comments</span>
                          )}
                        </td>

                        {/* Action buttons */}
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

      {/* FLOATING COMMENTS TOOLTIP */}
      {hoveredComments && hoveredComments.comments.length > 0 && hoveredComments.rect && (
        <div 
          style={{
            position: 'fixed',
            top: hoveredComments.rect.top < 220 
              ? `${hoveredComments.rect.top + hoveredComments.rect.height + 8}px` 
              : `${hoveredComments.rect.top - 8}px`,
            left: `${Math.max(16, hoveredComments.rect.left + (hoveredComments.rect.width / 2) - 160)}px`,
            ...(hoveredComments.rect.top >= 220 ? { transform: 'translateY(-100%)' } : {})
          }}
          className="w-80 bg-slate-100/95 backdrop-blur-md border border-slate-200 text-slate-800 rounded-xl p-3.5 shadow-xl text-[11.5px] leading-relaxed z-50 space-y-2 pointer-events-none select-none transition-all duration-150"
        >
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1 select-text">
            {hoveredComments.comments.map(c => (
              <div key={c.id} className="border-b border-slate-200 last:border-0 pb-1.5 last:pb-0 font-sans">
                <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold mb-0.5 font-sans">
                  <span className="text-emerald-800 font-sans">{c.user_name}</span>
                  <span>{new Date(c.date).toLocaleString()}</span>
                </div>
                <p className="font-sans text-slate-700 break-words">{c.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
