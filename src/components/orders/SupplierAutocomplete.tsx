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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [remoteOffset, setRemoteOffset] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(5);
  const [selectedVendorObj, setSelectedVendorObj] = useState<Vendor | null>(null);
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

  // Sync selected vendor object and search text when selectedVendorId changes
  useEffect(() => {
    if (selectedVendorId) {
      const cleanVId = String(selectedVendorId).trim().toLowerCase();
      const v = suppliers.find((s) => s.id === selectedVendorId || (s.id && String(s.id).trim().toLowerCase() === cleanVId));
      if (v) {
        setSelectedVendorObj(v);
        if (!vendorSearch) {
          setVendorSearch(v.trade_name || v.company_name || '');
        }
      }
    } else {
      setSelectedVendorObj(null);
    }
  }, [selectedVendorId, suppliers]);

  // Identify currently matched / selected vendor to display the address badge
  const matchedVendor = useMemo(() => {
    if (selectedVendorId) {
      if (selectedVendorObj && (selectedVendorObj.id === selectedVendorId || String(selectedVendorObj.id).trim().toLowerCase() === String(selectedVendorId).trim().toLowerCase())) {
        return selectedVendorObj;
      }
      const cleanVId = String(selectedVendorId).trim().toLowerCase();
      const v = suppliers.find((s) => s.id === selectedVendorId || (s.id && String(s.id).trim().toLowerCase() === cleanVId));
      if (v) return v;
    }
    const term = vendorSearch.trim().toLowerCase();
    if (!term) return null;
    return suppliers.find((s) => (s.trade_name?.trim().toLowerCase() === term || s.company_name?.trim().toLowerCase() === term)) || null;
  }, [selectedVendorId, selectedVendorObj, suppliers, vendorSearch]);

  const selectedAddress = matchedVendor?.address || selectedVendorObj?.address || '';

  // Background search for suppliers not in local cache (fetching 5 at a time)
  useEffect(() => {
    let isMounted = true;
    const term = debouncedSearch.trim();

    if (!term || !showVendorSuggestions) {
      setRemoteSuppliers((prev) => (prev.length > 0 ? [] : prev));
      setIsSearching(false);
      setIsLoadingMore(false);
      setHasMore(false);
      setRemoteOffset(0);
      setDisplayLimit(5);
      return;
    }

    // If currently selected vendor matches this exact name, skip redundant remote network call
    const activeVendor = selectedVendorObj || suppliers.find((s) => s.id === selectedVendorId);
    if (activeVendor) {
      const matchTrade = (activeVendor.trade_name || '').trim().toLowerCase();
      const matchComp = (activeVendor.company_name || '').trim().toLowerCase();
      const termLower = term.toLowerCase();
      if (termLower === matchTrade || termLower === matchComp) {
        setIsSearching(false);
        setIsLoadingMore(false);
        setHasMore(false);
        return;
      }
    }

    setIsSearching(true);
    setRemoteOffset(0);
    setDisplayLimit(5);

    getVendorsPaginated(5, 0, { searchTerm: term }, { includeContacts: false })
      .then((res) => {
        if (isMounted) {
          const fetched = res.vendors || [];
          setRemoteSuppliers(fetched);
          setRemoteOffset(fetched.length);
          setHasMore(fetched.length === 5 && (res.totalCount ? fetched.length < res.totalCount : true));
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
  }, [debouncedSearch, showVendorSuggestions, selectedVendorId, selectedVendorObj, suppliers]);

  // Load next 5 suppliers on scrolling to the bottom of the dropdown
  const handleLoadMore = () => {
    if (isLoadingMore || isSearching) return;

    if (displayLimit < allCombinedSuggestions.length) {
      setDisplayLimit((prev) => prev + 5);
    }

    if (hasMore) {
      const term = debouncedSearch.trim();
      if (!term) return;

      setIsLoadingMore(true);
      getVendorsPaginated(5, remoteOffset, { searchTerm: term }, { includeContacts: false })
        .then((res) => {
          const fetched = res.vendors || [];
          setRemoteSuppliers((prev) => {
            const ids = new Set(prev.map((v) => v.id));
            const newVendors = fetched.filter((v) => !ids.has(v.id));
            return [...prev, ...newVendors];
          });
          setRemoteOffset((prev) => prev + fetched.length);
          setDisplayLimit((prev) => prev + 5);
          setHasMore(fetched.length === 5 && (res.totalCount ? remoteOffset + fetched.length < res.totalCount : true));
          setIsLoadingMore(false);
        })
        .catch((err) => {
          console.warn('Failed to load more autocomplete suppliers', err);
          setIsLoadingMore(false);
        });
    }
  };

  // Combine and deduplicate local suppliers and remote fetched suppliers with instant reactivity on vendorSearch
  const allCombinedSuggestions = useMemo(() => {
    const term = vendorSearch.trim().toLowerCase();
    const map = new Map<string, Vendor>();

    // If a vendor is currently selected, ensure it is in the list if it matches
    if (selectedVendorObj) {
      const trade = (selectedVendorObj.trade_name || '').toLowerCase();
      const comp = (selectedVendorObj.company_name || '').toLowerCase();
      const addr = (selectedVendorObj.address || '').toLowerCase();
      if (!term || trade.includes(term) || comp.includes(term) || addr.includes(term)) {
        map.set(selectedVendorObj.id, selectedVendorObj);
      }
    }

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

    return Array.from(map.values());
  }, [suppliers, remoteSuppliers, vendorSearch, selectedVendorObj]);

  const filteredSuggestions = useMemo(() => {
    return allCombinedSuggestions.slice(0, displayLimit);
  }, [allCombinedSuggestions, displayLimit]);

  const handleSelectVendor = (s: Vendor) => {
    const displayName = s.trade_name || s.company_name || '';
    setSelectedVendorObj(s);

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
              setSelectedVendorObj(null);
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
        <div
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
              handleLoadMore();
            }
          }}
          className="absolute left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl z-30 divide-y divide-gray-50 animate-in fade-in zoom-in-95 duration-100"
        >
          {filteredSuggestions.length > 0 ? (
            <>
              {filteredSuggestions.map((s) => (
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
              ))}
              {isLoadingMore && (
                <div className="py-2.5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 font-medium bg-slate-50/70 border-t border-gray-100">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t("Loading more...")}</span>
                </div>
              )}
            </>
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
