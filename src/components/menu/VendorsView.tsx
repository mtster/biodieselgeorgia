import React, { useState, useRef } from 'react';
import { t } from '../../utils/lang';
import { 
  Vendor, Warehouse, User, City, District, Communication, Direction 
} from '../../types';
import { Plus, Trash2 } from 'lucide-react';

// Modular child components
import VendorForm from '../vendors/VendorForm';
import VendorImportModal from '../vendors/VendorImportModal';
import VendorsList from '../vendors/VendorsList';
import PageHeader from '../PageHeader';
import CentralSearchBar from '../CentralSearchBar';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import ColumnsManagerModal, { ManagedColumn } from '../ColumnsManagerModal';
import DeleteButton from '../DeleteButton';
import { createDatabaseColumn } from '../../services/vendorService';

const defaultSuppliersColumns: ManagedColumn[] = [
  { id: 'trade_name', label: 'Trade Name', visible: true },
  { id: 'id_code', label: 'Taxation ID', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'price_per_liter', label: 'Rate (₾)', visible: true },
  { id: 'working_hours', label: 'Working Hours', visible: true },
  { id: 'location', label: 'Location', visible: true },
  { id: 'direction', label: 'Direction', visible: true },
  { id: 'vada', label: 'Vada', visible: true },
  { id: 'barrels_amount', label: 'Barrels Amount', visible: true },
  { id: 'company_code', label: 'Assigned Code', visible: true },
  { id: 'primary_contact', label: 'Primary Contact', visible: true },
  { id: 'additional_contacts', label: 'Additional Contacts', visible: true },
  { id: 'manager', label: 'Sales Manager', visible: true },
  { id: 'dispatcher', label: 'Operation Manager', visible: true },
  { id: 'communications', label: 'Communications', visible: true },
  { id: 'comments', label: 'Memos / Internal Notes', visible: true }
];

interface Props {
  vendors: Vendor[];
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  directions: Direction[];
  currentUser: User;
  onSave: (vendor: Vendor) => void;
  onDelete: (id: string, tradeName: string) => void;

  onAddCity?: (name: string) => void;
  onAddDistrict?: (cityId: string, name: string) => void;
  onAddWarehouse?: (name: string) => void;

