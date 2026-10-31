import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, MessageCircle, X, User, Loader2, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { appCache } from '../../utils/cache';

interface OfficeContact {
  id: string;
  name: string;
  phone: string;
  role?: string;
}

interface OfficeContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TARGET_OFFICE_IDS = [
  '8ed6c62a-7382-408b-a33f-5e7d7f2edfb8',
  '1ff4008e-08de-49fc-bd0d-631228b26347'
];

const CACHE_KEY = 'office_contacts_cache_v1';

// Clean phone for tel: protocol (e.g., +995599123456 or 599123456)
function formatTelUri(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  return `tel:${cleaned}`;
}

// Format phone for WhatsApp wa.me link (standard international format without + or spaces)
function formatWhatsAppUri(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '995' + cleaned.slice(1);
  } else if (!cleaned.startsWith('995') && cleaned.length === 9) {
    cleaned = '995' + cleaned;
  }
  return `https://wa.me/${cleaned}`;
}

export function OfficeContactsModal({ isOpen, onClose }: OfficeContactsModalProps) {
  const [contacts, setContacts] = useState<OfficeContact[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Check in-memory cache and localStorage first to eliminate duplicate fetches
    const memoryCached = appCache.get<OfficeContact[]>(CACHE_KEY);
    if (memoryCached && Array.isArray(memoryCached) && memoryCached.length > 0) {
      setContacts(memoryCached);
      setLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          appCache.set(CACHE_KEY, parsed);
          setContacts(parsed);
          setLoading(false);
          return;
        }
      }
    } catch {}

    // 2. Fetch if not cached
    let isMounted = true;
    const fetchOfficeContacts = async () => {
      setLoading(true);
      setError(null);

      const processProfiles = (profilesList: any[]): OfficeContact[] => {
        const profileMap = new Map<string, any>();
        profilesList.forEach((p: any) => {
          if (p && p.id) profileMap.set(p.id, p);
        });

        return TARGET_OFFICE_IDS.map((targetId, index) => {
          const p = profileMap.get(targetId);
          return {
            id: targetId,
            name: p?.name || (index === 0 ? 'ოფისი 1' : 'ოფისი 2'),
            phone: p?.phone || '',
            role: p?.role || 'office'
          };
        });
      };

      try {
        let fetchedData: any[] | null = null;

        // Try direct Supabase query with valid columns
        if (isSupabaseConfigured && supabase) {
          try {
            const { data, error: fetchErr } = await supabase
              .from('profiles')
              .select('id, name, phone, role, email')
              .in('id', TARGET_OFFICE_IDS);

            if (!fetchErr && data && data.length > 0) {
              fetchedData = data;
            }
          } catch (e) {
            console.warn('Client-side profiles query warning:', e);
          }
        }

        // Fallback to server endpoint if client query is blocked by RLS
        if (!fetchedData || fetchedData.length === 0) {
          try {
            const res = await fetch('/api/office-contacts');
            if (res.ok) {
              const json = await res.json();
              if (json?.contacts && Array.isArray(json.contacts)) {
                if (isMounted) {
                  const finalContacts = json.contacts;
                  appCache.set(CACHE_KEY, finalContacts);
                  try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify(finalContacts));
                  } catch {}
                  setContacts(finalContacts);
                  setLoading(false);
                  return;
                }
              }
            }
          } catch (apiErr) {
            console.warn('Server /api/office-contacts fetch failed:', apiErr);
          }
        }

        if (isMounted) {
          if (fetchedData && fetchedData.length > 0) {
            const processed = processProfiles(fetchedData);
            appCache.set(CACHE_KEY, processed);
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(processed));
            } catch {}
            setContacts(processed);
          } else {
            setError('საკონტაქტო მონაცემების ჩატვირთვა ვერ მოხერხდა');
          }
        }
      } catch (err: any) {
        console.warn('Error fetching office contacts:', err);
        if (isMounted) {
          setError('საკონტაქტო მონაცემების ჩატვირთვა ვერ მოხერხდა');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOfficeContacts();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* Vertically and horizontally centered on ALL screens including mobile */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col my-auto"
        >
          {/* Sleek Minimal Header */}
          <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800/60">
            <h3 className="text-sm font-black tracking-tight text-white leading-tight">
              ოფისი
            </h3>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white/90 transition cursor-pointer"
              title="დახურვა"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-3.5 max-h-[75vh]">
            {loading && (
              <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-slate-500">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
                <span className="text-xs font-medium">იტვირთება...</span>
              </div>
            )}

            {!loading && error && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="text-amber-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!loading && contacts.length > 0 && (
              <div className="space-y-3">
                {contacts.map((contact) => {
                  const hasPhone = Boolean(contact.phone && contact.phone.trim().length > 3);
                  const displayPhone = hasPhone ? contact.phone : 'ნომერი არ არის';

                  return (
                    <div
                      key={contact.id}
                      className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 shadow-xs transition hover:border-emerald-300 space-y-3"
                    >
                      {/* User Info Header */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center font-black text-xs flex-shrink-0 border border-emerald-200/60 shadow-xs">
                          {contact.name.charAt(0).toUpperCase() || <User size={16} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-slate-900 truncate">
                            {contact.name}
                          </p>
                          <p className="text-xs font-medium text-slate-500 truncate">
                            {displayPhone}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons: ტელეფონი and WhatsApp */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        {/* Direct Native Phone Call */}
                        {hasPhone ? (
                          <a
                            href={formatTelUri(contact.phone)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-xs transition cursor-pointer select-none"
                          >
                            <Phone size={13} />
                            <span>ტელეფონი</span>
                          </a>
                        ) : (
                          <button
                            disabled
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed select-none"
                          >
                            <Phone size={13} />
                            <span>ტელეფონი</span>
                          </button>
                        )}

                        {/* WhatsApp Redirection */}
                        {hasPhone ? (
                          <a
                            href={formatWhatsAppUri(contact.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white text-xs font-bold shadow-xs transition cursor-pointer select-none"
                          >
                            <MessageCircle size={13} />
                            <span>WhatsApp</span>
                          </a>
                        ) : (
                          <button
                            disabled
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed select-none"
                          >
                            <MessageCircle size={13} />
                            <span>WhatsApp</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
