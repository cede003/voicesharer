'use client'

import { useMemo, useState, useRef } from 'react'
import { diffWords } from 'diff'
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
    
    return tokens
  }, [chapters, wordTimestamps])

  // Utility: Normalize words for matching (lowercase, no punctuation)
  const normalize = (word: string): string => {
    return word.toLowerCase().replace(/[.,?!;:"'()-]/g, '').trim()
  }

  // Utility: Tokenize text into words and separate punctuation
  const tokenize = (text: string): Array<{ text: string; isPunctuation: boolean }> => {
    const tokens: Array<{ text: string; isPunctuation: boolean }> = []
    const parts = text.match(/\S+/g) || []
    
    for (const part of parts) {
      const normalized = normalize(part)
      if (normalized === '') {
        // Pure punctuation
        tokens.push({ text: part, isPunctuation: true })
      } else if (normalized === part.toLowerCase()) {
        // Just a word
        tokens.push({ text: part, isPunctuation: false })
      } else {
        // Word with punctuation - separate them
        // Extract leading punctuation
        const leadMatch = part.match(/^[.,?!;:"'()-]+/)
        if (leadMatch) {
          tokens.push({ text: leadMatch[0], isPunctuation: true })
        }
        
        // Extract the word
        const wordMatch = part.match(/[a-zA-Z0-9']+/)
        if (wordMatch) {
          tokens.push({ text: wordMatch[0], isPunctuation: false })
        }
        
        // Extract trailing punctuation
        const trailMatch = part.match(/[.,?!;:"'()-]+$/)
        if (trailMatch && trailMatch.index && trailMatch.index > 0) {
          tokens.push({ text: trailMatch[0], isPunctuation: true })
        }
      }
    }
    
    return tokens
  }

  // Pre-compute all chapter tokens once (performance optimization)
  const chapterTokensMap = useMemo(() => {
    const map = new Map<number, AlignedToken[]>()
    
    chapters.forEach((chapter, chapterIndex) => {
      const chapterText = chapter.sentences.join(' ')
      
      // Tokenize chapter text
      const chapterTokens = tokenize(chapterText)
      
      if (chapterTokens.length === 0) {
        map.set(chapterIndex, [])
        return
      }
      
      const chapterStartTime = chapter.startTime
      const chapterEndTime = chapter.endTime
      
      // Filter wordTimestamps to the chapter's time range (with buffer)
      const relevantTimestamps = wordTimestamps.filter(wt => 
        wt.startTime >= chapterStartTime - 2 && 
        wt.startTime <= chapterEndTime + 2
      )
      
      // Create normalized word sequences for diff
      const chapterWords = chapterTokens.filter(t => !t.isPunctuation).map(t => normalize(t.text))
      const whisperWords = relevantTimestamps.map(wt => normalize(wt.word))
      
      // Use diff library to align the sequences
      const chapterWordString = chapterWords.join(' ')
      const whisperWordString = whisperWords.join(' ')
      const diff = diffWords(chapterWordString, whisperWordString)
      
      // Build a mapping from chapter words to whisper timestamps
      const wordTimestampMap = new Map<number, { start: number; end: number }>()
      let chapterWordIdx = 0
      let whisperWordIdx = 0
      
      for (const part of diff) {
        const wordCount = part.value.split(/\s+/).filter(w => w.length > 0).length
        
        if (!part.added && !part.removed) {
          // Words match - map timestamps
          for (let i = 0; i < wordCount; i++) {
            if (whisperWordIdx + i < relevantTimestamps.length) {
              wordTimestampMap.set(chapterWordIdx + i, {
                start: relevantTimestamps[whisperWordIdx + i].startTime,
                end: relevantTimestamps[whisperWordIdx + i].endTime
              })
            }
          }
          chapterWordIdx += wordCount
          whisperWordIdx += wordCount
        } else if (part.removed) {
          // Chapter has extra words that Whisper doesn't (skip without timestamps)
          chapterWordIdx += wordCount
        } else if (part.added) {
          // Whisper has extra words that chapter doesn't (skip these Whisper words)
          whisperWordIdx += wordCount
        }
      }
      
      // Build final token array with timestamps
      const result: AlignedToken[] = []
      let wordCounter = 0
      
      for (const token of chapterTokens) {
        if (token.isPunctuation) {
          result.push({
            text: token.text,
            isPunctuation: true
          })
        } else {
          const timing = wordTimestampMap.get(wordCounter)
          if (timing) {
            result.push({
              text: token.text,
              start: timing.start,
              end: timing.end,
              isPunctuation: false
            })
          } else {
            result.push({
              text: token.text,
              isPunctuation: false
            })
          }
          wordCounter++
        }
      }
      
      // Second pass: interpolate timestamps for unmatched words
      for (let i = 0; i < result.length; i++) {
        const token = result[i]
        if (!token.isPunctuation && token.start === undefined) {
          let prevTime: number | undefined
          let nextTime: number | undefined
          
          for (let j = i - 1; j >= 0; j--) {
            if (!result[j].isPunctuation && result[j].end !== undefined) {
              prevTime = result[j].end
              break
            }
          }
          
          for (let j = i + 1; j < result.length; j++) {
            if (!result[j].isPunctuation && result[j].start !== undefined) {
              nextTime = result[j].start
              break
            }
          }
          
          if (prevTime !== undefined && nextTime !== undefined) {
            const avgWordDuration = Math.min((nextTime - prevTime) / 2, 0.5)
            token.start = prevTime + 0.05
            token.end = token.start + avgWordDuration
          } else if (prevTime !== undefined) {
            token.start = prevTime + 0.05
            token.end = token.start + 0.5
          } else if (nextTime !== undefined) {
            token.start = Math.max(0, nextTime - 0.55)
            token.end = nextTime - 0.05
          }
        }
      }
      
      map.set(chapterIndex, result)
    })
    
    return map
  }, [chapters, wordTimestamps])

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
                    // Render word (clickable and highlightable if it has timing)
                    const hasTimestamp = token.start !== undefined
                    const isCurrentWord = hasTimestamp && isCurrentToken(currentTime, token)
                    
                    return (
                      <span key={tokenIndex}>
                        <span
                          className={`transition-all duration-200 ${
                            hasTimestamp 
                              ? 'cursor-pointer ' + (isCurrentWord
                                  ? 'bg-blue-200 text-blue-900 font-semibold px-1 rounded'
                                  : 'hover:bg-gray-200 hover:px-1 hover:rounded')
                              : 'text-gray-500 cursor-default'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (hasTimestamp) {
                              onJumpToWord(token.start!, chapterIndex)
                            }
                          }}
                          title={hasTimestamp ? 'Click to jump to this word' : 'No timing available for this word'}
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

