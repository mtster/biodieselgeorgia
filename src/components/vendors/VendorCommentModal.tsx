import React, { useState, useEffect } from 'react';
import { VendorComment } from '../../types';
import { X, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeComment: VendorComment | null;
  onSave: (text: string) => void;
  onDelete: (id: string) => void;
}

export default function VendorCommentModal({ isOpen, onClose, activeComment, onSave, onDelete }: Props) {
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (activeComment) {
        setCommentText(activeComment.comment);
      } else {
        setCommentText('');
      }
    }
  }, [isOpen, activeComment]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!commentText.trim()) return;
    onSave(commentText);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-100 animate-in zoom-in-95">
        <div className="flex justify-between items-center border-b pb-2">
          <h4 className="font-extrabold text-gray-800 text-xs uppercase tracking-wide">
            Comment
          </h4>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded text-gray-400">
            <X size={14} />
          </button>
        </div>

        <div className="text-left space-y-1.5">
          <textarea 
            rows={4}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write specific supplier memo here..."
            className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          ></textarea>
        </div>

        <div className="flex gap-2.5 justify-end pt-1 font-sans select-none">
          {activeComment && (
            <button
              type="button"
              onClick={() => onDelete(activeComment.id)}
              className="mr-auto px-3 py-1.5 border border-rose-250 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition flex items-center gap-1 select-none cursor-pointer"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-100 text-gray-650 rounded-lg text-xs font-bold transition select-none cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white rounded-lg text-xs font-extrabold transition select-none cursor-pointer"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
