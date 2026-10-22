import React from 'react';
import { VendorComment } from '../../types';
import SharedCommentsSection from '../common/SharedCommentsSection';

interface VendorCommentsSectionProps {
  comments: VendorComment[];
  onAddComment: () => void;
  onModifyComment: (comment: VendorComment) => void;
  onRemoveComment: (id: string) => void;
  users?: { id: string; name: string }[];
}

export default function VendorCommentsSection({
  comments,
  onAddComment,
  onModifyComment,
  onRemoveComment,
  users
}: VendorCommentsSectionProps) {
  return (
    <SharedCommentsSection
      comments={comments}
      onAddComment={onAddComment}
      onModifyComment={onModifyComment}
      onRemoveComment={onRemoveComment}
      idPrefix="vendor-internal-comments"
      users={users}
    />
  );
}
