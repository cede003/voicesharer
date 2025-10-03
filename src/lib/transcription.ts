import OpenAI, { toFile } from 'openai'
import fs from 'fs'
import path from 'path'
import os from 'os'

/**
 * OpenAI Whisper API integration for audio transcription
 */

export interface WordTimestamp {
  word: string
  startTime: number // in seconds
  endTime: number   // in seconds
}

export interface Chapter {
  title: string
  sentences: string[]
  startTime: number
  endTime: number
}

export interface TranscriptionResult {
  fullText: string
  wordTimestamps: WordTimestamp[]
  chapters?: Chapter[]
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

/**
 * Downloads a file from a URL to a temporary location
 */
async function downloadFile(url: string, tempPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`)
  }
  
  const buffer = await response.arrayBuffer()
  fs.writeFileSync(tempPath, Buffer.from(buffer))
}

/**
 * Transcribe audio using OpenAI Whisper API with word-level timestamps
 */
export async function transcribeAudio(audioUrl: string): Promise<TranscriptionResult> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, using mock transcription')
    return mockTranscription()
  }

  let tempFilePath: string | null = null

  try {
    // Use OS temp directory (works in serverless environments like Lambda)
    const tempDir = os.tmpdir()
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Download the audio file to a temporary location
    const fileName = `temp-${Date.now()}.${audioUrl.split('.').pop()}`
    tempFilePath = path.join(tempDir, fileName)
    
    console.log(`Downloading audio from ${audioUrl}...`)
    await downloadFile(audioUrl, tempFilePath)

    console.log('Transcribing with OpenAI Whisper API...')
    console.log('File path:', tempFilePath)
    const fileStats = fs.statSync(tempFilePath)
    console.log('File size:', fileStats.size, 'bytes')
    
    // Verify file is not empty
    if (fileStats.size === 0) {
      throw new Error('Downloaded audio file is empty')
    }
    
    // Use OpenAI's toFile helper for proper file upload
    const audioFile = await toFile(fs.createReadStream(tempFilePath), fileName)
    
    // Call OpenAI Whisper API with word-level timestamps
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    })

    // Extract word-level timestamps
    const wordTimestamps: WordTimestamp[] = []
    
    if (transcription.words) {
      transcription.words.forEach((wordData: { word: string; start: number; end: number }) => {
        wordTimestamps.push({
          word: wordData.word.trim(),
          startTime: wordData.start,
          endTime: wordData.end
        })
      })
    }

    console.log(`Transcription completed: ${transcription.text}`)
    console.log(`Word count: ${wordTimestamps.length}`)

    return {
      fullText: transcription.text,
      wordTimestamps
    }
    
  } catch (error) {
    console.error('Transcription error:', error)
    throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
      console.log('Temporary file cleaned up')
    }
  }
}

/**
 * Build prompt for chapter generation
 */
function buildChapterPrompt(transcriptText: string, wordTimestamps: WordTimestamp[]): string {
  return `You are an AI assistant that breaks transcripts into logical chapters.

Instructions:
1. Break the transcript into individual sentences, preserving ALL punctuation and capitalization exactly as they appear.
2. Group sentences into coherent "voice moments" or chapters based on topic or theme.
3. Create 5-15 chapters depending on content length and natural breaks.

Return the output as a JSON array of chapters in the following format:

[
  {
    "title": "Short Descriptive Chapter Title",
    "sentences": [
      "First sentence of chapter.",
      "Second sentence of chapter.",
      ...
    ]
  },
  ...
]

Transcript:
${transcriptText}

Return ONLY the JSON array, no additional text or explanation.`
}

/**
 * Call OpenAI API to generate chapters
 */
async function callOpenAIForChapters(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that structures transcripts into logical chapters. Always respond with valid JSON only.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3,
    response_format: { type: "json_object" }
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }
  
  return content
}

/**
 * Parse OpenAI response into chapter data
 */
function parseChapterResponse(content: string): Array<{
  title: string
  sentences: string[]
  startWordIndex?: number
  endWordIndex?: number
}> {
  try {
    const parsed = JSON.parse(content)
    // Handle both array and object with chapters key
    return Array.isArray(parsed) ? parsed : (parsed.chapters || [])
  } catch {
    console.error('Failed to parse OpenAI response:', content)
    throw new Error('Invalid JSON response from OpenAI')
  }
}

/**
 * Add timestamps to chapter data using sequential word matching
 * This ensures chapters don't overlap by processing them in order
 */
function addTimestampsToChapters(
  chaptersData: Array<{
    title: string
    sentences: string[]
    startWordIndex?: number
    endWordIndex?: number
  }>,
  wordTimestamps: WordTimestamp[],
  wordIndex: Map<string, number[]>
): Chapter[] {
  const chapters: Chapter[] = []
  let searchStartIndex = 0
  
  for (const chapter of chaptersData) {
    // Match words sequentially from where the last chapter ended
    const timestamps = findChapterTimestamps(
      chapter.sentences, 
      wordIndex, 
      wordTimestamps, 
      searchStartIndex
    )
    
    // Update search position for next chapter
    searchStartIndex = timestamps.endIndex
    
    chapters.push({
      title: chapter.title,
      sentences: chapter.sentences,
      startTime: timestamps.startTime,
      endTime: timestamps.endTime
    })
  }
  
  return chapters
}

/**
 * Generate chapters from transcript using OpenAI with word timestamps
 */
export async function generateChapters(
  transcriptText: string,
  wordTimestamps: WordTimestamp[]
): Promise<Chapter[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, skipping chapter generation')
    return []
  }

  try {
    
    // Create word index for efficient lookups
    const wordIndex = createWordIndex(wordTimestamps)
    
    // Build prompt with word timestamps
    const prompt = buildChapterPrompt(transcriptText, wordTimestamps)
    
    // Call OpenAI API
    const content = await callOpenAIForChapters(prompt)
    
    // Parse response into chapter data
    const chaptersData = parseChapterResponse(content)
    
    // Add timestamps to chapters
    const chapters = addTimestampsToChapters(chaptersData, wordTimestamps, wordIndex)

    return chapters
    
  } catch (error) {
    console.error('Chapter generation error:', error)
    // Don't fail the entire transcription process if chapter generation fails
    return []
  }
}

/**
 * Create a word index map for efficient lookups
 */
function createWordIndex(wordTimestamps: WordTimestamp[]): Map<string, number[]> {
  const index = new Map<string, number[]>()
  
  wordTimestamps.forEach((wordData, i) => {
    const word = wordData.word.toLowerCase().replace(/[.,!?;:]/g, '')
    if (!index.has(word)) {
      index.set(word, [])
    }
    index.get(word)!.push(i)
  })
  
  return index
}

/**
 * Find chapter timestamps by matching words sequentially
 * This ensures chapters don't overlap by tracking position in transcript
 */
function findChapterTimestamps(
  sentences: string[],
  wordIndex: Map<string, number[]>,
  wordTimestamps: WordTimestamp[],
  searchStartIndex: number = 0
): { startTime: number; endTime: number; endIndex: number } {
  let startTime = 0
  let endTime = 0
  let startIndex = searchStartIndex
  let endIndex = searchStartIndex
  
  if (sentences.length === 0 || wordTimestamps.length === 0) {
    return { startTime, endTime, endIndex: searchStartIndex }
  }
  
  // Get all words from all sentences in this chapter
  const chapterText = sentences.join(' ')
  const chapterWords = chapterText.toLowerCase().split(/\s+/).filter(w => w.length > 0)
  
  // Try to match the first few words to find start position
  let foundStart = false
  const WORDS_TO_MATCH = Math.min(5, chapterWords.length)
  
  for (let i = searchStartIndex; i < wordTimestamps.length - WORDS_TO_MATCH; i++) {
    let matched = 0
    for (let j = 0; j < WORDS_TO_MATCH; j++) {
      const transcriptWord = wordTimestamps[i + j].word.toLowerCase().replace(/[.,!?;:]/g, '')
      const chapterWord = chapterWords[j].replace(/[.,!?;:]/g, '')
      
      if (transcriptWord === chapterWord) {
        matched++
      } else {
        break
      }
    }
    
    // If we matched at least 3 words, we found the start
    if (matched >= Math.min(3, WORDS_TO_MATCH)) {
      startIndex = i
      startTime = wordTimestamps[i].startTime
      foundStart = true
      break
    }
  }
  
  if (!foundStart) {
    // Fallback: start from search position
    startTime = wordTimestamps[searchStartIndex]?.startTime || 0
    startIndex = searchStartIndex
  }
  
  // Now find the end by matching forward from start
  endIndex = startIndex
  let wordIdx = 0
  
  for (let i = startIndex; i < wordTimestamps.length && wordIdx < chapterWords.length; i++) {
    const transcriptWord = wordTimestamps[i].word.toLowerCase().replace(/[.,!?;:]/g, '')
    const chapterWord = chapterWords[wordIdx].replace(/[.,!?;:]/g, '')
    
    if (transcriptWord === chapterWord) {
      endIndex = i
      endTime = wordTimestamps[i].endTime
      wordIdx++
    }
  }
  
  return { startTime, endTime, endIndex: endIndex + 1 }
}

/**
 * Mock transcription function for testing without API key
 */
function mockTranscription(): TranscriptionResult {
  const mockTranscript = "Hello, this is a sample audio memo. I'm testing the transcription feature of our voice sharing application. This is just placeholder text for now, but in production this would be generated by OpenAI's Whisper API."
  
  const words = mockTranscript.split(' ')
  const wordTimestamps: WordTimestamp[] = []
  
  let currentTime = 0
  const averageWordDuration = 0.5
  
  words.forEach((word) => {
    const startTime = currentTime
    const endTime = currentTime + averageWordDuration + Math.random() * 0.3
    
    wordTimestamps.push({
      word: word.replace(/[.,!?]/g, ''),
      startTime,
      endTime
    })
    
    currentTime = endTime + 0.1
  })
  
  return {
    fullText: mockTranscript,
    wordTimestamps
  }
}
