import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { uploadAudioFile } from '@/lib/storage'
import { getFileExtension } from '@/utils/formatters'
import { transcribeAudio, generateChapters } from '@/lib/transcription'

// Increase timeout for transcription (max 300s on Vercel Pro, 60s on Hobby)
export const maxDuration = 60


export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const name = formData.get('name') as string | null
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }
    
    // Validate file size (10MB limit)
    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760')
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }
    
    // Convert file to buffer
    const buffer = Buffer.from(await audioFile.arrayBuffer())
    
    // Generate appropriate filename based on MIME type
    const extension = getFileExtension(audioFile.type)
    const fileName = `recording-${Date.now()}${extension}`
    
    // Upload to storage
    const uploadResult = await uploadAudioFile(
      buffer,
      fileName,
      audioFile.type
    )
    
    // Create recording record in database
    const recording = await prisma.recording.create({
      data: {
        audioUrl: uploadResult.url,
        status: 'pending',
        name: name && name.trim() ? name.trim() : null
      }
    })
    
    // Mark recording as processing
    await prisma.recording.update({
      where: { id: recording.id },
      data: { status: 'processing' }
    })

    // Start transcription in the background (don't await)
    processTranscriptionInBackground(recording.id, uploadResult.url).catch(err => 
      console.error('Background transcription failed:', err)
    )
    
    return NextResponse.json({
      id: recording.id,
      audioUrl: uploadResult.url,
      status: 'processing', // Return processing status immediately
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/playback/${recording.id}`
    })
    
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Background transcription processing
async function processTranscriptionInBackground(recordingId: string, audioUrl: string) {
  try {
    console.log(`Starting transcription for recording ${recordingId}`)
    
    const transcription = await transcribeAudio(audioUrl)
    
    // Generate chapters from the transcript
    const chapters = await generateChapters(
      transcription.fullText,
      transcription.wordTimestamps
    )
    
    // Update recording with transcript and chapters
    await prisma.transcript.create({
      data: {
        recordingId: recordingId,
        fullText: transcription.fullText,
        wordTimestamps: transcription.wordTimestamps as unknown as Prisma.InputJsonValue,
        chapters: chapters.length > 0 ? (chapters as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
      }
    })
    
    // Update recording status
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: 'completed' }
    })
    
    console.log(`Successfully transcribed recording ${recordingId} with ${chapters.length} chapters`)
    
  } catch (error) {
    console.error(`Transcription failed for recording ${recordingId}:`, error)
    
    // Update recording status to failed
    await prisma.recording.update({
      where: { id: recordingId },
      data: { status: 'failed' }
    })
  }
}
