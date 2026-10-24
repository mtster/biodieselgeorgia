import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Order, Vendor, Warehouse, User, Truck } from '../../types';
import { getSMSLogs, batchAssignCrewToOrders, batchUnassignCrewFromOrders, batchDeleteOrders } from '../../services/orderService';
import { usePaginatedOrders } from '../../hooks/usePaginatedModuleQuery';
import { useDebouncedSearch } from '../../hooks/useDebounce';
import { useOrderColumns } from './useOrderColumns';

interface UseOrdersViewStateParams {
  orders: Order[];
  suppliers: Vendor[];
  warehouses: Warehouse[];
  trucks: Truck[];
  currentEmployee: User;
  onSave: (order: Order) => Promise<any> | void;
  onDelete: (id: string, docNum: string) => void;
  initialOrderVendorId?: string;
  onClearInitialOrderVendorId?: () => void;
  initialOrderId?: string;
  onClearInitialOrderId?: () => void;
  onNavigateToCommunicationsWithVendor?: (vendorId: string) => void;
}

export function useOrdersViewState({
  orders,
  suppliers,
  warehouses,
  trucks,
  currentEmployee,
  onSave,
  onDelete,
  initialOrderVendorId,
  onClearInitialOrderVendorId,
  initialOrderId,
  onClearInitialOrderId,
  onNavigateToCommunicationsWithVendor
}: UseOrdersViewStateParams) {
  const canAdd = currentEmployee?.role === 'admin' || (currentEmployee?.permissions?.['orders']?.includes('add') ?? false);
  const canModify = currentEmployee?.role === 'admin' || (currentEmployee?.permissions?.['orders']?.includes('modify') ?? false);
  const canDelete = currentEmployee?.role === 'admin' || (currentEmployee?.permissions?.['orders']?.includes('delete') ?? false);
  const canAddComm = currentEmployee?.role === 'admin' || (currentEmployee?.permissions?.['communications']?.includes('add') ?? false);

  const queryClient = useQueryClient();

  const {
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,
    triggerImmediateSearch
  } = useDebouncedSearch('', 350);

  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedDirection, setSelectedDirection] = useState<string>('');
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [selectedManager, setSelectedManager] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, selectedStatus, selectedCity, selectedDistrict, selectedDirection, selectedVehicle, selectedManager, startDate, endDate]);

  const isLogisticsManager = currentEmployee?.role === 'logistics_manager';
  const todayTbilisi = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tbilisi" }).format(new Date());

  const effectiveStartDate = isLogisticsManager ? todayTbilisi : startDate;
  const effectiveEndDate = isLogisticsManager ? todayTbilisi : endDate;

  const filters = {
    searchTerm: debouncedSearchTerm,
    status: selectedStatus,
    city: selectedCity,
    district: selectedDistrict,
    directionId: selectedDirection,
    vehicleId: selectedVehicle,
    managerId: selectedManager,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate
  };

  const { data: paginatedData, isLoading: isOrdersLoading } = usePaginatedOrders(page, filters, currentEmployee);

  const displayOrders = paginatedData?.orders || [];
  const totalOrdersCount = paginatedData?.totalCount || 0;

  // Active form management
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showSMSLogs, setShowSMSLogs] = useState(false);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [showAssignDriverModal, setShowAssignDriverModal] = useState(false);
  const [isFormSaving, setIsFormSaving] = useState(false);

  // Bulk-delete selection states
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Columns manager hook
  const {
    isColModalOpen,
    setIsColModalOpen,
    managedCols,
    handleSaveColumns,
    defaultOrdersColumns
  } = useOrderColumns();

  // Single delete modal states
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmDocNum, setDeleteConfirmDocNum] = useState<string | null>(null);
  const [deleteConfirmVendorName, setDeleteConfirmVendorName] = useState<string | null>(null);

  const formRef = useRef<{ save: (onSuccess?: (vendorId: string) => void) => void; fillDummy: () => void; saveAndReminder?: (onSuccess?: (vendorId: string) => void) => void }>(null);

  const loadSMSLogs = async () => {
    try {
      const logs = await getSMSLogs();
      setSmsLogs(logs || []);
    } catch {
      setSmsLogs([]);
    }
  };

  const scrollMainToTop = () => {
    setTimeout(() => {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.scrollTop = 0;
      }
    }, 0);
  };

  // Prefill order if navigated with vendor ID
  useEffect(() => {
    if (initialOrderVendorId) {
      const cleanVId = String(initialOrderVendorId).trim().toLowerCase();
      const sup = suppliers.find(s => s.id === initialOrderVendorId || (s.id && String(s.id).trim().toLowerCase() === cleanVId));
      const defaultOrder: Order = {
        id: '',
        order_date: new Date().toISOString().substring(0, 16),
        doc_number: `DOC-${Math.floor(100000 + Math.random() * 900000)}`,
        vendor_id: initialOrderVendorId,
        vendor_name: sup?.trade_name || sup?.company_name || '',
        warehouse_id: sup?.warehouse_id || warehouses[0]?.id || '',
        qty_requested: undefined as any,
        tanks_to_leave: undefined as any,
        tanks_to_bring: undefined as any,
        operator_id: currentEmployee?.id || '',
        created_by: currentEmployee?.id || '',
        driver_id: '',
        companion_id: '',
        truck_plate: '',
        status: 'registered'
      };
      setEditingOrder(defaultOrder);
      setIsNew(true);
      scrollMainToTop();
      onClearInitialOrderVendorId?.();
    }
  }, [initialOrderVendorId, suppliers, warehouses, currentEmployee, onClearInitialOrderVendorId]);

  // Open existing order form if navigated with order ID
  useEffect(() => {
    if (initialOrderId) {
      const cleanId = String(initialOrderId).trim().toLowerCase();
      const existing = orders.find(o => o.id === initialOrderId || (o.id && String(o.id).trim().toLowerCase() === cleanId));
      if (existing) {
        setEditingOrder(JSON.parse(JSON.stringify(existing)));
        setIsNew(false);
        setIsReadOnly(!canModify);
        scrollMainToTop();
        onClearInitialOrderId?.();
      }
    }
  }, [initialOrderId, orders, canModify, onClearInitialOrderId]);

  const startNew = () => {
    const defaultOrder: Order = {
      id: '',
      order_date: new Date().toISOString().substring(0, 16),
      doc_number: `DOC-${Math.floor(100000 + Math.random() * 900000)}`,
      vendor_id: '',
      warehouse_id: warehouses[0]?.id || '',
      qty_requested: undefined as any,
      tanks_to_leave: undefined as any,
      tanks_to_bring: undefined as any,
      operator_id: currentEmployee?.id || '',
      created_by: currentEmployee?.id || '',
      driver_id: '',
      companion_id: '',
      truck_plate: '',
      status: 'registered'
    };
    setEditingOrder(defaultOrder);
    setIsNew(true);
    setIsReadOnly(false);
    scrollMainToTop();
  };

  const startEdit = (ord: Order) => {
    setEditingOrder(JSON.parse(JSON.stringify(ord)));
    setIsNew(false);
    setIsReadOnly(!canModify);
    scrollMainToTop();
  };

  const handleBulkDeleteExecute = async () => {
    if (!canDelete || selectedOrders.length === 0) return;
    const docNums = selectedOrders.map(id => {
      const ord = (displayOrders || []).find(o => o.id === id) || orders.find(o => o.id === id);
      return ord?.doc_number || id;
    });

    try {
      await batchDeleteOrders(selectedOrders, docNums, currentEmployee?.name || 'User');
      queryClient.invalidateQueries({ queryKey: ['paginated_orders'] });
      queryClient.invalidateQueries({ queryKey: ['active_orders_count'] });
    } catch (err) {
      console.error('Failed to batch delete orders:', err);
    } finally {
      setSelectedOrders([]);
      setShowBulkDeleteConfirm(false);
    }
  };

  const handleSaveFromForm = async (finalOrder: Order) => {
    const saved = await onSave(finalOrder);
    setEditingOrder(null);
    return saved;
  };

  const handleSaveAndReminder = () => {
    const vendorIdFromEditing = editingOrder?.vendor_id;
    const navCallback = (vendorId?: string) => {
      const targetVendorId = vendorId || vendorIdFromEditing || '';
      setEditingOrder(null);
      if (targetVendorId) {
        onNavigateToCommunicationsWithVendor?.(targetVendorId);
      }
    };
    if (formRef.current?.saveAndReminder) {
      formRef.current.saveAndReminder(navCallback);
    } else if (formRef.current?.save) {
      formRef.current.save(navCallback);
    } else if (vendorIdFromEditing) {
      navCallback(vendorIdFromEditing);
    }
  };

  const askDelete = (id: string, docNum: string, vendorName?: string) => {
    if (!canDelete) return;
    let resolvedName = vendorName;
    if (!resolvedName) {
      const ord = (displayOrders || []).find(o => o.id === id) || orders.find(o => o.id === id);
      resolvedName = ord?.vendor_name || suppliers.find(s => s.id === ord?.vendor_id)?.trade_name;
    }
    setDeleteConfirmId(id);
    setDeleteConfirmDocNum(docNum);
    setDeleteConfirmVendorName(resolvedName || '');
  };

  const confirmDelete = () => {
    if (!canDelete) {
      console.warn('Unauthorized delete attempt blocked');
      setDeleteConfirmId(null);
      setDeleteConfirmDocNum(null);
      setDeleteConfirmVendorName(null);
      return;
    }
    if (deleteConfirmId) {
      onDelete(deleteConfirmId, deleteConfirmDocNum || '');
      if (editingOrder && editingOrder.id === deleteConfirmId) {
        setEditingOrder(null);
      }
    }
    setDeleteConfirmId(null);
    setDeleteConfirmDocNum(null);
    setDeleteConfirmVendorName(null);
  };

  const handleAssignDriverSave = async (driverId: string, companionId: string, truckPlate: string) => {
    if (!selectedOrders || selectedOrders.length === 0) return;

    const matchingTruck = trucks.find(t => t.plate_number === truckPlate || t.id === truckPlate);
    const finalPlate = matchingTruck?.plate_number || truckPlate;
    const finalVehicleId = matchingTruck?.id;

    try {
      await batchAssignCrewToOrders({
        orderIds: selectedOrders,
        driverId: driverId || undefined,
        companionId: companionId || undefined,
        truckPlate: finalPlate || undefined,
        vehicleId: finalVehicleId || undefined,
        loggerName: currentEmployee?.name || 'User'
      });
      queryClient.invalidateQueries({ queryKey: ['paginated_orders'] });
      queryClient.invalidateQueries({ queryKey: ['active_orders_count'] });
    } catch (err) {
      console.error('Failed to batch assign crew:', err);
    } finally {
      setSelectedOrders([]);
    }
  };

  const handleUnassignDriverSave = async () => {
    if (!selectedOrders || selectedOrders.length === 0) return;

    try {
      const selectedOrderObjs = selectedOrders.map(id =>
        (displayOrders || []).find(o => o.id === id) || orders.find(o => o.id === id)!
      ).filter(Boolean);

      await batchUnassignCrewFromOrders({
        orderIds: selectedOrders,
        orders: selectedOrderObjs,
        loggerName: currentEmployee?.name || 'User'
      });
      queryClient.invalidateQueries({ queryKey: ['paginated_orders'] });
      queryClient.invalidateQueries({ queryKey: ['active_orders_count'] });
    } catch (err) {
      console.error('Failed to unassign crew from orders:', err);
    } finally {
      setSelectedOrders([]);
      setShowAssignDriverModal(false);
    }
  };

  return {
    canAdd,
    canModify,
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
    isNew,
    isReadOnly,
    setIsReadOnly,
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
    deleteConfirmVendorName,
    setDeleteConfirmVendorName,
    formRef,
    startNew,
    startEdit,
    handleBulkDeleteExecute,
    handleSaveFromForm,
    handleSaveAndReminder,
    askDelete,
    confirmDelete,
    handleAssignDriverSave,
    handleUnassignDriverSave
  };
}