  communications?: Communication[];
  onSaveCommunication?: (comm: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
}

export default function VendorsView({ 
  vendors, warehouses, users, cities, districts, directions,
  currentUser, onSave, onDelete,
  communications = [], onSaveCommunication, onDeleteCommunication
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSalesManager, setSelectedSalesManager] = useState('');
  const [selectedOperationManager, setSelectedOperationManager] = useState('');
  const [selectedDirection, setSelectedDirection] = useState('');
  
  // Active edit state (On-screen form)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Read-only and bulk-delete selection states
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Columns Manager State
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [managedCols, setManagedCols] = useState<ManagedColumn[]>(() => {
    const loaded = localStorage.getItem('suppliers_columns_managed');
    const cols = loaded ? JSON.parse(loaded) as ManagedColumn[] : defaultSuppliersColumns;
    return cols.filter((c: ManagedColumn) => c.id !== 'fact_qty' && c.id !== 'fact_tank_dropoff' && c.id !== 'fact_tank_pickup');
  });

  const handleSaveColumns = async (updated: ManagedColumn[]) => {
    setManagedCols(updated);
    localStorage.setItem('suppliers_columns_managed', JSON.stringify(updated));

    // Provision each dynamic custom column securely in Supabase vendors table
    for (const col of updated) {
      if (col.isCustom && col.id.startsWith('custom_')) {
        try {
          await createDatabaseColumn(col.id);
        } catch (err) {
          console.error(`Error provisioning custom column on db [${col.id}]:`, err);
        }
      }
    }
  };

  // Delete confirmation modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  // Action triggers for child forms
  const formRef = useRef<{ save: () => void; fillDummy: () => void }>(null);
  
  const scrollMainToTop = () => {
    setTimeout(() => {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }, 0);
  };

  const startEdit = (vendor: Vendor, readOnly = false) => {
    setEditingVendor(JSON.parse(JSON.stringify(vendor)));
    setIsNew(false);
    setIsReadOnly(readOnly);
    scrollMainToTop();
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
    scrollMainToTop();
  };

  const handleBulkDeleteExecute = () => {
    selectedVendors.forEach(id => {
      const vend = vendors.find(v => v.id === id);
      onDelete(id, vend?.trade_name || '');
    });
    setSelectedVendors([]);
    setShowBulkDeleteConfirm(false);
  };

  const handleSaveFromForm = (payload: Vendor) => {
    onSave(payload);
    setEditingVendor(null);
  };

  const filteredVendors = vendors.filter(v => {
    if (v.is_deleted) return false;
    
    const matchesSearch = 
      v.trade_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.id_code.includes(searchTerm);

    const matchesCity = !selectedCity || v.city === selectedCity;
    const matchesDistrict = !selectedDistrict || v.district === selectedDistrict;

    const matchesSalesManager = !selectedSalesManager || v.manager_id === selectedSalesManager;
    const matchesOperationManager = !selectedOperationManager || v.operator_id === selectedOperationManager;
    const matchesDirection = !selectedDirection || v.direction_id === selectedDirection;

    return matchesSearch && matchesCity && matchesDistrict && matchesSalesManager && matchesOperationManager && matchesDirection;
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

  const headerActions = (
    <>
      {editingVendor ? (
        <>
          {isNew && (
            <button 
              onClick={() => formRef.current?.fillDummy()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer select-none"
            >
              {t("Fill Dummy")}
            </button>
          )}
          {!isNew && (
            <DeleteButton
              onClick={() => askDelete(editingVendor.id, editingVendor.trade_name)}
            />
          )}
          <button 
            onClick={() => formRef.current?.save()}
            className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer select-none"
          >
            {t("Save")}
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
                } else if (val === 'col_manager') {
                  setIsColModalOpen(true);
                }
                e.target.value = ''; // Reset select trigger
              }}
              className="px-3.5 py-2.5 pr-8 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-gray-200 cursor-pointer select-none focus:outline-none appearance-none font-sans"
            >
              <option value="" disabled hidden>{t("Actions")}</option>
              <option value="import">{t("Import")}</option>
              <option value="delete" disabled={selectedVendors.length === 0}>
                {t("Delete")} {selectedVendors.length > 0 ? `(${selectedVendors.length})` : ''}
              </option>
              <option value="col_manager">{t("Columns Manager")}</option>
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
            {t("Add Supplier")}
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER WITH INTEGRATED ACTION CONTROLS */}
      <PageHeader 
        title={t("Suppliers")}
        onBack={editingVendor ? () => setEditingVendor(null) : undefined}
        backButtonId="vendor-form-back-arrow"
        actions={headerActions}
      />

      {/* 2. FORM OR LIST SPREADSHEET CANVAS */}
      {editingVendor ? (
        <VendorForm
          editingVendor={editingVendor}
          setEditingVendor={setEditingVendor}
          warehouses={warehouses}
          users={users}
          cities={cities}
          districts={districts}
          directions={directions}
          currentUser={currentUser}
          onSave={handleSaveFromForm}
          onCancel={() => setEditingVendor(null)}
          formRef={formRef}
          communications={communications}
          onSaveCommunication={onSaveCommunication}
          onDeleteCommunication={onDeleteCommunication}
          isReadOnly={isReadOnly}
        />
      ) : (
        <div className="space-y-6 text-left">
          
          {/* ADVANCED MULTI-PROPERTY SEARCH & FILTERS CONTROLS */}
          <CentralSearchBar 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            idPrefix="vendors-search"
            searchPlaceholder={t("Search suppliers by trade name, legal entity, or registered taxation ID coordinates...")}
            filters={[
              {
                label: t("City"),
                value: selectedCity,
                onChange: (val) => {
                  setSelectedCity(val);
                  setSelectedDistrict('');
                },
                placeholder: t("All Cities"),
                options: cities.map(c => ({ value: c.name, label: c.name }))
              },
              {
                label: t("District"),
                value: selectedDistrict,
                onChange: setSelectedDistrict,
                placeholder: t("All Districts"),
                options: districts
                  .filter(d => {
                    const cObj = cities.find(x => x.name === selectedCity);
                    return !cObj || d.city_id === cObj.id;
                  })
                  .map(d => ({ value: d.name, label: d.name }))
              },
              {
                label: t("Sales Manager"),
                value: selectedSalesManager,
                onChange: setSelectedSalesManager,
                placeholder: t("All Sales Managers"),
                options: users
                  .filter(u => u.role === 'manager' || u.role === 'admin')
                  .map(u => ({ value: u.id, label: u.name }))
              },
              {
                label: t("Operation Manager"),
                value: selectedOperationManager,
                onChange: setSelectedOperationManager,
                placeholder: t("All Operation Managers"),
                options: users
                  .map(u => ({ value: u.id, label: u.name }))
              },
              {
                label: t("Directions"),
                value: selectedDirection,
                onChange: setSelectedDirection,
                placeholder: t("All Directions"),
                options: directions.map(d => ({ value: d.id, label: d.name }))
              }
            ]}
          />

          <VendorsList 
            filteredVendors={filteredVendors} 
            users={users} 
            directions={directions}
            startEdit={startEdit} 
            askDelete={askDelete}
            selectedVendors={selectedVendors}
            setSelectedVendors={setSelectedVendors} 
            managedCols={managedCols}
            communications={communications}
          />
        </div>
      )}

      <ColumnsManagerModal
        isOpen={isColModalOpen}
        onClose={() => setIsColModalOpen(false)}
        columns={managedCols}
        onSave={handleSaveColumns}
        storageKey="suppliers_columns_managed"
        defaultColumns={defaultSuppliersColumns}
      />

      {/* EXCEL BULK IMPORT MODAL */}
      <VendorImportModal
        isOpen={isImporting}
        onClose={() => setIsImporting(false)}
        warehouses={warehouses}
        users={users}
        cities={cities}
        districts={districts}
        currentUser={currentUser}
        onComplete={() => window.location.reload()}
      />

      {/* DELETE CONFIRMATION SYSTEM MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmId}
        onClose={() => {
          setDeleteConfirmId(null);
          setDeleteConfirmName(null);
        }}
        onConfirm={confirmDelete}
        title={t("Remove Supplier?")}
        message={
          <span>
            {t("Are you sure you want to delete supplier")} <strong>"{deleteConfirmName}"</strong>? {t("This supplier profile coordinates will be soft deleted.")}
          </span>
        }
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border shadow-lg p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none">{t("Confirm Bulk Deletion")}</h4>
              <p className="text-[11.5px] text-gray-450 mt-2 font-sans leading-normal">
                {t("Are you sure you want to soft delete")} <strong>{selectedVendors.length} {t("selected suppliers")}</strong>? {t("They will hide from the UI immediately.")}
              </p>
            </div>
            <div className="flex gap-2 font-sans pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 py-2 border hover:bg-slate-50 text-xs font-bold text-gray-600 rounded-xl"
              >
                {t("No, Go Back")}
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteExecute}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-xs font-black text-white rounded-xl cursor-pointer"
              >
                {t("Yes, Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
