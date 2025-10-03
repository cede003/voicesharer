import type { WordTimestamp, Chapter } from '@/types/audio'

// Re-export types for backward compatibility
export type { WordTimestamp, Chapter } from '@/types/audio'

// Re-export formatTime from shared utilities for backward compatibility
export { formatTime } from './formatters'

/**
 * Creates fallback chapters from full text if no chapters are provided
 * Includes safety checks for empty word timestamps
 */
export const createFallbackChapters = (fullText: string, wordTimestamps: WordTimestamp[]): Chapter[] => {
  if (wordTimestamps.length === 0) {
    return [{
      title: 'Full Transcript',
      sentences: [fullText],
      startTime: 0,
      endTime: 0
    }]
  }

  return [{
    title: 'Full Transcript',
    sentences: [fullText],
    startTime: wordTimestamps[0].startTime,
    endTime: wordTimestamps[wordTimestamps.length - 1].endTime
  }]
}

/**
 * Finds the current chapter index based on current time
 * Returns the index of the chapter where currentTime is between startTime and endTime
 */
export const findCurrentChapterIndex = (currentTime: number, chapters: Chapter[]): number => {
  if (chapters.length === 0) return -1

  // Find the chapter that contains the current time
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    if (currentTime >= chapter.startTime && currentTime <= chapter.endTime) {
      return i
    }
  }

  return -1
}
