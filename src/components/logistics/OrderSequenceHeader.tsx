import React from 'react';
import { ArrowLeft, Loader2, Check } from 'lucide-react';

interface OrderSequenceHeaderProps {
  vehiclePlateText?: string;
  orderCount: number;
  isSaving: boolean;
  isDirty: boolean;
  isOptimizing: boolean;
  isOptimized: boolean;
  onGoBack: () => void;
  onAutoOptimize: () => void;
}

export const OrderSequenceHeader: React.FC<OrderSequenceHeaderProps> = ({
  vehiclePlateText,
  orderCount,
  isSaving,
  isDirty,
  isOptimizing,
  isOptimized,
  onGoBack,
  onAutoOptimize
}) => {
  return (
    <>
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-xs flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            id="btn-sequence-go-back"
            onClick={onGoBack}
            disabled={isSaving}
            className="p-2 -ml-1 text-slate-700 hover:text-emerald-900 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-xs"
            title="უკან დაბრუნება"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin text-emerald-800" />
            ) : (
              <ArrowLeft size={20} className="stroke-[2.4]" />
            )}
          </button>
          <div>
            <h1 className="text-base font-extrabold text-slate-800 leading-tight">
              შეკვეთების თანმიმდევრობა
            </h1>
            <p className="text-[11px] font-medium text-slate-500">
              {vehiclePlateText ? `${vehiclePlateText} • ` : ''}დღის შეკვეთები ({orderCount})
            </p>
          </div>
        </div>

        {/* Action badge or saving indicator */}
        {isSaving ? (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-100">
            <Loader2 size={12} className="animate-spin" />
            ინახება...
          </span>
        ) : isDirty ? (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/80">
            შეცვლილია
          </span>
        ) : null}
      </header>

      {/* Auto-Rearrange Action Bar */}
      <div className="bg-white/80 backdrop-blur-xs border-b border-gray-200/70 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="text-[11px] text-slate-600 font-medium">
          შეცვალეთ თანმიმდევრობა ან გამოიყენეთ ავტომატური მარშრუტის ოპტიმიზაცია
        </div>
        <button
          id="btn-auto-optimize-route"
          onClick={onAutoOptimize}
          disabled={isOptimizing || isOptimized || isSaving || orderCount <= 1}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition select-none cursor-pointer shadow-xs ${
            isOptimized
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              : 'bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white'
          } ${isOptimizing ? 'opacity-80 cursor-wait' : ''}`}
          title={isOptimized ? 'მარშრუტი უკვე ოპტიმიზებულია სისტემის მიერ' : 'Geoapify ოპტიმალური მარშრუტის დალაგება'}
        >
          {isOptimizing ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>ლაგდება...</span>
            </>
          ) : isOptimized ? (
            <>
              <Check size={13} className="stroke-[2.5]" />
              <span>დალაგებულია</span>
            </>
          ) : (
            <span>მარშრუტის ოპტიმიზაცია</span>
          )}
        </button>
      </div>
    </>
  );
};
