import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Lightweight endpoint for fast status checks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params
    
    // Minimal query - only fetch status
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        status: true
      }
    })
    
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      )
    }
    
    // No caching for status checks - always fresh
    return new Response(
      JSON.stringify({ status: recording.status }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    )
    
  } catch (error) {
    console.error('Error fetching recording status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

