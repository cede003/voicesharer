import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST to track when audio starts playing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params
    
    // Verify recording exists
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId }
    })
    
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      )
    }
    
    // Increment play count and update last played timestamp
    const updatedRecording = await prisma.recording.update({
      where: { id: recordingId },
      data: {
        playCount: { increment: 1 },
        lastPlayedAt: new Date()
      },
      select: {
        playCount: true,
        lastPlayedAt: true
      }
    })
    
    return NextResponse.json({
      success: true,
      playCount: updatedRecording.playCount,
      lastPlayedAt: updatedRecording.lastPlayedAt
    })
    
  } catch (error) {
    console.error('[Play Tracking] Error updating play count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

