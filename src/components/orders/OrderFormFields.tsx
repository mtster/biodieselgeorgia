import React from 'react';
import { Order, Vendor, Warehouse, User, Truck } from '../../types';
import DynamicCustomFields from '../DynamicCustomFields';
import OrderCommentsSection from './OrderCommentsSection';
import OrderCommentModal from './OrderCommentModal';
import { OrderGeneralFields } from './OrderGeneralFields';
import { OrderFulfillmentFields } from './OrderFulfillmentFields';
import { OrderCrewFields } from './OrderCrewFields';
import { useOrderFormContacts } from './useOrderFormContacts';
import { useOrderFormComments } from './useOrderFormComments';

interface OrderFormFieldsProps {
  editingOrder: Order;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  suppliers: Vendor[];
  warehouses: Warehouse[];
  employees: User[];
  trucks: Truck[];
  vendorSearch: string;
  setVendorSearch: (v: string) => void;
  showVendorSuggestions: boolean;
  setShowVendorSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  currentEmployee?: User;
}

export default function OrderFormFields({
  editingOrder,
  setEditingOrder,
  fieldErrors,
  setFieldErrors,
  suppliers,
  warehouses,
  employees,
  trucks,
  vendorSearch,
  setVendorSearch,
  showVendorSuggestions,
  setShowVendorSuggestions,
  currentEmployee
}: OrderFormFieldsProps) {
  const { fetchedContacts } = useOrderFormContacts(
    editingOrder.vendor_id,
    editingOrder.contact_id,
    suppliers,
    setEditingOrder
  );

  const {
    comments,
    isCommentModalOpen,
    activeComment,
    handleAddComment,
    handleModifyComment,
    handleRemoveComment,
    handleSaveCommentModal,
    closeCommentModal
  } = useOrderFormComments(editingOrder, setEditingOrder, currentEmployee);

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-5">
        <OrderGeneralFields
          editingOrder={editingOrder}
          setEditingOrder={setEditingOrder}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
          suppliers={suppliers}
          warehouses={warehouses}
          fetchedContacts={fetchedContacts}
          vendorSearch={vendorSearch}
          setVendorSearch={setVendorSearch}
          showVendorSuggestions={showVendorSuggestions}
          setShowVendorSuggestions={setShowVendorSuggestions}
        />

        <OrderFulfillmentFields
          editingOrder={editingOrder}
          setEditingOrder={setEditingOrder}
          fieldErrors={fieldErrors}
          setFieldErrors={setFieldErrors}
        />

        {/* Dynamic Custom Fields from Columns Manager */}
        <DynamicCustomFields
          storageKey="orders_columns_managed"
          data={editingOrder}
          onChange={(updated) => setEditingOrder(updated)}
        />

        {/* Handover comments dedicated section */}
        <OrderCommentsSection
          comments={comments}
          onAddComment={handleAddComment}
          onModifyComment={handleModifyComment}
          onRemoveComment={handleRemoveComment}
          users={employees}
        />
      </div>

      {/* Crew and Fleet Dispatch Assignments */}
      <OrderCrewFields
        editingOrder={editingOrder}
        setEditingOrder={setEditingOrder}
        trucks={trucks}
        employees={employees}
        fieldErrors={fieldErrors}
        setFieldErrors={setFieldErrors}
      />

      <OrderCommentModal
        isOpen={isCommentModalOpen}
        onClose={closeCommentModal}
        activeComment={activeComment}
        onSave={handleSaveCommentModal}
        onDelete={(id) => {
          handleRemoveComment(id);
          closeCommentModal();
        }}
      />
    </div>
  );
}
