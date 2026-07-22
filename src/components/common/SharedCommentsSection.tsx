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
}

export default function SharedCommentsSection({
  comments,
  onAddComment,
  onModifyComment,
  onRemoveComment,
  idPrefix = 'internal-comments'
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
          {comments.map((c) => (
            <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs text-left">
              <div className="flex justify-between text-[10px] text-gray-400 font-sans font-bold">
                <span className="text-emerald-700 font-extrabold">{c.user_name}</span>
                <span>{formatDateTime(c.date)}</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <p className="text-gray-700 font-medium leading-relaxed font-sans select-all flex-grow">{c.comment}</p>
                <div className="flex gap-1 select-none font-sans pt-1">
                  <button
                    type="button"
                    onClick={() => onModifyComment(c)}
                    className="p-1 px-1.5 text-gray-400 hover:text-emerald-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                    title={t("Edit")}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveComment(c.id)}
                    className="p-1 px-1.5 text-gray-400 hover:text-red-700 hover:bg-slate-100 rounded-lg cursor-pointer transition-all"
                    title={t("Delete")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}

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
