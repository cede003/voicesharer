import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'
import { transcribeAudio, generateChapters } from '@/lib/transcription'

// Increase timeout for transcription (max 60s on Vercel Hobby, 300s on Pro)
export const maxDuration = 60

// This endpoint can be called by Vercel Cron Jobs or external services
// to process pending transcriptions
export async function POST(request: NextRequest) {
  try {
    // Get all recordings with 'processing' status that don't have transcripts
    const pendingRecordings = await prisma.recording.findMany({
      where: {
        status: 'processing',
        transcript: null
      },
      select: {
        id: true,
        audioUrl: true,
        name: true
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 5 // Process up to 5 recordings at a time
    })

    if (pendingRecordings.length === 0) {
      return NextResponse.json({
        message: 'No pending transcriptions to process',
        processed: 0
      })
    }

    const results = []
    
    for (const recording of pendingRecordings) {
      try {
        console.log(`Processing transcription for recording ${recording.id}`)
        
        const transcription = await transcribeAudio(recording.audioUrl)
        
        // Generate chapters from the transcript
        const chapters = await generateChapters(
          transcription.fullText,
          transcription.wordTimestamps
        )
        
        // Update recording with transcript and chapters
        await prisma.transcript.create({
          data: {
            recordingId: recording.id,
            fullText: transcription.fullText,
            wordTimestamps: transcription.wordTimestamps as unknown as Prisma.InputJsonValue,
            chapters: chapters.length > 0 ? (chapters as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
          }
        })
        
        // Update recording status
        await prisma.recording.update({
          where: { id: recording.id },
          data: { status: 'completed' }
        })
        
        console.log(`Successfully transcribed recording ${recording.id} with ${chapters.length} chapters`)
        
        results.push({
          recordingId: recording.id,
          status: 'completed',
          chaptersCount: chapters.length
        })
        
      } catch (error) {
        console.error(`Transcription failed for recording ${recording.id}:`, error)
        
        // Update recording status to failed
        await prisma.recording.update({
          where: { id: recording.id },
          data: { status: 'failed' }
        })
        
        results.push({
          recordingId: recording.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      message: `Processed ${results.length} recordings`,
      processed: results.length,
      results
    })
    
  } catch (error) {
    console.error('Transcription processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check status of pending transcriptions
export async function GET() {
  try {
    const pendingCount = await prisma.recording.count({
      where: {
        status: 'processing',
        transcript: null
      }
    })
    
    const failedCount = await prisma.recording.count({
      where: {
        status: 'failed'
      }
    })
    
    return NextResponse.json({
      pendingTranscriptions: pendingCount,
      failedTranscriptions: failedCount,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error checking transcription status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
