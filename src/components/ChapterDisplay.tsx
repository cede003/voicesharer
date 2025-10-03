'use client'

import { useMemo, useState } from 'react'
import { formatTime } from '@/utils/audioUtils'
import { getWordsWithPunctuation, isCurrentToken, AlignedToken } from '@/utils/alignTranscript'
import CommentList from './CommentList'
import CommentForm from './CommentForm'
import { Comment, ChapterDisplayProps } from '@/types'

export default function ChapterDisplay({
  chapters,
  wordTimestamps,
  currentTime,
  currentChapterIndex,
  comments,
  showCommentForm,
  replyToComment,
  isSubmitting,
  onJumpToChapter,
  onJumpToWord,
  onToggleCommentForm,
  onSubmitComment,
  onReply,
  onCancelReply
}: ChapterDisplayProps) {
  // State to track which chapters have their comments expanded
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())

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
    <div className="mt-6 space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">Transcript</h3>
      
      {chapters.map((chapter, chapterIndex) => {
        const isActive = chapterIndex === currentChapterIndex
        const chapterTokens = chapterTokensMap.get(chapterIndex) || []
        const chapterComments = comments.filter(c => c.chapterIndex === chapterIndex && !c.parentId)
        const totalCommentCount = countTotalComments(chapterComments)
        
        return (
          <div
            key={chapterIndex}
            id={`chapter-${chapterIndex}`}
            className={`transition-all duration-300 ${
              isActive ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
            } border rounded-lg p-4`}
          >
            {/* Chapter header */}
            <div 
              className="flex items-start gap-3 mb-3 cursor-pointer"
              onClick={() => onJumpToChapter(chapterIndex)}
            >
              <span className={`text-sm font-mono ${
                isActive ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {formatTime(chapter.startTime)}
              </span>
              <h4 className={`font-medium ${
                isActive ? 'text-blue-900' : 'text-gray-700'
              }`}>
                {chapter.title}
              </h4>
            </div>

            {/* Interactive transcript with words and punctuation */}
            <div className="ml-14 mb-4">
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

            {/* Comments section */}
            <div className="ml-14">
              {/* Comment count and toggle button */}
              {totalCommentCount > 0 && (
                <div className="mb-2">
                  <button
                    onClick={() => toggleCommentsExpanded(chapterIndex)}
                    className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 font-medium transition-colors"
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
                </div>
              )}

              {/* Comments expanded section */}
              {expandedComments.has(chapterIndex) && (
                <div className="space-y-3">
                  {/* Comment form at the top */}
                  <div>
                    <button
                      onClick={() => onToggleCommentForm(chapterIndex)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
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

              {/* Show add comment button when collapsed and no comments exist */}
              {!expandedComments.has(chapterIndex) && totalCommentCount === 0 && (
                <div>
                  <button
                    onClick={() => onToggleCommentForm(chapterIndex)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
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
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

