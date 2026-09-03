import React, { useState, useEffect } from 'react';
import { VendorComment } from '../../types';
import { t } from '../../utils/lang';
import FormModal from '../FormModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeComment: VendorComment | null;
  onSave: (text: string, beforeLeavingBase: boolean) => void;
  onDelete: (id: string) => void;
}

export default function OrderCommentModal({ isOpen, onClose, activeComment, onSave, onDelete }: Props) {
  const [commentText, setCommentText] = useState('');
  const [beforeLeavingBase, setBeforeLeavingBase] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (activeComment) {
        setCommentText(activeComment.comment);
        setBeforeLeavingBase(Boolean(activeComment.before_leaving_base));
      } else {
        setCommentText('');
        setBeforeLeavingBase(false);
      }
    }
  }, [isOpen, activeComment]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!commentText.trim()) return;
    onSave(commentText, beforeLeavingBase);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("Comment")}
      maxWidthClass="max-w-sm"
      onDelete={activeComment ? () => onDelete(activeComment.id) : undefined}
      deleteLabel={t("Delete")}
      onCancel={onClose}
      onSave={handleSave}
      saveLabel={t("Submit")}
    >
      <div className="space-y-3">
        <textarea 
          rows={4}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="შეკვეთის კომენტარი"
          className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:outline-none focus:border-emerald-600 focus:ring-emerald-600 transition-all"
        ></textarea>

        <label 
          htmlFor="order-comment-departure-alert"
          className="flex items-center gap-2 cursor-pointer select-none text-gray-700 py-1"
        >
          <input
            id="order-comment-departure-alert"
            type="checkbox"
            checked={beforeLeavingBase}
            onChange={(e) => setBeforeLeavingBase(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-0 focus:outline-none cursor-pointer accent-emerald-600"
          />
          <span className="text-xs font-medium text-gray-700">
            ბაზიდან გასვლამდე საყურადღებო
          </span>
        </label>
      </div>
    </FormModal>
  );
}
