/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppData } from './hooks/useAppData';
import { t } from './utils/lang';
import ErrorModal from './components/ErrorModal';

// Modular view components
import LoginView from './components/menu/LoginView';
import DashboardView from './components/menu/DashboardView';
import AnalyticsView from './components/menu/AnalyticsView';
import VendorsView from './components/menu/VendorsView';
import CommunicationsView from './components/menu/CommunicationsView';
import OrdersView from './components/menu/OrdersView';
import UsersView from './components/menu/UsersView';
import ReportsView from './components/menu/ReportsView';
import ContactsView from './components/menu/ContactsView';
import CitiesSettingView from './components/settings/CitiesSettingView';
import DirectionsSettingView from './components/settings/DirectionsSettingView';
import VehiclesSettingView from './components/settings/VehiclesSettingView';
import WarehousesSettingView from './components/settings/WarehousesSettingView';
import HistoryView from './components/menu/HistoryView';
import MobileLogisticsView from './components/menu/MobileLogisticsView';
import SupplierView from './components/menu/SupplierView';
import Sidebar from './components/menu/Sidebar';

import { Leaf, Menu } from 'lucide-react';

export default function App() {
  const {
    currentUser,
    setCurrentUser,
    deleteAlertMessage,
    setDeleteAlertMessage,
    users,
    vendors,
    orders,
    communications,
    trucks,
    changeHistory,
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
    handleLogOut,
    errorModal,
    setErrorModal
  } = useAppData();

  const [selectedContactVendorId, setSelectedContactVendorId] = React.useState<string | undefined>(undefined);
  const mainRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-3.5">
        <div className="w-10 h-10 border-4 border-emerald-800 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold font-mono text-gray-400 tracking-widest uppercase">
          {t("Biodiesel Georgia")} - {t("Loading...")}
        </p>
      </div>
    );
  }

  // Auth requirement
  if (!currentUser) {
    return (
      <LoginView 
        users={users} 
        onLoginSuccess={(usr) => setCurrentUser(usr)} 
      />
    );
  }

  // If role is 'driver', route them to the mobile logistics interface
  if (currentUser.role === 'driver') {
    return (
      <MobileLogisticsView 
        currentUser={currentUser}
        orders={orders}
        suppliers={vendors}
        warehouses={warehouses}
        employees={users}
        trucks={trucks}
        onSaveOrder={handleOrderSave}
        onLogOut={handleLogOut}
      />
    );
  }

  // If role is 'vendor', route them to the supplier dashboard interface
  if (currentUser.role === 'vendor') {
    return (
      <SupplierView 
        currentUser={currentUser}
        orders={orders}
        warehouses={warehouses}
        onSaveOrder={handleOrderSave}
        onLogOut={handleLogOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-750 flex flex-col md:flex-row font-sans">
      
      <div className={`${mobileMenuOpen ? 'block' : 'hidden md:block'} z-[60] fixed inset-0 md:relative md:inset-auto`}>
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          onLogOut={handleLogOut}
        />
      </div>

      {/* Main Viewport Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Mobile Navbar Top */}
        <header className="md:hidden bg-white border-b border-gray-100 flex items-center justify-between p-4 flex-shrink-0 shadow-xs relative z-40">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-800 text-white p-1 rounded-lg">
              <Leaf size={16} />
            </div>
            <span className="font-black text-sm text-gray-800 font-sans">{t("Biodiesel Georgia")}</span>
          </div>

          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 bg-gray-50 border rounded-lg text-gray-700 cursor-pointer"
          >
            <Menu size={18} />
          </button>
        </header>

        {/* Content viewport */}
        <main ref={mainRef} className="flex-1 overflow-y-auto px-4 md:px-6 pb-16 pt-0 md:pt-0">
          <div className="w-full">
            {activeTab === 'dashboard' && (
              <DashboardView 
                suppliers={vendors}
                orders={orders}
                employees={users}
                trucks={trucks}
                communications={communications}
                onNavigate={(tab) => {
                  if (tab === 'suppliers') {
                    setActiveTab('vendors');
                  } else if (tab === 'employees') {
                    setActiveTab('users');
                  } else {
                    setActiveTab(tab);
                  }
                }}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView 
                suppliers={vendors}
                orders={orders}
                onNavigate={(tab) => {
                  if (tab === 'suppliers') {
                    setActiveTab('vendors');
                  } else {
                    setActiveTab(tab);
                  }
                }}
              />
            )}

            {activeTab === 'vendors' && (
              <VendorsView 
                vendors={vendors}
                warehouses={warehouses}
                users={users}
                cities={cities}
                districts={districts}
                directions={directions}
                currentUser={currentUser}
                onSave={handleVendorSave}
                onDelete={handleVendorDelete}
                onAddCity={handleAddCityDirect}
                onAddDistrict={handleAddDistrictDirect}
                onAddWarehouse={handleAddWarehouseDirect}
                communications={communications}
                onSaveCommunication={handleCommunicationSave}
                onDeleteCommunication={handleCommunicationDelete}
                initialVendorId={selectedContactVendorId}
                onClearInitialVendorId={() => setSelectedContactVendorId(undefined)}
              />
            )}

            {activeTab === 'contacts' && (
              <ContactsView
                vendors={vendors}
                onSaveVendor={handleVendorSave}
                onContactClick={(vendorId) => {
                  setSelectedContactVendorId(vendorId);
                  setActiveTab('vendors');
                }}
                warehouses={warehouses}
                users={users}
                cities={cities}
                districts={districts}
                directions={directions}
                currentUser={currentUser}
                communications={communications}
                onSaveCommunication={handleCommunicationSave}
                onDeleteCommunication={handleCommunicationDelete}
              />
            )}

            {activeTab === 'communications' && (
              <CommunicationsView 
                communications={communications}
                suppliers={vendors}
                employees={users}
                currentEmployee={currentUser}
                onSave={handleCommunicationSave}
                onDelete={handleCommunicationDelete}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersView 
                orders={orders}
                suppliers={vendors}
                warehouses={warehouses}
                employees={users}
                trucks={trucks}
                directions={directions}
                currentEmployee={currentUser}
                onSave={handleOrderSave}
                onDelete={handleOrderDelete}
              />
            )}

            {activeTab === 'users' && (
              <UsersView 
                users={users}
                currentUser={currentUser}
                warehouses={warehouses}
                suppliers={vendors}
                onSave={handleUserSave}
                onDelete={handleUserDelete}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView 
                suppliers={vendors}
                orders={orders}
                users={users}
                cities={cities}
                districts={districts}
              />
            )}

            {(activeTab === 'lookups' || activeTab === 'cities') && (
              <CitiesSettingView currentUser={currentUser} 
                cities={cities}
                districts={districts}
                onSaveCity={handleSaveCity}
                onDeleteCity={handleDeleteCity}
                onSaveDistrict={handleSaveDistrict}
                onDeleteDistrict={handleDeleteDistrict}
                onBack={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'directions' && (
              <DirectionsSettingView currentUser={currentUser} 
                directions={directions}
                onSaveDirection={handleSaveDirection}
                onDeleteDirection={handleDeleteDirection}
                onBack={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'vehicles' && (
              <VehiclesSettingView currentUser={currentUser} 
                trucks={trucks}
                employees={users}
                cities={cities}
                warehouses={warehouses}
                directions={directions}
                onSaveTruck={handleSaveTruck}
                onDeleteTruck={handleDeleteTruck}
                onBack={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'warehouses' && (
              <WarehousesSettingView currentUser={currentUser} 
                warehouses={warehouses}
                onSaveWarehouse={handleSaveWarehouse}
                onDeleteWarehouse={handleDeleteWarehouse}
                onBack={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'history' && (
              <HistoryView 
                history={changeHistory}
                loadMore={handleLoadMoreHistory}
                isLoadingMore={isLoadingMore}
              />
            )}
          </div>
        </main>

      </div>

      {deleteAlertMessage && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-gray-200 text-center animate-scale-up">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 text-red-600 animate-bounce">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-gray-900">{t("Deletion Blocked")}</h3>
              <p className="mt-2 text-xs text-gray-600 leading-relaxed font-medium">
                {t(deleteAlertMessage)}
              </p>
            </div>
            <button
              onClick={() => setDeleteAlertMessage(null)}
              className="w-full inline-flex justify-center rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition shadow-sm focus:outline-none cursor-pointer"
            >
              {t("Understood")}
            </button>
          </div>
        </div>
      )}

      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal(prev => ({ ...prev, isOpen: false }))}
        title={errorModal.title}
        errorMsg={errorModal.errorMsg}
      />

    </div>
  );
}
