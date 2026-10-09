import { useState } from 'react';
import { useAuth } from './useAuth';
import { useAppDataFetch } from './appData/useAppDataFetch';
import { useAppDataMutations } from './appData/useAppDataMutations';

export function useAppData() {
  const { currentUser, setCurrentUser, isLoadingAuth, handleLogOut } = useAuth();

  const [deleteAlertMessage, setDeleteAlertMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showStructureDesc, setShowStructureDesc] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; title: string; errorMsg: string }>({
    isOpen: false,
    title: '',
    errorMsg: ''
  });

  const {
    users,
    setUsers,
    vendors,
    setVendors,
    orders,
    setOrders,
    activeOrdersCount,
    communications,
    setCommunications,
    trucks,
    setTrucks,
    changeHistory,
    historyOffset,
    isLoadingMore,
    warehouses,
    cities,
    districts,
    directions,
    isLoading,
    refreshAllData,
    refreshTable,
    handleLoadMoreHistory
  } = useAppDataFetch(currentUser, isLoadingAuth);

  const {
    handleUserSave,
    handleUserDelete,
    handleVendorSave,
    handleVendorDelete,
    handleOrderSave,
    handleOrderDelete,
    handleCommunicationSave,
    handleCommunicationDelete,
    handleSaveCity,
    handleDeleteCity,
    handleSaveDistrict,
    handleDeleteDistrict,
    handleSaveDirection,
    handleDeleteDirection,
    handleSaveTruck,
    handleDeleteTruck,
    handleAddCityDirect,
    handleAddDistrictDirect,
    handleAddWarehouseDirect,
    handleSaveWarehouse,
    handleDeleteWarehouse,
    handleRevertChange
  } = useAppDataMutations({
    currentUser,
    setCurrentUser,
    users,
    setUsers,
    vendors,
    setVendors,
    orders,
    setOrders,
    communications,
    setCommunications,
    trucks,
    setTrucks,
    refreshTable,
    refreshAllData,
    setErrorModal
  });

  return {
    currentUser,
    setCurrentUser,
    deleteAlertMessage,
    setDeleteAlertMessage,
    users,
    vendors,
    orders,
    activeOrdersCount,
    communications,
    trucks,
    changeHistory,
    historyOffset,
    isLoadingMore,
    warehouses,
    cities,
    districts,
    directions,
    isLoading,
    activeTab,
    setActiveTab,
    mobileMenuOpen,
    setMobileMenuOpen,
    showStructureDesc,
    setShowStructureDesc,
    refreshAllData,
    handleLoadMoreHistory,
    handleUserSave,
    handleUserDelete,
    handleVendorSave,
    handleVendorDelete,
    handleOrderSave,
    handleOrderDelete,
    handleCommunicationSave,
    handleCommunicationDelete,
    handleSaveCity,
    handleDeleteCity,
    handleSaveDistrict,
    handleDeleteDistrict,
    handleSaveDirection,
    handleDeleteDirection,
    handleSaveTruck,
    handleDeleteTruck,
    handleAddCityDirect,
    handleAddDistrictDirect,
    handleAddWarehouseDirect,
    handleSaveWarehouse,
    handleDeleteWarehouse,
    handleRevertChange,
    handleLogOut,
    errorModal,
    setErrorModal
  };
}
