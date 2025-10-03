import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'

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
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Download the audio file to a temporary location
    const fileName = `temp-${Date.now()}.${audioUrl.split('.').pop()}`
    tempFilePath = path.join(tempDir, fileName)
    
    console.log(`Downloading audio from ${audioUrl}...`)
    await downloadFile(audioUrl, tempFilePath)

    console.log('Transcribing with OpenAI Whisper API...')
    
    // Create a read stream from the file
    const fileStream = fs.createReadStream(tempFilePath)
    
    // Call OpenAI Whisper API with word-level timestamps
    const transcription = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    })

    // Extract word-level timestamps
    const wordTimestamps: WordTimestamp[] = []
    
    if (transcription.words) {
      transcription.words.forEach((wordData: any) => {
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
  // Limit word list to prevent token limit issues
  // ~5000 words ≈ 40K tokens (safe for 128K limit with room for response)
  const MAX_WORDS = 5000
  const limitedTimestamps = wordTimestamps.slice(0, MAX_WORDS)
  
  if (wordTimestamps.length > MAX_WORDS) {
    const durationCovered = limitedTimestamps[limitedTimestamps.length - 1]?.endTime || 0
    console.warn(
      `Transcript is long (${wordTimestamps.length} words). ` +
      `Using first ${MAX_WORDS} words (~${Math.floor(durationCovered / 60)} minutes) for chapter generation.`
    )
  }
  
  const wordTimestampInfo = limitedTimestamps.map((w, i) => 
    `${i}: "${w.word}" (${w.startTime.toFixed(2)}s-${w.endTime.toFixed(2)}s)`
  ).join('\n')
  
  return `You are an AI assistant that breaks transcripts into chapters with precise timing.

Instructions:
1. Break the transcript into individual sentences, preserving ALL punctuation and capitalization exactly as they appear.
2. Group sentences into coherent "voice moments" or chapters based on topic or theme.
3. For each chapter, provide the start and end word indices from the word list below.
4. Word indices correspond to the position in the word list (0-based).

Word list with timestamps:
${wordTimestampInfo}

Return the output as a JSON array of chapters in the following format:

[
  {
    "title": "Chapter Title",
    "sentences": [
      "First sentence.",
      "Second sentence.",
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
  } catch (e) {
    console.error('Failed to parse OpenAI response:', content)
    throw new Error('Invalid JSON response from OpenAI')
  }
}

/**
 * Add timestamps to chapter data using word indices or fallback matching
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
  return chaptersData.map(chapter => {
    let startTime = 0
    let endTime = 0
    
    // Use word indices if provided by LLM (more accurate)
    if (typeof chapter.startWordIndex === 'number' && typeof chapter.endWordIndex === 'number') {
      const startWord = wordTimestamps[chapter.startWordIndex]
      const endWord = wordTimestamps[chapter.endWordIndex]
      
      if (startWord) startTime = startWord.startTime
      if (endWord) endTime = endWord.endTime
    } else {
      // Fallback to improved word matching algorithm
      const timestamps = findChapterTimestamps(chapter.sentences, wordIndex, wordTimestamps)
      startTime = timestamps.startTime
      endTime = timestamps.endTime
    }
    
    return {
      title: chapter.title,
      sentences: chapter.sentences,
      startTime,
      endTime,
      startWordIndex: chapter.startWordIndex,
      endWordIndex: chapter.endWordIndex
    }
  })
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
    console.log('Generating chapters using OpenAI...')
    
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

    console.log(`Generated ${chapters.length} chapters`)
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
 * Find chapter timestamps using improved word matching algorithm
 */
function findChapterTimestamps(
  sentences: string[],
  wordIndex: Map<string, number[]>,
  wordTimestamps: WordTimestamp[]
): { startTime: number; endTime: number } {
  let startTime = 0
  let endTime = 0
  
  if (sentences.length === 0) {
    return { startTime, endTime }
  }
  
  // Find start time using first sentence
  const firstSentence = sentences[0].toLowerCase()
  const firstWords = firstSentence.split(/\s+/).filter(w => w.length > 0)
  
  for (const word of firstWords) {
    const cleanWord = word.replace(/[.,!?;:]/g, '')
    const positions = wordIndex.get(cleanWord)
    if (positions && positions.length > 0) {
      startTime = wordTimestamps[positions[0]].startTime
      break
    }
  }
  
  // Find end time using last sentence
  const lastSentence = sentences[sentences.length - 1].toLowerCase()
  const lastWords = lastSentence.split(/\s+/).filter(w => w.length > 0)
  
  for (let i = lastWords.length - 1; i >= 0; i--) {
    const word = lastWords[i]
    const cleanWord = word.replace(/[.,!?;:]/g, '')
    const positions = wordIndex.get(cleanWord)
    if (positions && positions.length > 0) {
      // Use the last occurrence of this word
      const lastPosition = positions[positions.length - 1]
      endTime = wordTimestamps[lastPosition].endTime
      break
    }
  }
  
  // Fallback: if we didn't find timestamps, estimate based on position
  if (endTime === 0 && wordTimestamps.length > 0) {
    endTime = wordTimestamps[wordTimestamps.length - 1].endTime
  }
  
  return { startTime, endTime }
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
