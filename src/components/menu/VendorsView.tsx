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
    onClearInitialVendorId
  });

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
          />
        }
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
    </div>
  );
}
