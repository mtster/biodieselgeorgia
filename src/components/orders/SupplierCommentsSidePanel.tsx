import React from 'react';
import { Vendor, VendorComment, User } from '../../types';
import { Plus, Check } from 'lucide-react';
import { t, formatDateTime } from '../../utils/lang';

interface Props {
  supplier: Vendor;
  orderNotes: VendorComment[];
  onAddCommentToOrder: (comment: VendorComment) => void;
  onRemoveCommentFromOrder?: (commentText: string) => void;
  users?: User[];
}

export default function SupplierCommentsSidePanel({
  supplier,
  orderNotes,
  onAddCommentToOrder,
  users
}: Props) {
  const comments = Array.isArray(supplier.comments) ? supplier.comments : [];

  return (
    <div 
      className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 shadow-xs w-full max-w-full overflow-hidden animate-in fade-in slide-in-from-right-3 duration-200"
      id="order-supplier-comments-panel"
    >
      {/* Header matching Core Transaction Details style and size exactly */}
      <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
        <span className="text-xs font-black uppercase text-gray-400 tracking-wider block">
          {t("Supplier Comments")}
        </span>
        {comments.length > 0 && (
          <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comments List or Empty State */}
      {comments.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 text-xs text-gray-400 space-y-1.5">
          <p className="font-semibold text-gray-600">{t("No comments attached to this supplier")}</p>
          <p className="text-[11px] text-gray-400">{t("This supplier does not have any saved notes yet.")}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto overflow-x-hidden pr-1">
          {comments.map((c) => {
            const authorName = (users && c.user_id ? users.find(u => u.id === c.user_id)?.name : null) || c.user_name || t('System');
            const isImportant = Boolean(c.before_leaving_base);
            const isAlreadyAdded = orderNotes.some(n => n.comment?.trim() === c.comment?.trim());

            return (
              <div
                key={c.id}
                className={`p-3.5 rounded-xl space-y-2 text-xs text-left transition-all max-w-full overflow-hidden ${
                  isImportant
                    ? 'bg-rose-50/85 border border-rose-200/90 shadow-xs'
                    : 'bg-slate-50 border border-slate-200/80 shadow-xs'
                }`}
              >
                {/* Author, Date & Tag (Timestamp returned to top right) */}
                <div className="flex justify-between items-center text-[10px] font-sans font-bold flex-wrap gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={isImportant ? 'text-rose-900 font-extrabold' : 'text-emerald-700 font-extrabold'}>
                      {authorName}
                    </span>
                    {isImportant && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[9px] font-extrabold uppercase tracking-wide border border-rose-200/80">
                        ბაზიდან გასვლამდე საყურადღებო
                      </span>
                    )}
                  </div>
                  <span className={isImportant ? 'text-rose-400' : 'text-gray-400'}>
                    {formatDateTime(c.date)}
                  </span>
                </div>

                {/* Comment text with plus button sticking to the right edge and bottom-aligned */}
                <div className="flex items-end justify-between gap-2.5">
                  <p className={`flex-1 min-w-0 leading-relaxed font-sans select-all whitespace-pre-wrap break-words break-all [overflow-wrap:anywhere] [word-break:break-word] ${
                    isImportant ? 'text-rose-950 font-semibold' : 'text-gray-700 font-medium'
                  }`}>
                    {c.comment?.trim()}
                  </p>

                  <div className="shrink-0 flex items-end">
                    {isAlreadyAdded ? (
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-200/90 text-gray-500 border border-gray-300/80 cursor-not-allowed select-none shadow-xs"
                        title={t("Added to Order")}
                      >
                        <Check size={16} strokeWidth={2.5} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddCommentToOrder(c);
                        }}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white shadow-xs cursor-pointer select-none transition-all"
                        title={t("Add to Order")}
                      >
                        <Plus size={16} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
