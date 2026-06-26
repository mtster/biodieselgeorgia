import React from 'react';
import { Vendor, Warehouse, User, City, District, Direction } from '../../types';
import DynamicCustomFields from '../DynamicCustomFields';
import VendorCoreFormFields from './VendorCoreFormFields';
import VendorLocationFormFields from './VendorLocationFormFields';
import VendorManagementFormFields from './VendorManagementFormFields';

interface VendorFormFieldsProps {
  editingVendor: Vendor;
  setEditingVendor: React.Dispatch<React.SetStateAction<Vendor | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  warehouses: Warehouse[];
  users: User[];
  cities: City[];
  districts: District[];
  directions: Direction[];
  currentUser: User;
}

export default function VendorFormFields({
  editingVendor,
  setEditingVendor,
  fieldErrors,
  setFieldErrors,
  warehouses,
  users,
  cities,
  districts,
  directions,
  currentUser
}: VendorFormFieldsProps) {
  return (
    <div className="space-y-5">
      <VendorCoreFormFields
        editingVendor={editingVendor}
        setEditingVendor={setEditingVendor}
        fieldErrors={fieldErrors}
        setFieldErrors={setFieldErrors}
        warehouses={warehouses}
      />

      <VendorLocationFormFields
        editingVendor={editingVendor}
        setEditingVendor={setEditingVendor}
        fieldErrors={fieldErrors}
        setFieldErrors={setFieldErrors}
        cities={cities}
        districts={districts}
        directions={directions}
      />

      <VendorManagementFormFields
        editingVendor={editingVendor}
        setEditingVendor={setEditingVendor}
        fieldErrors={fieldErrors}
        setFieldErrors={setFieldErrors}
        users={users}
        currentUser={currentUser}
      />

      {/* Dynamic Custom Fields from Columns Manager */}
      <DynamicCustomFields
        storageKey="suppliers_columns_managed"
        data={editingVendor}
        onChange={(updated) => setEditingVendor(updated)}
      />
    </div>
  );
}
