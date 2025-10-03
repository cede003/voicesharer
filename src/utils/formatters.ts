/**
 * Shared formatting utilities
 */

/**
 * Formats time in seconds to MM:SS format
 */
export const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60)
  const seconds = Math.floor(time % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Get file extension from MIME type
 */
export const getFileExtension = (mimeType: string): string => {
  const extensions: Record<string, string> = {
    'audio/webm': '.webm',
    'audio/mp4': '.m4a',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3'
  }
  return extensions[mimeType] || '.webm'
}

