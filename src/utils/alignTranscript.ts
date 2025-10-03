/**
 * Alignment utility for Whisper transcripts
 * 
 * Takes fullText and wordTimestamps from Whisper API and produces
 * a clean array of tokens with punctuation separated for rendering.
 */

export interface AlignedToken {
  text: string
  start?: number
  end?: number
  isPunctuation?: boolean
}

// Import WordTimestamp from audioUtils to ensure consistency
import { WordTimestamp } from './audioUtils'

/**
 * Aligns full text with word timestamps and extracts punctuation.
 * 
 * Whisper returns words WITHOUT punctuation in timestamps, but WITH punctuation in fullText.
 * This function aligns them and extracts punctuation as separate tokens.
 * 
 * @param fullText - The complete transcript text with punctuation
 * @param wordTimestamps - Array of words (without punctuation) with timestamps from Whisper API
 * @returns Array of aligned tokens with separated punctuation
 */
export function getWordsWithPunctuation(
  fullText: string,
  wordTimestamps: WordTimestamp[]
): AlignedToken[] {
  const tokens: AlignedToken[] = []
  
  // Split fullText into words and punctuation
  // Match words (alphanumeric + apostrophes) OR punctuation
  const textTokens = fullText.match(/[\w']+|[.,!?;:"'…\-—]+/g) || []
  
  let timestampIndex = 0
  
  for (const textToken of textTokens) {
    // Check if this is punctuation
    if (/^[.,!?;:"'…\-—]+$/.test(textToken)) {
      // It's punctuation - add without timestamp
      tokens.push({
        text: textToken,
        isPunctuation: true
      })
    } else {
      // It's a word - try to match with timestamp
      if (timestampIndex < wordTimestamps.length) {
        const timestampWord = wordTimestamps[timestampIndex].word.toLowerCase().trim()
        const textWord = textToken.toLowerCase().trim()
        
        // Check if they match (or if timestamp word is contained in text word, or vice versa)
        if (timestampWord === textWord || 
            timestampWord.includes(textWord) || 
            textWord.includes(timestampWord)) {
          tokens.push({
            text: textToken,
            start: wordTimestamps[timestampIndex].startTime,
            end: wordTimestamps[timestampIndex].endTime,
            isPunctuation: false
          })
          timestampIndex++
        } else {
          // Words don't match - add word without timestamp
          tokens.push({
            text: textToken,
            isPunctuation: false
          })
        }
      } else {
        // No more timestamps - add word without timestamp
        tokens.push({
          text: textToken,
          isPunctuation: false
        })
      }
    }
  }
  
  return tokens
}

/**
 * Helper to check if a token is currently being spoken
 * Accounts for browser audio precision differences from Whisper timestamps
 */
export function isCurrentToken(currentTime: number, token: AlignedToken): boolean {
  if (token.isPunctuation || !token.start || !token.end) {
    return false
  }
  
  // Add small epsilon (10ms) to account for browser audio precision limitations
  // Browser currentTime has ~7 decimals, Whisper has more precision
  // This prevents highlighting the previous word when at boundaries
  const EPSILON = 0.01 // 10 milliseconds tolerance
  
  return currentTime >= (token.start - EPSILON) && currentTime < (token.end - EPSILON)
}

