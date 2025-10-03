'use client'

import { useMemo, useState, useRef } from 'react'
import { formatTime } from '@/utils/audioUtils'
import { getWordsWithPunctuation, isCurrentToken, AlignedToken } from '@/utils/alignTranscript'
import CommentList from './CommentList'
import CommentForm from './CommentForm'
import ReactionPicker from './ReactionPicker'
import { Comment, ChapterDisplayProps, Reaction, ReactionGroup } from '@/types'

export default function ChapterDisplay({
  chapters,
  wordTimestamps,
  currentTime,
  currentChapterIndex,
  comments,
  reactions,
  showCommentForm,
  replyToComment,
  isSubmitting,
  onJumpToChapter,
  onJumpToWord,
  onToggleCommentForm,
  onSubmitComment,
  onReply,
  onCancelReply,
  onAddReaction
}: ChapterDisplayProps) {
  // State to track which chapters have their comments expanded
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())
  // State to track which chapter's reaction picker is open
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null)
  // State to track the picker position
  const [pickerPosition, setPickerPosition] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({})
  // Ref to store the reaction button elements
  const reactionButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const toggleCommentsExpanded = (chapterIndex: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(chapterIndex)) {
        next.delete(chapterIndex)
      } else {
        next.add(chapterIndex)
      }
      return next
    })
  }

  // Helper function to count total comments including replies
  const countTotalComments = (comments: Comment[]): number => {
    return comments.reduce((total, comment) => {
      return total + 1 + countTotalComments(comment.replies || [])
    }, 0)
  }

  // Helper function to group reactions by emoji
  const groupReactions = (reactions: Reaction[]): ReactionGroup[] => {
    const groups = new Map<string, { count: number; users: string[] }>()
    
    reactions.forEach(reaction => {
      const existing = groups.get(reaction.emoji)
      if (existing) {
        existing.count++
        if (reaction.userName) {
          existing.users.push(reaction.userName)
        }
      } else {
        groups.set(reaction.emoji, {
          count: 1,
          users: reaction.userName ? [reaction.userName] : []
        })
      }
    })

    return Array.from(groups.entries()).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      users: data.users
    }))
  }

  // Get aligned tokens with punctuation separated from the FULL transcript
  const alignedTokens = useMemo(() => {
    // Combine all chapter text to get fullText
    const fullText = chapters.map(ch => ch.sentences.join(' ')).join(' ')
    const tokens = getWordsWithPunctuation(fullText, wordTimestamps)
    
    console.log('=== ALIGNMENT DEBUG ===')
    console.log('Full text:', fullText)
    console.log('Total wordTimestamps:', wordTimestamps.length)
    console.log('Total aligned tokens:', tokens.length)
    console.log('Word tokens (non-punctuation):', tokens.filter(t => !t.isPunctuation).length)
    console.log('Punctuation tokens:', tokens.filter(t => t.isPunctuation).length)
    console.log('First 20 aligned tokens:', tokens.slice(0, 20))
    
    return tokens
  }, [chapters, wordTimestamps])

  // Pre-compute all chapter tokens once (performance optimization)
  const chapterTokensMap = useMemo(() => {
    const map = new Map<number, AlignedToken[]>()
    
    chapters.forEach((chapter, chapterIndex) => {
      const chapterText = chapter.sentences.join(' ')
      
      console.log(`\n=== CHAPTER ${chapterIndex} DEBUG ===`)
      console.log('Chapter title:', chapter.title)
      console.log('Chapter text:', chapterText)
      
      // Match the chapter text directly with aligned tokens
      // Extract just the words (no punctuation) from chapter text for matching
      const chapterWords = chapterText.match(/[\w']+/g) || []
      console.log('Chapter words to match:', chapterWords.length, chapterWords)
      
      // Find where these words appear in the aligned tokens
      const result: AlignedToken[] = []
      let matchIndex = 0
      let isMatching = false
      
      for (let i = 0; i < alignedTokens.length; i++) {
        const token = alignedTokens[i]
        
        if (!token.isPunctuation) {
          // It's a word - check if it matches the current chapter word
          const normalizedToken = token.text.toLowerCase().trim()
          const normalizedChapterWord = chapterWords[matchIndex]?.toLowerCase().trim()
          
          if (normalizedToken === normalizedChapterWord) {
            // Start or continue matching
            isMatching = true
            result.push(token)
            
            // Include any punctuation after this word
            let nextIdx = i + 1
            while (nextIdx < alignedTokens.length && alignedTokens[nextIdx].isPunctuation) {
              result.push(alignedTokens[nextIdx])
              nextIdx++
              i++ // Skip these in outer loop
            }
            
            matchIndex++
            
            // If we've matched all chapter words, we're done
            if (matchIndex >= chapterWords.length) {
              break
            }
          } else if (isMatching) {
            // We were matching but hit a mismatch - stop
            break
          }
        }
      }
      
      console.log('Matched tokens:', result.length)
      console.log('Word tokens:', result.filter(t => !t.isPunctuation).length)
      console.log('Expected words:', chapterWords.length)
      console.log('First 10 tokens:', result.slice(0, 10))
      console.log('Last 10 tokens:', result.slice(-10))
      
      map.set(chapterIndex, result)
    })
    
    return map
  }, [chapters, alignedTokens])

  return (
    <>
    <div className="mt-6 space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">Transcript</h3>
      
      {chapters.map((chapter, chapterIndex) => {
        const isActive = chapterIndex === currentChapterIndex
        const chapterTokens = chapterTokensMap.get(chapterIndex) || []
        const chapterComments = comments.filter(c => c.chapterIndex === chapterIndex && !c.parentId)
        const totalCommentCount = countTotalComments(chapterComments)
        const chapterReactions = reactions.filter(r => r.chapterIndex === chapterIndex)
        const groupedReactions = groupReactions(chapterReactions)
        
        return (
          <div
            key={chapterIndex}
            id={`chapter-${chapterIndex}`}
            className={`transition-all duration-300 ${
              isActive ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
            } border rounded-lg p-4`}
          >
            {/* Chapter header with timestamp, title, and reactions */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3 flex-1">
                <span 
                  className={`text-sm font-mono cursor-pointer flex-shrink-0 w-[2.75rem] ${
                    isActive ? 'text-blue-600' : 'text-gray-500'
                  }`}
                  onClick={() => onJumpToChapter(chapterIndex)}
                >
                  {formatTime(chapter.startTime)}
                </span>
                
                <h4 
                  className={`font-medium cursor-pointer ${
                    isActive ? 'text-blue-900' : 'text-gray-700'
                  }`}
                  onClick={() => onJumpToChapter(chapterIndex)}
                >
                  {chapter.title}
                </h4>
              </div>

              {/* Reactions row - horizontal, top right */}
              {groupedReactions.length > 0 && (
                <div className="reactions-scroll flex items-center gap-2 max-w-xs overflow-x-auto pb-1">
                  {groupedReactions.map((reactionGroup, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-1 flex-shrink-0"
                      title={reactionGroup.users.length > 0 ? reactionGroup.users.join(', ') : undefined}
                    >
                      <span className="text-lg">{reactionGroup.emoji}</span>
                      {reactionGroup.count > 1 && (
                        <span className="text-xs text-gray-600 font-medium">
                          {reactionGroup.count}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interactive transcript with words and punctuation */}
            <div className="flex gap-3 mb-4">
              <div className="w-[2.75rem] flex-shrink-0"></div>
              <div className="flex-1">
                <p className="text-gray-800 leading-relaxed">
                {chapterTokens.map((token, tokenIndex) => {
                  const nextToken = chapterTokens[tokenIndex + 1]
                  const shouldAddSpace = tokenIndex < chapterTokens.length - 1 && 
                                        (!token.isPunctuation || !nextToken?.isPunctuation)
                  
                  if (token.isPunctuation) {
                    // Render punctuation (not clickable)
                    return (
                      <span key={tokenIndex}>
                        <span className="text-gray-700">{token.text}</span>
                        {shouldAddSpace && ' '}
                      </span>
                    )
                  } else {
                    // Render word (clickable and highlightable)
                    const isCurrentWord = isCurrentToken(currentTime, token)
                    
                    return (
                      <span key={tokenIndex}>
                        <span
                          className={`cursor-pointer transition-all duration-200 ${
                            isCurrentWord
                              ? 'bg-blue-200 text-blue-900 font-semibold px-1 rounded'
                              : 'hover:bg-gray-200 hover:px-1 hover:rounded'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (token.start !== undefined) {
                              onJumpToWord(token.start)
                            }
                          }}
                        >
                          {token.text}
                        </span>
                        {shouldAddSpace && !nextToken?.isPunctuation && ' '}
                      </span>
                    )
                  }
                })}
              </p>
              </div>
            </div>

            {/* Comments section */}
            <div className="flex gap-3">
              <div className="w-[2.75rem] flex-shrink-0"></div>
              <div className="flex-1">
              {/* Comment count and toggle button with Add Reaction */}
              {totalCommentCount > 0 && (
                <div className="mb-2 flex items-center gap-3">
                  <button
                    onClick={() => toggleCommentsExpanded(chapterIndex)}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors cursor-pointer"
                  >
                    <svg 
                      className={`w-4 h-4 transition-transform ${expandedComments.has(chapterIndex) ? 'rotate-90' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>
                      {totalCommentCount} {totalCommentCount === 1 ? 'Comment' : 'Comments'}
                    </span>
                  </button>
                  <span className="text-gray-400">•</span>
                  <button
                    ref={(el) => {
                      if (el) reactionButtonRefs.current.set(chapterIndex, el)
                    }}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setPickerPosition({
                        top: rect.bottom + 8,
                        left: rect.left,
                      })
                      setShowReactionPicker(chapterIndex)
                    }}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer"
                  >
                    + Add Reaction
                  </button>
                </div>
              )}

              {/* Comments expanded section */}
              {expandedComments.has(chapterIndex) && (
                <div className="space-y-3">
                  {/* Comment form at the top */}
                  <div>
                    <button
                      onClick={() => onToggleCommentForm(chapterIndex)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors cursor-pointer"
                    >
                      {showCommentForm === chapterIndex ? 'Cancel' : '+ Add Comment'}
                    </button>

                    {showCommentForm === chapterIndex && !replyToComment && (
                      <div className="mt-2">
                        <CommentForm
                          onSubmit={(userName: string, text: string) => onSubmitComment(userName, text, chapterIndex)}
                          isSubmitting={isSubmitting}
                          placeholder="Add a comment to this chapter..."
                        />
                      </div>
                    )}
                  </div>

                  {/* Comments list - scrollable */}
                  {chapterComments.length > 0 && (
                    <div className="max-h-96 overflow-y-auto pl-2 pr-2 -mr-2">
                      <CommentList
                        comments={chapterComments}
                        onReply={(commentId: string) => onReply(commentId, chapterIndex)}
                        replyToComment={replyToComment}
                        onSubmitReply={(userName: string, text: string, parentId: string) => 
                          onSubmitComment(userName, text, chapterIndex, parentId)
                        }
                        onCancelReply={onCancelReply}
                        isSubmitting={isSubmitting}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Show add comment and reaction buttons when there are no comments */}
              {totalCommentCount === 0 && (
                <div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleCommentForm(chapterIndex)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors cursor-pointer"
                    >
                      {showCommentForm === chapterIndex ? 'Cancel' : '+ Add Comment'}
                    </button>
                    <span className="text-gray-400">•</span>
                    <button
                      ref={(el) => {
                        if (el) reactionButtonRefs.current.set(chapterIndex + 1000, el)
                      }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setPickerPosition({
                          top: rect.bottom + 8,
                          left: rect.left,
                        })
                        setShowReactionPicker(chapterIndex)
                      }}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors cursor-pointer"
                    >
                      + Add Reaction
                    </button>
                  </div>

                  {showCommentForm === chapterIndex && !replyToComment && (
                    <div className="mt-2">
                      <CommentForm
                        onSubmit={(userName: string, text: string) => onSubmitComment(userName, text, chapterIndex)}
                        isSubmitting={isSubmitting}
                        placeholder="Add a comment to this chapter..."
                      />
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        )
      })}

    </div>

    {/* Reaction Picker - rendered outside to avoid layout shifts */}
    {showReactionPicker !== null && (
      <ReactionPicker
        onSelectEmoji={(emoji) => {
          onAddReaction(showReactionPicker, emoji)
        }}
        onClose={() => setShowReactionPicker(null)}
        position={pickerPosition}
      />
    )}
    </>
  )
}

