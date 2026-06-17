import React from 'react';
import { Search } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  minWidth?: string;
}

interface CentralSearchBarProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  idPrefix?: string;
}

export default function CentralSearchBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  idPrefix = "search"
}: CentralSearchBarProps) {
  return (
    <div className="flex flex-col md:flex-row items-center gap-4 w-full select-none font-sans">
      {/* 1. Filters displayed first (from left to right) */}
      {filters.map((filter, index) => (
        <div
          key={index}
          className="relative w-full md:w-auto"
          style={{ minWidth: filter.minWidth || '140px' }}
        >
          <span className="absolute -top-1.5 left-3 px-1 text-[9px] font-bold text-gray-400 bg-[#f8fafc] select-none z-10 text-left font-sans uppercase tracking-wider">
            {filter.label}
          </span>
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="block w-full py-2.5 pl-3 pr-8 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none cursor-pointer text-gray-900 appearance-none font-sans"
          >
            {filter.placeholder && <option value="">{filter.placeholder}</option>}
            {filter.options.map((opt, i) => (
              <option key={i} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400 text-[9px]">
            ▼
          </div>
        </div>
      ))}

      {/* 2. Search Input displayed next to them (flex-1) */}
      <div className="relative flex-1 w-full">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
          <Search size={15} />
        </span>
        <input
          id={`${idPrefix}-input`}
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 focus:bg-white rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all text-gray-900 font-sans"
        />
      </div>
    </div>
  );
}
