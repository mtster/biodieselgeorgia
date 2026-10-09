import { useState } from 'react';
import { Order, User, VendorComment } from '../../types';

export function useOrderFormComments(
  editingOrder: Order,
  setEditingOrder: React.Dispatch<React.SetStateAction<Order | null>>,
  currentEmployee?: User
) {
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [activeComment, setActiveComment] = useState<VendorComment | null>(null);

  const comments = editingOrder.notes || [];

  const handleAddComment = () => {
    setActiveComment(null);
    setIsCommentModalOpen(true);
  };

  const handleModifyComment = (comment: VendorComment) => {
    setActiveComment(comment);
    setIsCommentModalOpen(true);
  };

  const handleRemoveComment = (id: string) => {
    setEditingOrder(prev => {
      if (!prev) return null;
      const updated = (prev.notes || []).filter(c => c.id !== id);
      return { ...prev, notes: updated };
    });
  };

  const handleSaveCommentModal = (text: string, beforeLeavingBase: boolean) => {
    setEditingOrder(prev => {
      if (!prev) return null;
      const currentList = prev.notes || [];
      let updated: VendorComment[];

      if (activeComment) {
        updated = currentList.map(c =>
          c.id === activeComment.id
            ? {
                ...c,
                comment: text,
                before_leaving_base: beforeLeavingBase,
                user_id: c.user_id || currentEmployee?.id,
                user_name: c.user_name || currentEmployee?.name || 'System'
              }
            : c
        );
      } else {
        const newComm: VendorComment = {
          id: 'c-' + Math.random().toString(36).substring(2, 9),
          comment: text,
          date: new Date().toISOString(),
          user_id: currentEmployee?.id,
          user_name: currentEmployee?.name || 'System',
          before_leaving_base: beforeLeavingBase
        };
        updated = [newComm, ...currentList];
      }
      return { ...prev, notes: updated };
    });
    setIsCommentModalOpen(false);
    setActiveComment(null);
  };

  const closeCommentModal = () => {
    setIsCommentModalOpen(false);
    setActiveComment(null);
  };

  return {
    comments,
    isCommentModalOpen,
    activeComment,
    handleAddComment,
    handleModifyComment,
    handleRemoveComment,
    handleSaveCommentModal,
    closeCommentModal
  };
}
