import React, { useState, useEffect } from 'react';
import { VendorComment } from '../../types';
import { X, Trash2 } from 'lucide-react';
import { t } from '../../utils/lang';
import FormModal from '../FormModal';

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
      <div className="space-y-1.5">
        <textarea 
          rows={4}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={t("Write specific supplier memo here...")}
          className="w-full p-3 bg-slate-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
        ></textarea>
      </div>
    </FormModal>
  );
}
