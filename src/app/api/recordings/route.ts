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
    
    // Get reaction counts for all recordings
    const reactionCounts = await prisma.reaction.groupBy({
      by: ['recordingId'],
      _count: {
        id: true
      }
    })
    
    // Create a map of recordingId -> reaction count
    const reactionCountMap = new Map(
      reactionCounts.map(r => [r.recordingId, r._count.id])
    )
    
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
          reactionCount: reactionCountMap.get(recording.id) || 0,
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

