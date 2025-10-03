import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteAudioFile } from '@/lib/storage'
import { deleteFromSupabaseStorage } from '@/lib/supabase-storage'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params
    
    // Single optimized query - batch all data at once
    const [recording, reactions] = await Promise.all([
      prisma.recording.findUnique({
        where: { id: recordingId },
        include: {
          transcript: true,
          comments: {
            include: {
              replies: true
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      }),
      prisma.reaction.findMany({
        where: { recordingId }
      })
    ])
    
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      )
    }
    
    // Calculate recording number efficiently
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
    
    const response = NextResponse.json({
      id: recording.id,
      name: recording.name,
      audioUrl: recording.audioUrl,
      status: recording.status,
      createdAt: recording.createdAt,
      playCount: recording.playCount,
      lastPlayedAt: recording.lastPlayedAt,
      transcript: recording.transcript,
      comments: recording.comments,
      reactions: reactions,
      commentCount: recording.comments.length,
      recordingNumber
    })
    
    // Short cache for dynamic content (comments/reactions change frequently)
    // Cache for 5s on CDN, allow browser to cache for 5s
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=5, max-age=5, must-revalidate'
    )
    
    return response
    
  } catch (error) {
    console.error('Error fetching recording:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params
    const body = await request.json()
    const { name } = body

    if (name === undefined) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Update the recording name
    const updatedRecording = await prisma.recording.update({
      where: { id: recordingId },
      data: { name: name || null },
      include: {
        transcript: true,
        comments: true
      }
    })

    // Calculate recording number if no name provided
    let recordingNumber = null
    if (!updatedRecording.name) {
      const allRecordings = await prisma.recording.findMany({
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true }
      })
      recordingNumber = allRecordings.findIndex(r => r.id === recordingId) + 1
    }

    return NextResponse.json({
      id: updatedRecording.id,
      name: updatedRecording.name,
      audioUrl: updatedRecording.audioUrl,
      status: updatedRecording.status,
      createdAt: updatedRecording.createdAt,
      playCount: updatedRecording.playCount,
      lastPlayedAt: updatedRecording.lastPlayedAt,
      transcript: updatedRecording.transcript,
      commentCount: updatedRecording.comments.length,
      recordingNumber
    })
  } catch (error) {
    console.error('Error updating recording:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params
    
    // First, get the recording to access the audioUrl
    const recording = await prisma.recording.findUnique({
      where: { id: recordingId },
      select: {
        id: true,
        audioUrl: true,
        name: true
      }
    })
    
    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      )
    }
    
    // Delete the recording from the database (this will cascade delete comments and transcript)
    await prisma.recording.delete({
      where: { id: recordingId }
    })
    
    // Extract the file key from the audioUrl and delete from storage
    try {
      // Check if it's a Supabase URL or local storage URL
      if (recording.audioUrl.includes('supabase')) {
        // Extract file path from Supabase URL
        const urlParts = recording.audioUrl.split('/')
        const filePath = urlParts[urlParts.length - 1]
        await deleteFromSupabaseStorage(filePath)
      } else {
        // Extract key from local storage URL
        const urlParts = recording.audioUrl.split('/')
        const key = urlParts[urlParts.length - 1]
        await deleteAudioFile(key)
      }
    } catch (storageError) {
      console.error('Error deleting audio file from storage:', storageError)
      // Don't fail the entire operation if storage deletion fails
    }
    
    return NextResponse.json(
      { message: 'Recording deleted successfully' },
      { status: 200 }
    )
    
  } catch (error) {
    console.error('Error deleting recording:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
