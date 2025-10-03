import { RefObject } from 'react'
import { Comment } from './comment'

// Core audio data structures
export interface WordTimestamp {
  word: string
  startTime: number
  endTime: number
}

export interface Chapter {
  title: string
  sentences: string[]
  startTime: number
  endTime: number
  startWordIndex?: number
  endWordIndex?: number
}

export interface Transcript {
  fullText: string
  wordTimestamps: WordTimestamp[]
  chapters?: Chapter[]
}

// Component props interfaces
export interface AudioPlayerProps {
  audioUrl: string
  transcript: Transcript
  comments: Comment[]
  onAddComment: (userName: string, text: string, timestamp: number | null, chapterIndex: number | null, parentId?: string) => Promise<void>
  onPlay?: () => void
}

export interface AudioControlsProps {
  audioUrl: string
  isPlaying: boolean
  currentTime: number
  duration: number
  onTogglePlayPause: () => void
  onSeek: (time: number) => void
  onTimeUpdate: (time: number) => void
  onLoadedMetadata: (duration: number) => void
  onEnded: () => void
  onPlay?: () => void
  audioRef: RefObject<HTMLAudioElement | null>
}

export interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void
  onError: (error: string) => void
  onRecordingStart?: () => void
  recordingName?: string
  onRecordingNameChange?: (name: string) => void
  isUploading?: boolean
}

export interface ChapterDisplayProps {
  chapters: Chapter[]
  wordTimestamps: WordTimestamp[]
  currentTime: number
  currentChapterIndex: number
  comments: Comment[]
  showCommentForm: number | null
  replyToComment: string | null
  isSubmitting: boolean
  onJumpToChapter: (chapterIndex: number) => void
  onJumpToWord: (startTime: number) => void
  onToggleCommentForm: (chapterIndex: number) => void
  onSubmitComment: (userName: string, text: string, chapterIndex: number, parentId?: string) => Promise<void>
  onReply: (commentId: string, chapterIndex: number) => void
  onCancelReply: () => void
}

