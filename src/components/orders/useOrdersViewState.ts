import { useState, useRef, useEffect } from 'react';
import { Order, Vendor, Warehouse, User, Truck } from '../../types';
import { getSMSLogs } from '../../services/orderService';
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
  onClearInitialOrderVendorId
}: UseOrdersViewStateParams) {
  const canAdd = currentEmployee?.role === 'admin' || (currentEmployee?.permissions?.['orders']?.includes('add') ?? false);
  const canModify = currentEmployee?.role === 'admin' || (currentEmployee?.permissions?.['orders']?.includes('modify') ?? false);
  const canDelete = currentEmployee?.role === 'admin' || (currentEmployee?.permissions?.['orders']?.includes('delete') ?? false);
  const canAddComm = currentEmployee?.role === 'admin' || (currentEmployee?.permissions?.['communications']?.includes('add') ?? false);

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

  const formRef = useRef<{ save: () => void; fillDummy: () => void; saveAndReminder?: (onSuccess?: (vendorId: string) => void) => void }>(null);

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
      const sup = suppliers.find(s => s.id === initialOrderVendorId);
      const defaultOrder: Order = {
        id: '',
        order_date: new Date().toISOString().substring(0, 16),
        doc_number: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
        vendor_id: initialOrderVendorId,
        vendor_name: sup?.trade_name || '',
        warehouse_id: warehouses[0]?.id || '',
        qty_requested: 0,
        tanks_to_leave: 0,
        tanks_to_bring: 0,
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

  const startNew = () => {
    const defaultOrder: Order = {
      id: '',
      order_date: new Date().toISOString().substring(0, 16),
      doc_number: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      vendor_id: '',
      warehouse_id: warehouses[0]?.id || '',
      qty_requested: 0,
      tanks_to_leave: 0,
      tanks_to_bring: 0,
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
  };

  const startEdit = (ord: Order) => {
    setEditingOrder(JSON.parse(JSON.stringify(ord)));
    setIsNew(false);
    scrollMainToTop();
  };

  const handleBulkDeleteExecute = () => {
    if (!canDelete) return;
    selectedOrders.forEach(id => {
      const ord = (displayOrders || []).find(o => o.id === id) || orders.find(o => o.id === id);
      onDelete(id, ord?.doc_number || '');
    });
    setSelectedOrders([]);
    setShowBulkDeleteConfirm(false);
  };

  const handleSaveFromForm = (finalOrder: Order) => {
    onSave(finalOrder);
    setEditingOrder(null);
  };

  const handleSaveAndReminder = () => {
    if (!formRef.current) return;
    if (formRef.current.saveAndReminder) {
      formRef.current.saveAndReminder();
    } else {
      formRef.current.save();
    }
  };

  const askDelete = (id: string, docNum: string) => {
    if (!canDelete) return;
    setDeleteConfirmId(id);
    setDeleteConfirmDocNum(docNum);
  };

  const confirmDelete = () => {
    if (!canDelete) {
      console.warn('Unauthorized delete attempt blocked');
      setDeleteConfirmId(null);
      setDeleteConfirmDocNum(null);
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
  };

  const handleAssignDriverSave = async (driverId: string, companionId: string, truckPlate: string) => {
    const matchingTruck = trucks.find(t => t.plate_number === truckPlate || t.id === truckPlate);
    const finalPlate = matchingTruck?.plate_number || truckPlate;
    const finalVehicleId = matchingTruck?.id;

    for (const id of selectedOrders) {
      const ord = (displayOrders || []).find(o => o.id === id) || orders.find(o => o.id === id);
      if (ord) {
        await onSave({
          ...ord,
          driver_id: driverId || undefined,
          companion_id: companionId || undefined,
          truck_plate: finalPlate || undefined,
          vehicle_id: finalVehicleId || ord.vehicle_id,
          status: 'driver_assigned'
        });
      }
    }
    setSelectedOrders([]);
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
  };
}
