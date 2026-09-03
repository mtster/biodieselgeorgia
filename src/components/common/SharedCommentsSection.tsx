import React from 'react';
import { t, formatDateTime } from '../../utils/lang';
import { VendorComment } from '../../types';
import AddButton from '../AddButton';
import { Pencil, Trash2 } from 'lucide-react';

interface SharedCommentsSectionProps {
  comments: VendorComment[];
  onAddComment: () => void;
  onModifyComment: (comment: VendorComment) => void;
  onRemoveComment: (id: string) => void;
  idPrefix?: string;
  users?: { id: string; name: string }[];
}

export default function SharedCommentsSection({
  comments,
  onAddComment,
  onModifyComment,
  onRemoveComment,
  idPrefix = 'internal-comments',
  users
}: SharedCommentsSectionProps) {
  return (
    <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between" id={idPrefix}>
      <div>
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
          <span className="text-xs font-bold uppercase text-gray-500 tracking-wider font-sans">
            {t("Comments")}
          </span>
          <AddButton
            label="Add Comment"
            onClick={onAddComment}
          />
        </div>

        <div className="space-y-2.5 max-h-[224px] overflow-y-auto pr-1">
          {comments.map((c) => {
            const authorName = (users && c.user_id ? users.find(u => u.id === c.user_id)?.name : null) || c.user_name || 'System';
            const isImportant = Boolean(c.before_leaving_base);

            return (
              <div 
                key={c.id} 
                className={`p-3 rounded-xl space-y-1.5 text-xs text-left transition-all ${
                  isImportant 
                    ? 'bg-rose-50/85 border border-rose-200/90 shadow-xs' 
                    : 'bg-slate-50 border border-slate-100'
                }`}
              >
                <div className="flex justify-between items-center text-[10px] font-sans font-bold">
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
                  <span className={isImportant ? 'text-rose-400' : 'text-gray-400'}>{formatDateTime(c.date)}</span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <p className={`leading-relaxed font-sans select-all flex-grow ${
                    isImportant ? 'text-rose-950 font-semibold' : 'text-gray-700 font-medium'
                  }`}>
                    {c.comment}
                  </p>
                  <div className="flex gap-1 select-none font-sans pt-1">
                    <button
                      type="button"
                      onClick={() => onModifyComment(c)}
                      className={`p-1 px-1.5 rounded-lg cursor-pointer transition-all ${
                        isImportant 
                          ? 'text-rose-500 hover:text-rose-800 hover:bg-rose-100/60' 
                          : 'text-gray-400 hover:text-emerald-800 hover:bg-slate-100'
                      }`}
                      title={t("Edit")}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveComment(c.id)}
                      className={`p-1 px-1.5 rounded-lg cursor-pointer transition-all ${
                        isImportant 
                          ? 'text-rose-400 hover:text-red-700 hover:bg-rose-100/60' 
                          : 'text-gray-400 hover:text-red-700 hover:bg-slate-100'
                      }`}
                      title={t("Delete")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {comments.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-xs italic font-sans">
              {t("No comments.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
