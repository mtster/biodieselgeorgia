import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Vendor, Order } from '../../types';
import { t } from '../../utils/lang';
import { useDebounce } from '../../hooks/useDebounce';
import { getVendorsPaginated } from '../../services/vendorService';
import { Loader2, Search, Building2, MapPin } from 'lucide-react';

interface Props {
  vendorSearch: string;
  setVendorSearch: React.Dispatch<React.SetStateAction<string>>;
  showVendorSuggestions: boolean;
  setShowVendorSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  fieldErrors: Record<string, string>;
  setFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  suppliers: Vendor[];
  selectedVendorId?: string;
}

export default function SupplierAutocomplete({
  vendorSearch,
  setVendorSearch,
  showVendorSuggestions,
  setShowVendorSuggestions,
  setEditingOrder,
  fieldErrors,
  setFieldErrors,
  suppliers,
  selectedVendorId
}: Props) {
  const debouncedSearch = useDebounce(vendorSearch, 250);
  const [remoteSuppliers, setRemoteSuppliers] = useState<Vendor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click without an invisible overlay blocking mouse selection
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowVendorSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setShowVendorSuggestions]);

  // Identify currently matched / selected vendor to display the pale address badge
  const matchedVendor = useMemo(() => {
    const term = vendorSearch.trim();
    if (!term) return null;
    if (selectedVendorId) {
      const v = suppliers.find((s) => s.id === selectedVendorId) || remoteSuppliers.find((s) => s.id === selectedVendorId);
      if (v && (v.trade_name?.trim() === term || v.company_name?.trim() === term)) {
        return v;
      }
    }
    // Check if vendorSearch exactly matches a supplier name
    return suppliers.find((s) => s.trade_name?.trim() === term || s.company_name?.trim() === term) || null;
  }, [suppliers, remoteSuppliers, vendorSearch, selectedVendorId]);

  const selectedAddress = matchedVendor?.address || '';

  // Background search for suppliers not in local cache
  useEffect(() => {
    let isMounted = true;
    const term = debouncedSearch.trim();

    if (!term || !showVendorSuggestions) {
      setRemoteSuppliers([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    getVendorsPaginated(30, 0, { searchTerm: term })
      .then((res) => {
        if (isMounted) {
          setRemoteSuppliers(res.vendors || []);
          setIsSearching(false);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch autocomplete suppliers', err);
        if (isMounted) {
          setIsSearching(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, showVendorSuggestions]);

  // Combine and deduplicate local suppliers and remote fetched suppliers with instant reactivity on vendorSearch
  const filteredSuggestions = useMemo(() => {
    const term = vendorSearch.trim().toLowerCase();
    const map = new Map<string, Vendor>();

    // Instant local matching on every keystroke (zero lag)
    suppliers.forEach((s) => {
      if (!term) {
        map.set(s.id, s);
      } else {
        const trade = (s.trade_name || '').toLowerCase();
        const comp = (s.company_name || '').toLowerCase();
        const addr = (s.address || '').toLowerCase();
        if (trade.includes(term) || comp.includes(term) || addr.includes(term)) {
          map.set(s.id, s);
        }
      }
    });

    // Add remote fetched suppliers
    remoteSuppliers.forEach((s) => {
      map.set(s.id, s);
    });

    return Array.from(map.values()).slice(0, 30);
  }, [suppliers, remoteSuppliers, vendorSearch]);

  const handleSelectVendor = (s: Vendor) => {
    const displayName = s.trade_name || s.company_name || '';

    setEditingOrder((prev) =>
      prev
        ? {
            ...prev,
            vendor_id: s.id,
            vendor_name: displayName,
            warehouse_id: s.warehouse_id || prev.warehouse_id,
            city: s.city || prev.city,
            district: s.district || prev.district,
            address: s.address || prev.address
          }
        : null
    );

    setVendorSearch(displayName);
    setShowVendorSuggestions(false);
    if (fieldErrors.vendor_id) {
      setFieldErrors((prev) => ({ ...prev, vendor_id: '' }));
    }
  };

  return (
    <div className="relative" ref={wrapperRef} id="vendor-autocomplete-container">
      <span
        className={`absolute -top-1.5 left-3 px-1 text-[10px] font-bold bg-white select-none z-10 font-sans ${
          fieldErrors.vendor_id ? 'text-red-500' : 'text-gray-400'
        }`}
      >
        {t("Supplier")} *
      </span>
      <div
        onClick={() => inputRef.current?.focus()}
        className={`relative flex items-center w-full px-3.5 py-4 md:py-3 text-xs border rounded-xl bg-white transition-all cursor-text ${
          fieldErrors.vendor_id
            ? 'border-red-500 bg-red-50/10 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 text-red-900'
            : 'border-gray-200 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 text-gray-900'
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder=""
          value={vendorSearch}
          onChange={(e) => {
            const val = e.target.value;
            setVendorSearch(val);
            setShowVendorSuggestions(true);
            if (val === '') {
              setEditingOrder((prev) => (prev ? { ...prev, vendor_id: '', vendor_name: '', address: '' } : null));
            }
            if (fieldErrors.vendor_id) {
              setFieldErrors((prev) => ({ ...prev, vendor_id: '' }));
            }
          }}
          onFocus={() => setShowVendorSuggestions(true)}
          className="w-full bg-transparent border-none outline-none focus:outline-none p-0 text-xs font-sans text-gray-900 flex-1 min-w-[80px]"
        />

        {selectedAddress && (
          <span
            className="text-gray-400 font-normal text-xs select-none pointer-events-none truncate max-w-[220px] shrink-0 ml-1.5 transition-opacity duration-150"
            title={selectedAddress}
          >
            ({selectedAddress})
          </span>
        )}

        <div className="flex items-center pl-2 pointer-events-none text-gray-400 shrink-0">
          {isSearching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
          ) : (
            <Search className="w-3.5 h-3.5 text-gray-300" />
          )}
        </div>
      </div>

      {fieldErrors.vendor_id && (
        <p className="text-[10px] text-red-500 font-bold mt-1 text-left select-none animate-in fade-in duration-100">
          {fieldErrors.vendor_id}
        </p>
      )}

      {showVendorSuggestions && (
        <div className="absolute left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-30 divide-y divide-gray-50 animate-in fade-in zoom-in-95 duration-100">
          {filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectVendor(s)}
                className="px-3.5 py-2.5 hover:bg-emerald-50/40 cursor-pointer text-left transition duration-100 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-gray-800 group-hover:text-emerald-750 transition-colors">
                    {s.trade_name || s.company_name}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                  {s.company_name && s.company_name !== s.trade_name && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                      {s.company_name}
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
            ))
          ) : (
            <div className="px-4 py-4 text-xs text-gray-400 text-center flex flex-col items-center justify-center gap-1">
              {isSearching ? (
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t("Searching...")}
                </span>
              ) : (
                <span>
                  {t("No suppliers found matching")} "{vendorSearch}"
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
