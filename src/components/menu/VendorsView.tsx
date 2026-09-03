import React, { useState, useRef, useEffect } from 'react';
import { t } from '../../utils/lang';
import { 
  Vendor, Warehouse, User, City, District, Communication, Direction 
} from '../../types';
import { Plus, Trash2, Search } from 'lucide-react';

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
import { usePaginatedVendors } from '../../hooks/usePaginatedModuleQuery';
import { useDebounce, useDebouncedSearch } from '../../hooks/useDebounce';

const defaultSuppliersColumns: ManagedColumn[] = [
  { id: 'trade_name', label: 'Trade Name', visible: true },
  { id: 'id_code', label: 'Taxation ID', visible: true },
  { id: 'company_name', label: 'Legal Name', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'price_per_liter', label: 'Rate (₾)', visible: true },
  { id: 'working_hours', label: 'Working Hours', visible: true },
  { id: 'location', label: 'Address', visible: true },
  { id: 'direction', label: 'Direction', visible: true },
  { id: 'overdue_threshold_days', label: 'overdue_threshold_days', visible: true },
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
  initialVendorId?: string;
  onClearInitialVendorId?: () => void;
  onNavigateToOrdersWithVendor?: (vendorId: string) => void;
}

export default function VendorsView({ 
  vendors, warehouses, users, cities, districts, directions,
  currentUser, onSave, onDelete,
  communications = [], onSaveCommunication, onDeleteCommunication,
  initialVendorId, onClearInitialVendorId,
  onNavigateToOrdersWithVendor
}: Props) {

  const canAdd = currentUser?.role === 'admin' || currentUser?.permissions?.['suppliers']?.includes('add');
  const canModify = currentUser?.role === 'admin' || currentUser?.permissions?.['suppliers']?.includes('modify');
  const canDelete = currentUser?.role === 'admin' || currentUser?.permissions?.['suppliers']?.includes('delete');
  const canAddOrder = currentUser?.role === 'admin' || currentUser?.permissions?.['orders']?.includes('add');

  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    triggerImmediateSearch
  } = useDebouncedSearch('', 350);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSalesManager, setSelectedSalesManager] = useState('');
  const [selectedOperationManager, setSelectedOperationManager] = useState('');
  const [selectedDirection, setSelectedDirection] = useState('');
  const [page, setPage] = useState(1);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, selectedCity, selectedDistrict, selectedSalesManager, selectedOperationManager, selectedDirection]);

  // Fetch 12 suppliers per page via TanStack Query
  const filters = {
    searchTerm: debouncedSearchTerm,
    city: selectedCity,
    district: selectedDistrict,
    managerId: selectedSalesManager,
    operatorId: selectedOperationManager,
    directionId: selectedDirection
  };
  const { data: paginatedData, isLoading: isVendorsLoading } = usePaginatedVendors(page, filters, currentUser);

  const displayVendors = paginatedData?.vendors || [];
  const totalVendorsCount = paginatedData?.totalCount || 0;

  // Auto-select purchasing manager's own name in Sales Manager filter on login/visit
  useEffect(() => {
    if (currentUser?.role === 'purchasing_manager' && currentUser?.id) {
      setSelectedSalesManager(currentUser.id);
    }
  }, [currentUser]);
  
  // Active edit state (On-screen form)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isFormSaving, setIsFormSaving] = useState(false);

  // Auto-open vendor form if initialVendorId is supplied
  useEffect(() => {
    if (initialVendorId) {
      const v = vendors.find(v => v.id === initialVendorId);
      if (v) {
        setEditingVendor(v);
        setIsNew(false);
      }
    }
  }, [initialVendorId, vendors]);

  const handleCloseForm = () => {
    setEditingVendor(null);
    onClearInitialVendorId?.();
  };
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
    let cols = loaded ? JSON.parse(loaded) as ManagedColumn[] : defaultSuppliersColumns;
    cols = cols.filter((c: ManagedColumn) => c.id !== 'fact_qty' && c.id !== 'fact_tank_dropoff' && c.id !== 'fact_tank_pickup');
    
    if (!cols.some(c => c.id === 'company_name')) {
      const idCodeIdx = cols.findIndex(c => c.id === 'id_code');
      const newCol: ManagedColumn = { id: 'company_name', label: 'Legal Name', visible: true };
      if (idCodeIdx !== -1) {
        cols.splice(idCodeIdx + 1, 0, newCol);
      } else {
        cols.unshift(newCol);
      }
    }
    return cols;
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
  const formRef = useRef<{ save: () => void; fillDummy: () => void; saveAndOrder?: (onSuccess?: (savedVendorId: string) => void) => void }>(null);
  
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
      working_hours: '10:00 - 19:00',
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
    handleCloseForm();
  };

  const filteredVendors = vendors.filter(v => {
    if (v.is_deleted) return false;
    
    const sLower = searchTerm.trim().toLowerCase();
    const commentMatch = v.comments && Array.isArray(v.comments) && v.comments.some(comm => 
      comm && typeof comm.comment === 'string' && comm.comment.toLowerCase().includes(sLower)
    );
    const matchesSearch = 
      !sLower ||
      (v.trade_name || '').toLowerCase().includes(sLower) ||
      (v.company_name || '').toLowerCase().includes(sLower) ||
      (v.id_code || '').toLowerCase().includes(sLower) ||
      (v.address || '').toLowerCase().includes(sLower) ||
      !!commentMatch;

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
        handleCloseForm();
      }
    }
    setDeleteConfirmId(null);
    setDeleteConfirmName(null);
  };

  const handleSaveAndOrder = () => {
    if (isFormSaving) return;
    if (formRef.current?.saveAndOrder) {
      formRef.current.saveAndOrder((savedVendorId) => {
        handleCloseForm();
        if (onNavigateToOrdersWithVendor && savedVendorId) {
          onNavigateToOrdersWithVendor(savedVendorId);
        }
      });
    }
  };

  const headerActions = (
    <>
      {editingVendor ? (
        <>
          {canAddOrder && (
            <button
              id="btn-vendor-save-and-order"
              type="button"
              onClick={handleSaveAndOrder}
              disabled={isFormSaving}
              className={`px-4 py-2 border border-emerald-700 text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 font-bold rounded-lg text-xs transition cursor-pointer select-none inline-flex items-center gap-1.5 ${isFormSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {t("Save and Order")}
            </button>
          )}
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
            onClick={() => !isFormSaving && formRef.current?.save()}
            disabled={isFormSaving}
            className={`px-5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer select-none inline-flex items-center gap-1.5 ${isFormSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isFormSaving && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
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
              <option value="import" disabled={!canAdd}>{t("Import")}</option>
              <option value="delete" disabled={!canDelete || selectedVendors.length === 0}>
                {t("Delete")} {selectedVendors.length > 0 ? `(${selectedVendors.length})` : ''}
              </option>
              <option value="col_manager">{t("Columns Manager")}</option>
            </select>
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400 text-[9px] select-none">
              ▼
            </span>
          </div>
          
          {canAdd && (
            <button 
              id="btn-add-new-vendor"
              onClick={startNew}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-bold hover:bg-emerald-900 active:bg-emerald-950 transition-all duration-150 cursor-pointer shadow-sm select-none"
            >
              <Plus size={15} />
              {t("Add Supplier")}
            </button>
          )}
        </>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      
      {/* 1. STANDARDIZED PAGE HEADER WITH INTEGRATED ACTION CONTROLS */}
      <PageHeader 
        title={t("Suppliers")}
        onBack={editingVendor ? handleCloseForm : undefined}
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
          onCancel={handleCloseForm}
          formRef={formRef}
          communications={communications}
          onSaveCommunication={onSaveCommunication}
          onDeleteCommunication={onDeleteCommunication}
          isReadOnly={isReadOnly}
          onSavingStateChange={setIsFormSaving}
        />
      ) : (
        <div className="space-y-6 text-left">
                 {/* ADVANCED MULTI-PROPERTY SEARCH & FILTERS CONTROLS */}
          <div className="space-y-4">
            {/* Search Input element on top */}
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                <Search size={15} />
              </span>
              <input
                id="vendors-search-input-standalone"
                type="text"
                placeholder="ძებნა მომწოდებლის დასახელებით, იურიდიული პირით, ს/კ, მისამართით, შიდა კოდით ან კონტაქტის ნომრით..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    triggerImmediateSearch();
                  }
                }}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-gray-900 font-sans"
              />
            </div>

            {/* Filters displayed below search input */}
            <div className="flex flex-wrap items-center gap-4 w-full select-none font-sans">
              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  {t("City")}
                </span>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedDistrict('');
                  }}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Cities")}</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  {t("District")}
                </span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Districts")}</option>
                  {districts
                    .filter(d => {
                      const cObj = cities.find(x => x.name === selectedCity);
                      return !cObj || d.city_id === cObj.id;
                    })
                    .map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  {t("Sales Manager")}
                </span>
                <select
                  value={selectedSalesManager}
                  onChange={(e) => setSelectedSalesManager(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Sales Managers")}</option>
                  {users
                    .filter(u => u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'purchasing_manager')
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  {t("Operation Manager")}
                </span>
                <select
                  value={selectedOperationManager}
                  onChange={(e) => setSelectedOperationManager(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Operation Managers")}</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>

              <div className="relative w-full md:w-auto min-w-[140px]">
                <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
                  {t("Directions")}
                </span>
                <select
                  value={selectedDirection}
                  onChange={(e) => setSelectedDirection(e.target.value)}
                  className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
                >
                  <option value="">{t("All Directions")}</option>
                  {directions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
                  ▼
                </div>
              </div>
            </div>
          </div>

          <VendorsList 
            filteredVendors={displayVendors} 
            users={users} 
            directions={directions}
            startEdit={startEdit} 
            askDelete={askDelete}
            selectedVendors={selectedVendors}
            setSelectedVendors={setSelectedVendors} 
            managedCols={managedCols}
            communications={communications}
            serverTotalCount={totalVendorsCount}
            page={page}
            onPageChange={setPage}
            isLoading={isVendorsLoading}
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
        directions={directions}
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
