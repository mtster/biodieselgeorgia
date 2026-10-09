import React from 'react';
import { City, District, Direction, User } from '../../types';
import { Search } from 'lucide-react';
import { t } from '../../utils/lang';

interface VendorsViewFiltersProps {
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  triggerImmediateSearch: () => void;
  selectedCity: string;
  setSelectedCity: (c: string) => void;
  selectedDistrict: string;
  setSelectedDistrict: (d: string) => void;
  selectedSalesManager: string;
  setSelectedSalesManager: (m: string) => void;
  selectedOperationManager: string;
  setSelectedOperationManager: (o: string) => void;
  selectedDirection: string;
  setSelectedDirection: (d: string) => void;
  cities: City[];
  districts: District[];
  users: User[];
  directions: Direction[];
  setPage: (p: number) => void;
}

export const VendorsViewFilters: React.FC<VendorsViewFiltersProps> = ({
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
  cities,
  districts,
  users,
  directions,
  setPage
}) => {
  return (
    <div className="space-y-4">
      {/* Search Input element on top */}
      <div className="relative w-full">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
          <Search size={15} />
        </span>
        <input
          id="vendors-search-input-standalone"
          type="text"
          placeholder="ძებნა მომწოდებლის დასახელებით, იურიდიული პირით, ს/კ, მისამართით, შიდა კოდით ან კონტაქტის ნომრით..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setPage(1);
              triggerImmediateSearch();
            }
          }}
          className="w-full pl-9 pr-4 py-2.5 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-gray-900 font-sans"
        />
      </div>

      {/* Filters displayed below search input */}
      <div className="flex flex-wrap items-center gap-4 w-full select-none font-sans">
        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("City")}
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
            {cities.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("District")}
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
            {districts
              .filter(d => {
                const cObj = cities.find(x => x.name === selectedCity);
                return !cObj || d.city_id === cObj.id;
              })
              .map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("Sales Manager")}
          </span>
          <select
            value={selectedSalesManager}
            onChange={(e) => {
              setSelectedSalesManager(e.target.value);
              setPage(1);
            }}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Sales Managers")}</option>
            {users
              .filter(u => u.role === 'manager' || u.role === 'purchasing_head' || u.role === 'admin' || u.role === 'purchasing_manager')
              .map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("Operation Manager")}
          </span>
          <select
            value={selectedOperationManager}
            onChange={(e) => {
              setSelectedOperationManager(e.target.value);
              setPage(1);
            }}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            <option value="">{t("All Operation Managers")}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>

        <div className="relative w-full md:w-auto min-w-[140px]">
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {t("Directions")}
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
            {directions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
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
