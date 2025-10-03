import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const recordings = await prisma.recording.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        transcript: true,
        comments: true
      }
    })
    
    // Calculate recording numbers based on creation order (oldest = #1)
    const totalRecordings = recordings.length
    
    return NextResponse.json({
      recordings: recordings.map((recording, index) => ({
        id: recording.id,
        name: recording.name,
        audioUrl: recording.audioUrl,
        status: recording.status,
        createdAt: recording.createdAt,
        transcript: recording.transcript,
        recordingNumber: totalRecordings - index, // Reverse index so oldest is #1
        analytics: {
          playCount: recording.playCount,
          commentCount: recording.comments.length,
          engagementScore: 0, // Placeholder for future implementation
          lastPlayedAt: recording.lastPlayedAt,
          shareCount: 0 // Placeholder for future implementation
        }
      }))
    })
    
  } catch (error) {
    console.error('Error fetching recordings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

