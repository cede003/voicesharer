'use client'

import CommentForm from './CommentForm'
import { Comment } from '@/types/comment'

interface CommentListProps {
  comments: Comment[]
  onReply: (commentId: string) => void
  replyToComment: string | null
  onSubmitReply: (userName: string, text: string, parentId: string) => Promise<void>
  onCancelReply: () => void
  isSubmitting: boolean
}

export default function CommentList({
  comments,
  onReply,
  replyToComment,
  onSubmitReply,
  onCancelReply,
  isSubmitting
}: CommentListProps) {
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderComment = (comment: Comment, depth = 0) => {
    const isReplying = replyToComment === comment.id
    
    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-3' : 'mb-4'}`}>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="font-medium text-gray-900">{comment.userName}</span>
              <span className="text-xs text-gray-500 ml-2">
                {formatDate(comment.createdAt)}
              </span>
            </div>
          </div>
          
          <p className="text-gray-700 mb-2">{comment.text}</p>
          
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Reply
          </button>

          {isReplying && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Replying to {comment.userName}</span>
                <button
                  onClick={onCancelReply}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
              <CommentForm
                onSubmit={(userName, text) => onSubmitReply(userName, text, comment.id)}
                isSubmitting={isSubmitting}
                placeholder={`Reply to ${comment.userName}...`}
              />
            </div>
          )}
        </div>

        {/* Render replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {comments.map(comment => renderComment(comment))}
    </div>
  )
}

