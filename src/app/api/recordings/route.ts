import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    
    // Optimized query with selective fields and aggregations
    const recordings = await prisma.recording.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        audioUrl: true,
        status: true,
        createdAt: true,
        playCount: true,
        lastPlayedAt: true,
        transcript: {
          select: {
            fullText: true
            // Exclude heavy wordTimestamps and chapters
          }
        },
        _count: {
          select: {
            comments: true
          }
        }
      }
    })
    
    // Get reaction counts separately (reactions aren't a direct relation)
    const reactionCounts = await prisma.reaction.groupBy({
      by: ['recordingId'],
      _count: { id: true }
    })
    const reactionCountMap = new Map(
      reactionCounts.map(r => [r.recordingId, r._count.id])
    )
    
    // Calculate recording numbers efficiently
    const recordingsWithNumbers = await Promise.all(
      recordings.map(async (recording) => {
        let recordingNumber = null
        if (!recording.name) {
          const count = await prisma.recording.count({
            where: {
              createdAt: {
                lte: recording.createdAt
              }
            }
          })
          recordingNumber = count
        }
        
        return {
          id: recording.id,
          name: recording.name,
          audioUrl: recording.audioUrl,
          status: recording.status,
          createdAt: recording.createdAt,
          transcript: recording.transcript,
          recordingNumber,
          analytics: {
            playCount: recording.playCount,
            commentCount: recording._count.comments,
            reactionCount: reactionCountMap.get(recording.id) || 0,
            engagementScore: 0,
            lastPlayedAt: recording.lastPlayedAt,
            shareCount: 0
          }
        }
      })
    )
    
    const response = NextResponse.json({
      recordings: recordingsWithNumbers
    })
    
    // Cache for 30 seconds with stale-while-revalidate
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=60'
    )
    
    return response
    
  } catch (error) {
    console.error('Error fetching recordings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

