import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download, Share, X } from 'lucide-react';
import { t } from '../../utils/lang';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed standalone PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        type="button"
        className={`flex items-center gap-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 px-3 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer ${className}`}
        title="დააინსტალირეთ აპლიკაცია"
      >
        <Download size={14} />
        <span>აპლიკაციის ინსტალაცია</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          type="button"
          className={`flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-200 transition cursor-pointer ${className}`}
        >
          <Download size={14} />
          <span>ეკრანზე დამატება (iOS)</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-left space-y-4 border border-gray-150 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h3 className="text-sm font-black text-gray-900 uppercase">
                  {t("დაამატეთ მთავარ ეკრანზე")}
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="text-xs text-gray-650 space-y-2.5 font-sans leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px]">1</span>
                  <span>Safari-ს მენიუში დააჭირეთ გაზიარების ღილაკს <strong>Share</strong> (<Share size={13} className="inline text-blue-600 align-text-bottom" />).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px]">2</span>
                  <span>ჩამოსქროლეთ და აირჩიეთ <strong>"Add to Home Screen"</strong> (მთავარ ეკრანზე დამატება).</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px]">3</span>
                  <span>ზედა მარჯვენა კუთხეში დააჭირეთ <strong>"Add"</strong>.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                type="button"
                className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 py-2.5 text-xs font-bold text-gray-800 transition cursor-pointer"
              >
                {t("დახურვა")}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
