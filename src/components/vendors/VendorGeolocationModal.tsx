import React, { useState, useEffect, useRef } from 'react';
import { MapPin, CheckCircle2, AlertCircle, Loader2, X, Play, Square } from 'lucide-react';
import { Vendor } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface VendorGeolocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vendors: Vendor[];
}

export const VendorGeolocationModal: React.FC<VendorGeolocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vendors
}) => {
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error' | 'stopped'>('idle');
  const [totalVendors, setTotalVendors] = useState<number>(0);
  const [totalNeeding, setTotalNeeding] = useState<number>(0);
  const [alreadyGeocoded, setAlreadyGeocoded] = useState<number>(0);
  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(true);

  const [processedCount, setProcessedCount] = useState<number>(0);
  const [updatedCount, setUpdatedCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isAbortedRef = useRef<boolean>(false);

  // Fetch real counts directly from database to avoid client-side 1000 row limits
  useEffect(() => {
    if (!isOpen) return;

    isAbortedRef.current = false;
    setStatus('idle');
    setProcessedCount(0);
    setUpdatedCount(0);
    setFailedCount(0);
    setCurrentAddress('');
    setErrorMessage('');

    const fetchAccurateCounts = async () => {
      setIsLoadingCounts(true);
      try {
        if (isSupabaseConfigured && supabase) {
          const [totRes, missingRes] = await Promise.all([
            supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('is_deleted', false),
            supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('is_deleted', false).is('latitude', null)
          ]);

          const total = totRes.count ?? vendors.filter(v => !v.is_deleted).length;
          const missing = missingRes.count ?? vendors.filter(v => (!v.latitude || !v.longitude) && !v.is_deleted).length;

          setTotalVendors(total);
          setTotalNeeding(missing);
          setAlreadyGeocoded(Math.max(total - missing, 0));
        } else {
          const active = vendors.filter(v => !v.is_deleted);
          const missing = active.filter(v => !v.latitude || !v.longitude);
          setTotalVendors(active.length);
          setTotalNeeding(missing.length);
          setAlreadyGeocoded(active.length - missing.length);
        }
      } catch (err) {
        console.warn('Could not query database vendor counts, falling back to local state:', err);
        const active = vendors.filter(v => !v.is_deleted);
        const missing = active.filter(v => !v.latitude || !v.longitude);
        setTotalVendors(active.length);
        setTotalNeeding(missing.length);
        setAlreadyGeocoded(active.length - missing.length);
      } finally {
        setIsLoadingCounts(false);
      }
    };

    fetchAccurateCounts();

    return () => {
      isAbortedRef.current = true;
    };
  }, [isOpen, vendors]);

  if (!isOpen) return null;

  const startGeocoding = async () => {
    isAbortedRef.current = false;
    setStatus('running');
    setProcessedCount(0);
    setUpdatedCount(0);
    setFailedCount(0);
    setErrorMessage('');

    let totalUpdated = 0;
    let totalFailed = 0;
    let totalProcessed = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        if (isAbortedRef.current) {
          setStatus('stopped');
          break;
        }

        let batchData: any = null;

        // 1. First attempt: Invoke Supabase Edge Function directly
        if (isSupabaseConfigured && supabase) {
          try {
            const { data, error } = await supabase.functions.invoke('geocode-vendors', {
              body: { batch_size: 25 }
            });
            if (error) {
              throw new Error(error.message || 'Edge Function execution failed');
            }
            batchData = data;
          } catch (fnErr: any) {
            console.warn('Supabase Edge Function failed or unavailable, falling back to server API:', fnErr?.message);
          }
        }

        // 2. Fallback attempt: Express server proxy
        if (!batchData) {
          const res = await fetch('/api/geocode-vendors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_size: 25 })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `სერვერის შეცდომა: ${res.statusText}`);
          }

          batchData = await res.json();
        }

        if (isAbortedRef.current) {
          setStatus('stopped');
          break;
        }

        if (!batchData || batchData.error) {
          throw new Error(batchData?.error || 'გეოლოკაციის დამუშავება ვერ მოხერხდა.');
        }

        const batchProcessed = batchData.processed || 0;
        const batchUpdated = batchData.updated || 0;
        const batchFailed = batchProcessed - batchUpdated;

        totalProcessed += batchProcessed;
        totalUpdated += batchUpdated;
        totalFailed += Math.max(batchFailed, 0);

        setProcessedCount(totalProcessed);
        setUpdatedCount(totalUpdated);
        setFailedCount(totalFailed);

        if (batchData.results && batchData.results.length > 0) {
          const last = batchData.results[batchData.results.length - 1];
          setCurrentAddress(`${last.name} (${last.address || last.lat ? `${last.lat?.toFixed(4)}, ${last.lon?.toFixed(4)}` : ''})`);
        }

        // If batch processed items but updated 0: prevent infinite loop
        if (batchProcessed > 0 && batchUpdated === 0) {
          const firstErr = batchData.results?.find((r: any) => !r.success && r.error)?.error || batchData.message;
          throw new Error(`გეოლოკაცია შეჩერდა: კოორდინატები ვერ განახლდა. მიზეზი: ${firstErr || 'შეამოწმეთ API Key და დომენის უფლებები'}`);
        }

        if (batchProcessed === 0 || !batchData.has_more) {
          hasMore = false;
        }
      }

      if (!isAbortedRef.current) {
        setStatus('completed');
      }
    } catch (err: any) {
      if (isAbortedRef.current) {
        setStatus('stopped');
        return;
      }
      console.error('Geocoding process error:', err);
      setErrorMessage(err.message || 'გეოლოკაციის პროცესში დაფიქსირდა შეცდომა');
      setStatus('error');
    }
  };

  const handleStop = () => {
    isAbortedRef.current = true;
    setStatus('stopped');
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  const progressPercent = totalNeeding > 0 
    ? Math.min(Math.round((processedCount / totalNeeding) * 100), 100) 
    : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100 overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-xs">
              <MapPin size={19} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">მომწოდებლების გეოლოკაცია</h3>
              <p className="text-xs text-slate-500 font-medium">Geoapify მისამართების კოორდინატებად გარდაქმნა</p>
            </div>
          </div>
          {status !== 'running' && (
            <button
              onClick={() => {
                isAbortedRef.current = true;
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {status === 'idle' && (
            <>
              <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl text-slate-700 text-xs leading-relaxed space-y-1.5">
                <p className="font-semibold text-emerald-950">
                  გსურთ მომწოდებლების მისამართების კოორდინატებად (განედი და გრძედი) გარდაქმნა Geoapify-ის მეშვეობით?
                </p>
                <p className="text-slate-600">
                  სისტემა მოიძიებს იმ მომწოდებლებს, რომლებსაც ჯერ არ აქვთ კოორდინატები, მოარგებს თბილისისა და რეგიონების მისამართებს და ჩაწერს ბაზაში.
                </p>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <span className="text-[11px] font-bold text-slate-500 block mb-1">სულ</span>
                  <span className="text-lg font-extrabold text-slate-800">
                    {isLoadingCounts ? <Loader2 size={16} className="inline animate-spin text-slate-400" /> : totalVendors}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
                  <span className="text-[11px] font-bold text-amber-700 block mb-1">გასაკეთებელი</span>
                  <span className="text-lg font-extrabold text-amber-900">
                    {isLoadingCounts ? <Loader2 size={16} className="inline animate-spin text-amber-500" /> : totalNeeding}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <span className="text-[11px] font-bold text-emerald-700 block mb-1">კოორდინატით</span>
                  <span className="text-lg font-extrabold text-emerald-900">
                    {isLoadingCounts ? <Loader2 size={16} className="inline animate-spin text-emerald-500" /> : alreadyGeocoded}
                  </span>
                </div>
              </div>

              {totalNeeding === 0 && !isLoadingCounts && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-800 border border-blue-100 rounded-xl text-xs font-semibold">
                  <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0" />
                  <span>ყველა აქტიურ მომწოდებელს უკვე აქვს მინიჭებული გეოლოკაცია.</span>
                </div>
              )}
            </>
          )}

          {status === 'running' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-emerald-700" />
                  მიმდინარეობს დამუშავება...
                </span>
                <span className="text-emerald-800 font-extrabold">{progressPercent}%</span>
              </div>

              {/* Animated Progress Bar */}
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200/80">
                <div 
                  className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-bold block">დამუშავდა</span>
                  <span className="font-extrabold text-slate-800 text-sm">{processedCount} / {totalNeeding}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 font-bold block">წარმატებული</span>
                  <span className="font-extrabold text-emerald-800 text-sm">{updatedCount}</span>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                  <span className="text-[10px] text-rose-700 font-bold block">ვერ მოიძებნა</span>
                  <span className="font-extrabold text-rose-800 text-sm">{failedCount}</span>
                </div>
              </div>

              {currentAddress && (
                <div className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-xl text-[11px] text-slate-600 truncate">
                  <span className="font-semibold text-slate-700">ბოლო: </span>
                  {currentAddress}
                </div>
              )}
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center py-3 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 size={26} />
              </div>
              <h4 className="text-base font-bold text-slate-800">გეოლოკაცია დასრულდა!</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                წარმატებით განახლდა <strong>{updatedCount}</strong> მომწოდებლის გეოლოკაციის კოორდინატები.
                {failedCount > 0 && ` (${failedCount} მომწოდებლის მისამართი ვერ დაკონკრეტდა)`}
              </p>
            </div>
          )}

          {status === 'stopped' && (
            <div className="text-center py-3 space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
                <AlertCircle size={26} />
              </div>
              <h4 className="text-base font-bold text-slate-800">პროცესი შეჩერებულია</h4>
              <p className="text-xs text-slate-600">
                დამუშავდა {processedCount} მომწოდებელი, განახლდა {updatedCount}.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs">
              <AlertCircle size={17} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">შეცდომა გეოლოკაციისას</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          {status === 'idle' && (
            <>
              <button
                onClick={() => {
                  isAbortedRef.current = true;
                  onClose();
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer select-none"
              >
                გაუქმება
              </button>
              <button
                onClick={startGeocoding}
                disabled={totalNeeding === 0 || isLoadingCounts}
                className={`flex items-center gap-1.5 px-4.5 py-2 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer select-none ${totalNeeding === 0 || isLoadingCounts ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Play size={14} fill="currentColor" />
                გეოლოკაციის დაწყება
              </button>
            </>
          )}

          {status === 'running' && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer select-none"
            >
              <Square size={13} fill="currentColor" />
              შეჩერება
            </button>
          )}

          {(status === 'completed' || status === 'stopped' || status === 'error') && (
            <button
              onClick={handleFinish}
              className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer select-none"
            >
              დახურვა
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
