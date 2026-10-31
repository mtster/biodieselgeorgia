import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PhoneCall, LogOut, X, ChevronRight, Truck, User as UserIcon } from 'lucide-react';
import { OfficeContactsModal } from './OfficeContactsModal';
import { SlideToSignOutModal } from './SlideToSignOutModal';

interface MobileLogisticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onLogOut: () => void;
  vehiclePlateText?: string;
  assignedDriverName?: string;
  assignedCompanionName?: string;
}

export function MobileLogisticsDrawer({
  isOpen,
  onClose,
  onLogOut,
  vehiclePlateText,
  assignedDriverName,
  assignedCompanionName
}: MobileLogisticsDrawerProps) {
  const [showOfficeModal, setShowOfficeModal] = useState<boolean>(false);
  const [showSignOutConfirmModal, setShowSignOutConfirmModal] = useState<boolean>(false);

  const handleOpenOffice = () => {
    setShowOfficeModal(true);
  };

  const handleOpenSignOutConfirm = () => {
    setShowSignOutConfirmModal(true);
  };

  const handleConfirmSignOut = () => {
    setShowSignOutConfirmModal(false);
    onClose();
    onLogOut();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-40 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Sliding Drawer from Right */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="w-screen max-w-xs bg-white shadow-2xl flex flex-col h-full border-l border-slate-100"
              >
                {/* Clean Header */}
                <div className="bg-gradient-to-b from-emerald-950 to-emerald-900 text-white p-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] border-b border-emerald-800/60">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-black tracking-tight text-white">
                      მენიუ
                    </h2>

                    <button
                      onClick={onClose}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center text-white/90 transition cursor-pointer"
                      title="დახურვა"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Vehicle summary badge */}
                  {vehiclePlateText && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-200/90 text-xs">
                        <Truck size={13} className="text-emerald-300" />
                        <span className="text-[11px] font-medium">ავტომობილი:</span>
                      </div>
                      <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-white/15 text-white tracking-wider border border-white/20">
                        {vehiclePlateText}
                      </span>
                    </div>
                  )}
                </div>

                {/* Drawer Content */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {/* Office Button: Simple, sleek, clean */}
                  <button
                    onClick={handleOpenOffice}
                    className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 active:scale-[0.99] border border-slate-200/90 rounded-2xl p-3.5 flex items-center justify-between shadow-xs transition cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center justify-center shadow-xs flex-shrink-0">
                        <PhoneCall size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900">
                          ოფისი
                        </h4>
                      </div>
                    </div>

                    <ChevronRight size={18} className="text-slate-400" />
                  </button>

                  {/* Crew quick overview inside drawer */}
                  {(assignedDriverName || assignedCompanionName) && (
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                        <UserIcon size={12} />
                        <span>ეკიპაჟი</span>
                      </div>
                      {assignedDriverName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">მძღოლი:</span>
                          <span className="font-bold text-slate-800 truncate max-w-[150px]">{assignedDriverName}</span>
                        </div>
                      )}
                      {assignedCompanionName && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[11px]">თანმხლები:</span>
                          <span className="font-bold text-slate-800 truncate max-w-[150px]">{assignedCompanionName}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drawer Footer with Bottom Sign Out Button */}
                <div className="p-4 border-t border-slate-100 bg-white pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
                  <button
                    onClick={handleOpenSignOutConfirm}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50 hover:bg-rose-50 active:bg-rose-100 border border-slate-200 hover:border-rose-200 text-rose-600 font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <LogOut size={15} className="text-rose-500" />
                    <span>გამოსვლა</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Office Contacts Modal */}
      <OfficeContactsModal
        isOpen={showOfficeModal}
        onClose={() => setShowOfficeModal(false)}
      />

      {/* Slide to Sign Out Confirmation Modal */}
      <SlideToSignOutModal
        isOpen={showSignOutConfirmModal}
        onClose={() => setShowSignOutConfirmModal(false)}
        onConfirm={handleConfirmSignOut}
      />
    </>
  );
}
