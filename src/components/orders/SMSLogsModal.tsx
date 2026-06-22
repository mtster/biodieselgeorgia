import React from 'react';
import { MessageSquareCode, X } from 'lucide-react';
import { t } from '../../utils/lang';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  smsLogs: any[];
}

export default function SMSLogsModal({ isOpen, onClose, smsLogs }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-gray-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
            <MessageSquareCode className="text-emerald-700 font-bold" size={17} />
            {t("SMS Logs (Fulfillment Dispatches)")}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-655 cursor-pointer p-1 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <p className="text-[11px] text-gray-550 font-sans text-left">
          {t("System notifications auto-delivered to accounting logs upon successful driver pickup sequence:")}
        </p>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {smsLogs.map(sms => (
            <div key={sms.id} className="p-3 bg-slate-50 border border-slate-105 rounded-xl space-y-1 text-xs text-left">
              <div className="flex items-center justify-between text-gray-400 text-[10px] font-mono">
                <span>{sms.recipient}</span>
                <span>{new Date(sms.date_time).toLocaleString('en-US')}</span>
              </div>
              <p className="font-medium text-gray-800 font-sans">{sms.message}</p>
              <span className="text-[9px] bg-emerald-50 text-emerald-850 px-1.5 py-0.5 rounded font-mono font-bold w-fit block border border-emerald-100">
                {t(sms.status)}
              </span>
            </div>
          ))}

          {smsLogs.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-xs italic font-sans animate-pulse">
              {t("No notifications recorded.")}
            </div>
          )}
        </div>

        <div className="pt-2 border-t flex justify-end font-sans select-none">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-750 rounded-xl text-xs font-bold cursor-pointer transition"
          >
            {t("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
