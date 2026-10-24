import React from 'react';
import { t } from '../../utils/lang';
import { 
  Vendor, Warehouse, User, City, District, Communication, Direction 
} from '../../types';

// Modular child components
import VendorForm from '../vendors/VendorForm';
import VendorImportModal from '../vendors/VendorImportModal';
import VendorsList from '../vendors/VendorsList';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import ColumnsManagerModal from '../ColumnsManagerModal';
import { VendorGeolocationModal } from '../vendors/VendorGeolocationModal';
import { VendorsViewFilters } from '../vendors/VendorsViewFilters';
import { VendorsViewHeaderActions } from '../vendors/VendorsViewHeaderActions';
import { VendorBulkDeleteModal } from '../vendors/VendorBulkDeleteModal';
import { useVendorsViewState } from '../vendors/useVendorsViewState';
import { exportAllVendorsToExcel } from '../../services/vendorExportService';
import { verifyUserRoleAllowed } from '../../utils/jwtAuth';
import { ShieldAlert } from 'lucide-react';

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
  initialVendor?: Vendor;
  onClearInitialVendorId?: () => void;
  onNavigateToOrdersWithVendor?: (vendorId: string) => void;
}

export default function VendorsView({ 
  vendors, warehouses, users, cities, districts, directions,
  currentUser, onSave, onDelete,
  communications = [], onSaveCommunication, onDeleteCommunication,
  initialVendorId, initialVendor, onClearInitialVendorId,
  onNavigateToOrdersWithVendor
}: Props) {
  const {
    canAdd,
    canDelete,
    canAddOrder,
    searchTerm,
    setSearchTerm,
    triggerImmediateSearch,
    selectedCity,
    setSelectedCity,
    selectedDistrict,
    setSelectedDistrict,
    selectedSalesManager,
    setSelectedSalesManager,
    selectedOperationManager,
    setSelectedOperationManager,
    selectedDirection,
    setSelectedDirection,
    selectedBankAccountFilter,
    setSelectedBankAccountFilter,
    page,
    setPage,
    displayVendors,
    totalVendorsCount,
    isVendorsLoading,
    editingVendor,
    setEditingVendor,
    isFormSaving,
    setIsFormSaving,
    isNew,
    isImporting,
    setIsImporting,
    isReadOnly,
    selectedVendors,
    setSelectedVendors,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    isColModalOpen,
    setIsColModalOpen,
    managedCols,
    handleSaveColumns,
    defaultSuppliersColumns,
    deleteConfirmId,
    setDeleteConfirmId,
    deleteConfirmName,
    setDeleteConfirmName,
    showGeolocationModal,
    setShowGeolocationModal,
    formRef,
    startNew,
    startEdit,
    handleCloseForm,
    handleSaveAndOrder,
    handleSaveFromForm,
    askDelete,
    confirmDelete,
    handleBulkDeleteExecute,
    refreshVendorsQuery
  } = useVendorsViewState({
    vendors,
    currentUser,
    onSave,
    onDelete,
    initialVendorId,
    initialVendor,
    onClearInitialVendorId,
    onNavigateToOrdersWithVendor
  });

  const [isExporting, setIsExporting] = React.useState(false);
  const [jwtError, setJwtError] = React.useState<string | null>(null);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setJwtError(null);
    try {
      // Evaluate logged-in user's cryptographic JWT token and server claims
      const authCheck = await verifyUserRoleAllowed(['admin', 'purchasing_head']);
      if (!authCheck.allowed) {
        setJwtError(authCheck.error || 'წვდომა შეზღუდულია: მომწოდებლების სიის ექსპორტის უფლება აქვთ მხოლოდ ადმინისტრატორსა (admin) და შესყიდვების უფროსს (purchasing_head).');
        return;
      }

      await exportAllVendorsToExcel({
        cities,
        districts,
        directions,
        warehouses,
        users,
        fallbackVendors: vendors
      });
    } catch (err: any) {
      console.error('Failed to export suppliers to Excel:', err);
      setJwtError('ექსპორტის შეცდომა: ' + (err?.message || 'უცნობი შეცდომა'));
    } finally {
      setIsExporting(false);
    }
  };

  const canExport = currentUser ? (currentUser.role === 'admin' || currentUser.role === 'purchasing_head') : false;

  return (
    <div className="space-y-6">
      {/* 1. STANDARDIZED PAGE HEADER WITH INTEGRATED ACTION CONTROLS */}
      <PageHeader 
        title={t("Suppliers")}
        onBack={editingVendor ? handleCloseForm : undefined}
        backButtonId="vendor-form-back-arrow"
        actions={
          <VendorsViewHeaderActions
            editingVendor={editingVendor}
            isNew={isNew}
            isFormSaving={isFormSaving}
            canAdd={canAdd}
            canDelete={canDelete}
            canAddOrder={canAddOrder}
            selectedVendors={selectedVendors}
            handleSaveAndOrder={handleSaveAndOrder}
            formRef={formRef}
            askDelete={askDelete}
            setIsImporting={setIsImporting}
            setShowBulkDeleteConfirm={setShowBulkDeleteConfirm}
            setIsColModalOpen={setIsColModalOpen}
            setShowGeolocationModal={setShowGeolocationModal}
            startNew={startNew}
            onExport={handleExport}
            isExporting={isExporting}
            canExport={canExport}
          />
        }
      />

      {/* 2. FORM OR LIST SPREADSHEET CANVAS */}
      {editingVendor ? (
        <VendorForm
          editingVendor={editingVendor}
          setEditingVendor={setEditingVendor}
          existingVendors={vendors}
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
          isNew={isNew}
          onSavingStateChange={setIsFormSaving}
        />
      ) : (
        <div className="space-y-6 text-left">
          <VendorsViewFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            triggerImmediateSearch={triggerImmediateSearch}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            selectedDistrict={selectedDistrict}
            setSelectedDistrict={setSelectedDistrict}
            selectedSalesManager={selectedSalesManager}
            setSelectedSalesManager={setSelectedSalesManager}
            selectedOperationManager={selectedOperationManager}
            setSelectedOperationManager={setSelectedOperationManager}
            selectedDirection={selectedDirection}
            setSelectedDirection={setSelectedDirection}
            selectedBankAccountFilter={selectedBankAccountFilter}
            setSelectedBankAccountFilter={setSelectedBankAccountFilter}
            cities={cities}
            districts={districts}
            users={users}
            directions={directions}
            setPage={setPage}
          />

          <VendorsList 
            filteredVendors={displayVendors} 
            users={users} 
            directions={directions}
            cities={cities}
            districts={districts}
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
      <VendorBulkDeleteModal
        isOpen={showBulkDeleteConfirm}
        selectedCount={selectedVendors.length}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDeleteExecute}
      />

      {/* VENDOR GEOLOCATION PROGRESS MODAL */}
      <VendorGeolocationModal
        isOpen={showGeolocationModal}
        onClose={() => setShowGeolocationModal(false)}
        onSuccess={refreshVendorsQuery}
        vendors={vendors}
      />

      {/* SECURITY ACCESS DENIED MODAL */}
      {jwtError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-200 space-y-4 text-left">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <ShieldAlert size={22} />
              </div>
              <h3 className="font-bold text-base text-gray-900">წვდომა შეზღუდულია</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              თქვენ შეზღუდული გაქვთ წვდომა ექსპორტზე.
            </p>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setJwtError(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                დახურვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
