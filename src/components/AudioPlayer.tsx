'use client'

import { useState, useRef, useMemo } from 'react'
import { createFallbackChapters, findCurrentChapterIndex } from '@/utils/audioUtils'
import AudioControls from './AudioControls'
import ChapterDisplay from './ChapterDisplay'
import { AudioPlayerProps } from '@/types/audio'

export default function AudioPlayer({ audioUrl, transcript, comments, reactions, onAddComment, onAddReaction, onPlay, onEnded, failed, processing }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1)
  const [showCommentForm, setShowCommentForm] = useState<number | null>(null)
  const [replyToComment, setReplyToComment] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const transcriptRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Use chapters if available, otherwise fallback to creating simple chapters
  const chapters = useMemo(() => {
    if (failed || !transcript) return []
    if (transcript.chapters && transcript.chapters.length > 0) {
      return transcript.chapters
    }
    // Fallback: create a single chapter from full text if no chapters
    return createFallbackChapters(transcript.fullText, transcript.wordTimestamps)
  }, [failed, transcript])

  // Handle time updates and chapter detection
  const handleTimeUpdate = (newCurrentTime: number) => {
    setCurrentTime(newCurrentTime)
    
    // Find the current chapter based on timestamp
    const chapterIndex = findCurrentChapterIndex(newCurrentTime, chapters)
    
    if (chapterIndex !== -1 && chapterIndex !== currentChapterIndex) {
      setCurrentChapterIndex(chapterIndex)
      
      // Scroll to the current chapter
      const chapterElement = document.getElementById(`chapter-${chapterIndex}`)
      if (chapterElement && transcriptRef.current) {
        chapterElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }
  }

  const handleTogglePlayPause = () => {
    setIsPlaying(prev => !prev)
  }

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime)
  }

  const handleLoadedMetadata = (newDuration: number) => {
    setDuration(newDuration)
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setCurrentTime(0)
    setCurrentChapterIndex(-1)
    
    // Call the parent's onEnded callback if provided
    if (onEnded) {
      onEnded()
    }
  }

  const jumpToChapter = (chapterIndex: number) => {
    if (!chapters[chapterIndex]) return

    const targetTime = chapters[chapterIndex].startTime
    
    // Seek the audio element - let the timeUpdate event handle setCurrentTime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (audioRef.current && (audioRef.current as any).seekAudio) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (audioRef.current as any).seekAudio(targetTime)
    }
  }

  const jumpToWord = (startTime: number) => {
    // Validate the timestamp
    if (isNaN(startTime) || startTime < 0 || startTime > duration) {
      console.warn('Invalid timestamp for word jump:', startTime)
      return
    }
    
    // Seek the audio element - let the timeUpdate event handle setCurrentTime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (audioRef.current && (audioRef.current as any).seekAudio) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (audioRef.current as any).seekAudio(startTime)
    }
  }

  const handleSubmitComment = async (userName: string, text: string, chapterIndex: number, parentId?: string) => {
    setIsSubmitting(true)
    try {
      const timestamp = chapters[chapterIndex]?.startTime || null
      const chapterIdx = chapterIndex
      await onAddComment(
        userName,
        text,
        timestamp,
        chapterIdx,
        parentId
      )
      
      setShowCommentForm(null)
      setReplyToComment(null)
    } catch (error) {
      console.error('Error submitting comment:', error)
      alert('Failed to submit comment')
      throw error // Re-throw to let CommentForm handle the error state
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReply = (commentId: string, chapterIndex: number) => {
    setReplyToComment(commentId)
    setShowCommentForm(chapterIndex)
  }

  const handleCancelReply = () => {
    setReplyToComment(null)
  }

  const handleToggleCommentForm = (chapterIndex: number) => {
    setShowCommentForm(showCommentForm === chapterIndex ? null : chapterIndex)
    setReplyToComment(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      {/* Audio Player Controls */}
      <AudioControls
        audioUrl={audioUrl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlayPause={handleTogglePlayPause}
        onSeek={handleSeek}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={onPlay}
        audioRef={audioRef}
      />

      {/* Show error message if transcription failed */}
      {failed ? (
        <div className="mt-6 bg-red-100 text-red-800 px-6 py-4 rounded-lg text-center">
          <h3 className="text-lg font-semibold mb-2">
            Transcription Failed
          </h3>
          <p>
            We encountered an error while transcribing your recording. 
            You can still listen to the audio above.
          </p>
        </div>
      ) : processing ? (
        /* Show processing message if transcription is in progress */
        <div className="mt-6 bg-yellow-50 border border-yellow-200 px-6 py-4 rounded-lg">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
            <div className="text-left">
              <p className="text-sm font-semibold text-yellow-800">
                Transcription in progress
              </p>
              <p className="text-xs text-yellow-600">
                You can listen to the audio while we process the transcript
              </p>
            </div>
          </div>
        </div>
      ) : transcript ? (
        /* Transcript - Chapter-based display with inline comments */
        <div ref={transcriptRef}>
          <ChapterDisplay
            chapters={chapters}
            wordTimestamps={transcript.wordTimestamps}
            currentTime={currentTime}
            currentChapterIndex={currentChapterIndex}
            comments={comments}
            reactions={reactions}
            showCommentForm={showCommentForm}
            replyToComment={replyToComment}
            isSubmitting={isSubmitting}
            onJumpToChapter={jumpToChapter}
            onJumpToWord={jumpToWord}
            onToggleCommentForm={handleToggleCommentForm}
            onSubmitComment={handleSubmitComment}
            onReply={handleReply}
            onCancelReply={handleCancelReply}
            onAddReaction={onAddReaction}
          />
        </div>
      ) : null}
    </div>
  )
}