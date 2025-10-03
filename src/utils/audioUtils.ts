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
 * Handles edge cases for last chapter and empty chapters
 * Includes epsilon tolerance for browser audio precision
 */
export const findCurrentChapterIndex = (currentTime: number, chapters: Chapter[]): number => {
  if (chapters.length === 0) return -1

  // Add small epsilon (10ms) to account for browser audio precision limitations
  // Browser currentTime has ~7 decimals, which may not match exact chapter boundaries
  // This prevents missing the chapter highlight when seeking to exact startTime
  const EPSILON = 0.01 // 10 milliseconds tolerance

  return chapters.findIndex((chapter, idx) => {
    const isLastChapter = idx === chapters.length - 1
    if (isLastChapter) {
      // Last chapter: include the end boundary
      return currentTime >= (chapter.startTime - EPSILON) && currentTime <= (chapter.endTime + EPSILON)
    } else {
      // Other chapters: exclude the end boundary to avoid overlap with next chapter
      return currentTime >= (chapter.startTime - EPSILON) && currentTime < (chapter.endTime - EPSILON)
    }
  })
}
