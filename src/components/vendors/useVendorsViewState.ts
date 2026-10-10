import { useState, useRef, useEffect } from 'react';
import { Vendor, User } from '../../types';
import { usePaginatedVendors } from '../../hooks/usePaginatedModuleQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useDebouncedSearch } from '../../hooks/useDebounce';
import { useVendorColumns } from './useVendorColumns';

interface UseVendorsViewStateParams {
  vendors: Vendor[];
  currentUser: User;
  onSave: (vendor: Vendor) => void;
  onDelete: (id: string, tradeName: string) => void;
  initialVendorId?: string;
  onClearInitialVendorId?: () => void;
  onNavigateToOrdersWithVendor?: (vendorId: string) => void;
}

export function useVendorsViewState({
  vendors,
  currentUser,
  onSave,
  onDelete,
  initialVendorId,
  onClearInitialVendorId,
  onNavigateToOrdersWithVendor
}: UseVendorsViewStateParams) {
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
  const [showGeolocationModal, setShowGeolocationModal] = useState(false);
  const queryClient = useQueryClient();

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, selectedCity, selectedDistrict, selectedSalesManager, selectedOperationManager, selectedDirection]);

  // Fetch suppliers per page via TanStack Query
  const filters = {
    searchTerm: debouncedSearchTerm,
    city: selectedCity,
    district: selectedDistrict,
    managerId: selectedSalesManager,
    operatorId: selectedOperationManager,
    directionId: selectedDirection
  };

  const { data: paginatedData, isLoading: isVendorsLoading, refetch: refetchVendors } = usePaginatedVendors(page, filters, currentUser);

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
  const [isNew, setIsNew] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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

  // Columns Manager State
  const {
    isColModalOpen,
    setIsColModalOpen,
    managedCols,
    handleSaveColumns,
    defaultSuppliersColumns
  } = useVendorColumns();

  // Single delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  const formRef = useRef<{ save: (onSuccess?: (savedVendorId: string) => void) => void; fillDummy: () => void; saveAndOrder?: (onSuccess?: (savedVendorId: string) => void) => void }>(null);

  const scrollMainToTop = () => {
    setTimeout(() => {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }, 0);
  };

  const startNew = () => {
    const defaultVendor: Vendor = {
      id: '',
      id_code: '',
      company_name: '',
      trade_name: '',
      company_code: '',
      bank_account: '',
      status: 'Active',
      city: '',
      district: '',
      address: '',
      price_per_liter: 0,
      warehouse_id: '',
      manager_id: '',
      operator_id: '',
      contacts: [],
      comments: [],
      working_hours: '',
      barrels_amount: 0,
      created_at: new Date().toISOString()
    };
    setEditingVendor(defaultVendor);
    setIsNew(true);
    setIsReadOnly(false);
    scrollMainToTop();
  };

  const startEdit = (vendor: Vendor, readOnly = false) => {
    setEditingVendor(JSON.parse(JSON.stringify(vendor)));
    setIsNew(false);
    setIsReadOnly(readOnly);
    scrollMainToTop();
  };

  const handleSaveAndOrder = () => {
    const vendorIdFromEditing = editingVendor?.id;
    const navCallback = (savedVendorId?: string) => {
      const targetVendorId = savedVendorId || vendorIdFromEditing || '';
      setEditingVendor(null);
      if (targetVendorId) {
        onNavigateToOrdersWithVendor?.(targetVendorId);
      }
    };
    if (formRef.current?.saveAndOrder) {
      formRef.current.saveAndOrder(navCallback);
    } else if (formRef.current?.save) {
      formRef.current.save(navCallback);
    } else if (vendorIdFromEditing) {
      navCallback(vendorIdFromEditing);
    }
  };

  const handleSaveFromForm = async (finalVendor: Vendor) => {
    const res = await onSave(finalVendor);
    setEditingVendor(null);
    onClearInitialVendorId?.();
    queryClient.invalidateQueries({ queryKey: ['vendors'] });
    refetchVendors();
    return res;
  };

  const askDelete = (id: string, name: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      onDelete(deleteConfirmId, deleteConfirmName || '');
      if (editingVendor && editingVendor.id === deleteConfirmId) {
        setEditingVendor(null);
        onClearInitialVendorId?.();
      }
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      refetchVendors();
    }
    setDeleteConfirmId(null);
    setDeleteConfirmName(null);
  };

  const handleBulkDeleteExecute = () => {
    selectedVendors.forEach(id => {
      const v = vendors.find(item => item.id === id);
      onDelete(id, v?.trade_name || '');
    });
    setSelectedVendors([]);
    setShowBulkDeleteConfirm(false);
    queryClient.invalidateQueries({ queryKey: ['vendors'] });
    refetchVendors();
  };

  const refreshVendorsQuery = () => {
    queryClient.invalidateQueries({ queryKey: ['vendors'] });
    refetchVendors();
  };

  return {
    canAdd,
    canModify,
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
  };
}
