import React from 'react';
import { t } from '../../utils/lang';
import { VendorComment } from '../../types';
import AddButton from '../AddButton';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface VendorCommentsSectionProps {
  comments: VendorComment[];
  onAddComment: () => void;
  onModifyComment: (comment: VendorComment) => void;
  onRemoveComment: (id: string) => void;
}

export default function VendorCommentsSection({
  comments,
  onAddComment,
  onModifyComment,
  onRemoveComment
}: VendorCommentsSectionProps) {
  return (
    <div className="bg-white p-5 border border-gray-100 rounded-2xl flex flex-col justify-between" id="vendor-internal-comments">
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
                <span>{new Date(c.date).toLocaleDateString()}</span>
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
                    title={t("Discard")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {comments.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs italic font-sans">
              {t("No comments.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
