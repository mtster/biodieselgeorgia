import React from 'react';
import { VendorComment } from '../../types';
import SharedCommentsSection from '../common/SharedCommentsSection';

interface OrderCommentsSectionProps {
  comments: VendorComment[];
  onAddComment: () => void;
  onModifyComment: (comment: VendorComment) => void;
  onRemoveComment: (id: string) => void;
  users?: { id: string; name: string }[];
}

export default function OrderCommentsSection({
  comments,
  onAddComment,
  onModifyComment,
  onRemoveComment,
  users
}: OrderCommentsSectionProps) {
  return (
    <SharedCommentsSection
      comments={comments}
      onAddComment={onAddComment}
      onModifyComment={onModifyComment}
      onRemoveComment={onRemoveComment}
      idPrefix="order-internal-comments"
      users={users}
    />
  );
}
