import React from 'react';
import { VendorComment } from '../../types';
import { Plus } from 'lucide-react';

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
        <div className="flex items-center justify-between border-b pb-2 mb-4">
          <span className="text-xs font-black uppercase text-gray-500 tracking-wider font-sans">
            Part 3: Memos / Internal Comments
          </span>
          <button
            type="button"
            onClick={onAddComment}
            className="px-2.5 py-1 text-[11px] bg-slate-50 hover:bg-slate-100 border text-slate-700 font-black rounded-lg transition inline-flex items-center gap-1 select-none cursor-pointer"
          >
            <Plus size={12} /> Add Memo
          </button>
        </div>

        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5 text-xs text-left">
              <div className="flex justify-between text-[10px] text-gray-400 font-sans font-bold">
                <span className="text-emerald-700 font-extrabold">{c.user_name}</span>
                <span>{new Date(c.date).toLocaleDateString()}</span>
              </div>
              <p className="text-gray-700 font-medium leading-relaxed font-sans select-all">{c.comment}</p>
              <div className="flex justify-end gap-1 select-none font-sans pt-1">
                <button
                  type="button"
                  onClick={() => onModifyComment(c)}
                  className="text-[10px] font-bold text-gray-450 hover:text-emerald-700 cursor-pointer"
                >
                  Edit
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => onRemoveComment(c.id)}
                  className="text-[10px] font-bold text-gray-450 hover:text-red-700 cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          ))}

          {comments.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs italic font-sans">
              No supplier memo entered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
