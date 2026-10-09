import React from 'react';
import { t } from '../../utils/lang';
import { 
  Order, Vendor, Warehouse, User, Truck, Direction, Communication 
} from '../../types';

// Modular child components
import OrderForm from '../orders/OrderForm';
import SMSLogsModal from '../orders/SMSLogsModal';
import AssignDriverModal from '../orders/AssignDriverModal';
import OrdersList from '../orders/OrdersList';
import PageHeader from '../PageHeader';
import ConfirmDeleteModal from '../ConfirmDeleteModal';
import ColumnsManagerModal from '../ColumnsManagerModal';
import { useOrdersViewState } from '../orders/useOrdersViewState';
import { OrdersViewFilters } from '../orders/OrdersViewFilters';
import { OrdersViewHeaderActions } from '../orders/OrdersViewHeaderActions';
import { OrderBulkDeleteModal } from '../orders/OrderBulkDeleteModal';

interface Props {
  orders: Order[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  directions: Direction[];
  currentEmployee: User;
  onSave: (order: Order) => Promise<any> | void;
  onDelete: (id: string, docNum: string) => void;
  onSaveCommunication?: (comm: Communication) => Promise<void> | void;
  onDeleteCommunication?: (id: string) => Promise<void> | void;
  initialOrderVendorId?: string;
  onClearInitialOrderVendorId?: () => void;
  initialVendorId?: string;
  onClearInitialVendorId?: () => void;
  onNavigateToNewOrderWithVendor?: (vendorId: string) => void;
  onNavigateToCommunicationsWithVendor?: (vendorId: string) => void;
}

export default function OrdersView({
  orders, suppliers, warehouses, employees, trucks, directions,
  currentEmployee, onSave, onDelete, onSaveCommunication, onDeleteCommunication,
  initialOrderVendorId, onClearInitialOrderVendorId,
  initialVendorId, onClearInitialVendorId,
  onNavigateToCommunicationsWithVendor
}: Props) {
  const effectiveInitialVendorId = initialOrderVendorId || initialVendorId;
  const effectiveClearInitialVendorId = onClearInitialOrderVendorId || onClearInitialVendorId;

  const {
    canAdd,
    canDelete,
    canAddComm,
    searchTerm,
    setSearchTerm,
    triggerImmediateSearch,
    selectedStatus,
    setSelectedStatus,
    selectedCity,
    setSelectedCity,
    selectedDistrict,
    setSelectedDistrict,
    selectedDirection,
    setSelectedDirection,
    selectedVehicle,
    setSelectedVehicle,
    selectedManager,
    setSelectedManager,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isLogisticsManager,
    page,
    setPage,
    displayOrders,
    totalOrdersCount,
    isOrdersLoading,
    editingOrder,
    setEditingOrder,
    isFormSaving,
    setIsFormSaving,
    showSMSLogs,
    setShowSMSLogs,
    smsLogs,
    loadSMSLogs,
    showAssignDriverModal,
    setShowAssignDriverModal,
    selectedOrders,
    setSelectedOrders,
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    isColModalOpen,
    setIsColModalOpen,
    managedCols,
    handleSaveColumns,
    defaultOrdersColumns,
    deleteConfirmId,
    setDeleteConfirmId,
    deleteConfirmDocNum,
    setDeleteConfirmDocNum,
    formRef,
    startNew,
    startEdit,
    handleBulkDeleteExecute,
    handleSaveFromForm,
    handleSaveAndReminder,
    askDelete,
    confirmDelete,
    handleAssignDriverSave
  } = useOrdersViewState({
    orders,
    suppliers,
    warehouses,
    trucks,
    currentEmployee,
    onSave,
    onDelete,
    initialOrderVendorId: effectiveInitialVendorId,
    onClearInitialOrderVendorId: effectiveClearInitialVendorId
  });

  return (
    <div className="space-y-6">
      {/* 1. STANDARDIZED PAGE HEADER */}
      <PageHeader 
        title={editingOrder ? (editingOrder.id ? `${t("Order")}: ${editingOrder.doc_number}` : t("New Order")) : t("Orders")}
        onBack={editingOrder ? () => setEditingOrder(null) : undefined}
        backButtonId="order-form-back-arrow"
        actions={
          <OrdersViewHeaderActions
            editingOrder={editingOrder}
            canDelete={canDelete}
            canAdd={canAdd}
            canAddComm={canAddComm}
            isFormSaving={isFormSaving}
            selectedOrders={selectedOrders}
            smsLogsCount={smsLogs.length}
            handleSaveAndReminder={handleSaveAndReminder}
            formRef={formRef}
            askDelete={askDelete}
            loadSMSLogs={loadSMSLogs}
            setShowSMSLogs={setShowSMSLogs}
            setShowBulkDeleteConfirm={setShowBulkDeleteConfirm}
            setShowAssignDriverModal={setShowAssignDriverModal}
            setIsColModalOpen={setIsColModalOpen}
            startNew={startNew}
          />
        }
      />

      {/* 2. FORM OR LIST VIEW */}
      {editingOrder ? (
        <OrderForm
          editingOrder={editingOrder}
          setEditingOrder={setEditingOrder}
          suppliers={suppliers}
          warehouses={warehouses}
          employees={employees}
          trucks={trucks}
          currentEmployee={currentEmployee}
          onSave={handleSaveFromForm}
          onCancel={() => setEditingOrder(null)}
          formRef={formRef}
          onDeleteCommunication={onDeleteCommunication}
          onSaveCommunication={onSaveCommunication}
          onSavingStateChange={setIsFormSaving}
        />
      ) : (
        <div className="space-y-6 text-left">
          <OrdersViewFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            triggerImmediateSearch={triggerImmediateSearch}
            isLogisticsManager={isLogisticsManager}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            selectedCity={selectedCity}
            setSelectedCity={setSelectedCity}
            selectedDistrict={selectedDistrict}
            setSelectedDistrict={setSelectedDistrict}
            selectedDirection={selectedDirection}
            setSelectedDirection={setSelectedDirection}
            selectedVehicle={selectedVehicle}
            setSelectedVehicle={setSelectedVehicle}
            selectedManager={selectedManager}
            setSelectedManager={setSelectedManager}
            suppliers={suppliers}
            directions={directions}
            trucks={trucks}
            employees={employees}
            setPage={setPage}
          />

          <OrdersList 
            currentEmployee={currentEmployee}
            filteredOrders={displayOrders} 
            suppliers={suppliers} 
            warehouses={warehouses}
            employees={employees}
            directions={directions}
            trucks={trucks}
            startEdit={startEdit} 
            askDelete={askDelete}
            selectedOrders={selectedOrders}
            setSelectedOrders={setSelectedOrders} 
            managedCols={managedCols}
            serverTotalCount={totalOrdersCount}
            page={page}
            onPageChange={setPage}
            isLoading={isOrdersLoading}
          />
        </div>
      )}

      <ColumnsManagerModal
        isOpen={isColModalOpen}
        onClose={() => setIsColModalOpen(false)}
        columns={managedCols}
        onSave={handleSaveColumns}
        storageKey="orders_columns_managed"
        defaultColumns={defaultOrdersColumns}
      />

      {/* SMS DISPATCH LOG LOGGER POPUP */}
      <SMSLogsModal
        isOpen={showSMSLogs}
        onClose={() => setShowSMSLogs(false)}
        smsLogs={smsLogs}
      />

      <AssignDriverModal
        isOpen={showAssignDriverModal}
        onClose={() => setShowAssignDriverModal(false)}
        onSave={handleAssignDriverSave}
        orders={selectedOrders.map(id => (displayOrders || []).find(o => o.id === id) || orders.find(o => o.id === id)!).filter(Boolean)}
        employees={employees}
        trucks={trucks}
        suppliers={suppliers}
        warehouses={warehouses}
      />

      {/* SYSTEM CONFIRMATION DELETE MODAL */}
      <ConfirmDeleteModal
        isOpen={!!deleteConfirmId}
        onClose={() => {
          setDeleteConfirmId(null);
          setDeleteConfirmDocNum(null);
        }}
        onConfirm={confirmDelete}
        title={t("Order Dispatch Soft Deletion")}
        message={
          <span>
            {t("Are you sure you want to completely cancel and soft delete high-priority order dispatch")} <strong>"{deleteConfirmDocNum}"</strong>? {t("They will hide from the UI immediately.")}
          </span>
        }
      />

      {/* BULK DELETE CONFIRMATION MODAL */}
      <OrderBulkDeleteModal
        isOpen={showBulkDeleteConfirm}
        selectedCount={selectedOrders.length}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleBulkDeleteExecute}
      />
    </div>
  );
}
