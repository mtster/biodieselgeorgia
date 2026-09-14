import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, Building2, MapPin, X } from 'lucide-react';
import { t } from '../utils/lang';

export interface FilterOption {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  minWidth?: string;
}

export interface SearchSuggestionItem {
  id: string;
  title: string;
  subtitle?: string;
  address?: string;
}

interface CentralSearchBarProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  idPrefix?: string;
  suggestions?: SearchSuggestionItem[];
  onSelectSuggestion?: (item: SearchSuggestionItem) => void;
  isSearching?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  selectedAddress?: string;
}

export default function CentralSearchBar({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = "Search...",
  filters = [],
  idPrefix = "search",
  suggestions,
  onSelectSuggestion,
  isSearching = false,
  isLoadingMore = false,
  onLoadMore,
  selectedAddress,
}: CentralSearchBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      <div className="relative flex-1 w-full" ref={searchWrapperRef}>
        <div
          onClick={() => searchInputRef.current?.focus()}
          className="flex items-center w-full px-3 py-2 bg-slate-100/60 hover:bg-slate-100 border border-gray-200 focus-within:bg-white rounded-xl focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all cursor-text"
        >
          <span className="text-gray-400 pointer-events-none mr-2 shrink-0">
            {isSearching ? (
              <Loader2 size={15} className="animate-spin text-emerald-600" />
            ) : (
              <Search size={15} />
            )}
          </span>
          <input
            ref={searchInputRef}
            id={`${idPrefix}-input`}
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (suggestions && suggestions.length > 0) {
                setShowDropdown(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setShowDropdown(false);
                onSearchSubmit?.();
              }
            }}
            className="w-full bg-transparent border-none outline-none focus:outline-none p-0 text-xs text-gray-900 font-sans flex-1 min-w-[80px]"
          />

          {selectedAddress && (
            <span
              className="text-gray-400 font-normal text-xs select-none pointer-events-none truncate max-w-[220px] shrink-0 ml-1.5 transition-opacity duration-150"
              title={selectedAddress}
            >
              ({selectedAddress})
            </span>
          )}

          {searchTerm && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSearchChange('');
                setShowDropdown(false);
              }}
              className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer shrink-0"
              title={t("Clear")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Suggestions (like SupplierAutocomplete) */}
        {showDropdown && suggestions !== undefined && (searchTerm.trim().length > 0 || isSearching) && (
          <div
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
                onLoadMore?.();
              }
            }}
            className="absolute left-0 right-0 top-full mt-1.5 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-50 divide-y divide-gray-50 animate-in fade-in zoom-in-95 duration-100 text-left"
          >
            {suggestions.length > 0 ? (
              <>
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSuggestion?.(s);
                      setShowDropdown(false);
                    }}
                    className="px-3.5 py-2.5 hover:bg-emerald-50/50 cursor-pointer text-left transition duration-100 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-gray-800 group-hover:text-emerald-800 transition-colors">
                        {s.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                      {s.subtitle && s.subtitle !== s.title && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                          {s.subtitle}
                        </span>
                      )}
                      {s.address && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <MapPin className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                          {s.address}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {isLoadingMore && (
                  <div className="py-2.5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 font-medium bg-slate-50/70 border-t border-gray-100">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("Loading more...")}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                {isSearching ? (
                  <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t("Searching...")}
                  </span>
                ) : (
                  <span>
                    {t("No records found.")}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
