import React from 'react';
import { Truck, Direction, Vendor, User } from '../../types';
import CentralSearchBar from '../CentralSearchBar';
import PeriodFilter from '../PeriodFilter';
import { t } from '../../utils/lang';

interface OrdersViewFiltersProps {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  triggerImmediateSearch: () => void;
  isLogisticsManager: boolean;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  selectedStatus: string;
  setSelectedStatus: (s: string) => void;
  selectedCity: string;
  setSelectedCity: (c: string) => void;
  selectedDistrict: string;
  setSelectedDistrict: (d: string) => void;
  selectedDirection: string;
  setSelectedDirection: (d: string) => void;
  selectedVehicle: string;
  setSelectedVehicle: (v: string) => void;
  selectedManager: string;
  setSelectedManager: (m: string) => void;
  suppliers: Vendor[];
  directions: Direction[];
  trucks: Truck[];
  employees: User[];
  setPage: (p: number) => void;
}

export const OrdersViewFilters: React.FC<OrdersViewFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  triggerImmediateSearch,
  isLogisticsManager,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
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
  suppliers,
  directions,
  trucks,
  employees,
  setPage
}) => {
  return (
    <div className="space-y-4 w-full">
      {/* Search Bar - Full Width on Top */}
      <div className="w-full">
        <CentralSearchBar 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchSubmit={triggerImmediateSearch}
          idPrefix="orders-search"
          searchPlaceholder={t("Search dispatches by supplier trade name, legal entity, or document coordinate...")}
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-4 w-full select-none font-sans">
        {/* Period Filter */}
        {!isLogisticsManager && (
          <div className="shrink-0">
            <PeriodFilter 
              startDate={startDate} 
              setStartDate={setStartDate} 
              endDate={endDate} 
              setEndDate={setEndDate} 
            />
          </div>
        )}

        {/* Status Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("Status")}
          </span>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Statuses")}</option>
            <option value="registered">{t("Registered")}</option>
            <option value="driver_assigned">{t("Driver Assigned")}</option>
            <option value="completed">{t("Completed")}</option>
            <option value="uncompleted">{t("uncompleted")}</option>
            <option value="cancelled">{t("cancelled")}</option>
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        {/* City Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            ქალაქი
          </span>
          <select
            value={selectedCity}
            onChange={(e) => {
              setSelectedCity(e.target.value);
              setSelectedDistrict('');
              setPage(1);
            }}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Cities")}</option>
            {Array.from(new Set(suppliers.map(s => s.city).filter(Boolean))).sort().map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        {/* District Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            რაიონი
          </span>
          <select
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              setPage(1);
            }}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Districts")}</option>
            {Array.from(
              new Set(
                suppliers
                  .filter(s => !selectedCity || s.city === selectedCity)
                  .map(s => s.district)
                  .filter(Boolean)
              )
            ).sort().map(dist => (
              <option key={dist} value={dist}>{dist}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        {/* Direction Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            მიმართულება
          </span>
          <select
            value={selectedDirection}
            onChange={(e) => {
              setSelectedDirection(e.target.value);
              setPage(1);
            }}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Directions")}</option>
            {directions.map(dir => (
              <option key={dir.id} value={dir.id}>{dir.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        {/* Vehicle Filter */}
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            მანქანა
          </span>
          <select
            value={selectedVehicle}
            onChange={(e) => {
              setSelectedVehicle(e.target.value);
              setPage(1);
            }}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Vehicles")}</option>
            {trucks.map(truck => (
              <option key={truck.id || truck.plate_number} value={truck.id || truck.plate_number}>
                {truck.plate_number} ({truck.model})
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        {/* Manager Filter */}
        <div className="relative w-full md:w-auto min-w-[150px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("Manager") || "მენეჯერი"}
          </span>
          <select
            value={selectedManager}
            onChange={(e) => {
              setSelectedManager(e.target.value);
              setPage(1);
            }}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Managers") || "ყველა მენეჯერი"}</option>
            {employees
              .filter(e => e.role === 'admin' || e.role === 'purchasing_head' || e.role === 'manager' || e.role === 'purchasing_manager' || e.role === 'operator')
              .map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>
      </div>
    </div>
  );
};
