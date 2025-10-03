import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET comments for a recording
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params
    
    console.log('[Comments API] Fetching comments for recording:', recordingId)
    
    // Fetch all comments with their replies
    const comments = await prisma.comment.findMany({
      where: { 
        recordingId,
        parentId: null // Only get top-level comments
      },
      include: {
        replies: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    // Sort manually to handle nullable timestamp
    const sortedComments = comments.sort((a, b) => {
      if (a.timestamp !== null && b.timestamp !== null) {
        return a.timestamp - b.timestamp
      }
      if (a.timestamp !== null) return -1
      if (b.timestamp !== null) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    
    console.log('[Comments API] Found', sortedComments.length, 'comments')
    
    return NextResponse.json({ comments: sortedComments })
    
  } catch (error) {
    console.error('[Comments API] Error fetching comments:', error)
    console.error('[Comments API] Error details:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// POST a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params
    const body = await request.json()
    const { userName, text, timestamp, chapterIndex, parentId } = body
    
    console.log('[Comments API] Creating comment for recording:', recordingId)
    console.log('[Comments API] Request body:', { userName, text, timestamp, chapterIndex, parentId })
    
    // Validation
    if (!userName || !text) {
      return NextResponse.json(
        { error: 'userName and text are required' },
        { status: 400 }
      )
    }
    
    if (userName.length > 50) {
      return NextResponse.json(
        { error: 'userName must be ≤50 characters' },
        { status: 400 }
      )
    }
    
    if (text.length > 1000) {
      return NextResponse.json(
        { error: 'text must be ≤1000 characters' },
        { status: 400 }
      )
    }
    
    if (timestamp !== undefined && timestamp !== null && (timestamp < 0 || isNaN(timestamp))) {
      return NextResponse.json(
        { error: 'timestamp must be a positive number' },
        { status: 400 }
      )
    }
    
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
    
    // If replying to a comment, verify parent exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId }
      })
      
      if (!parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        )
      }
      
      if (parentComment.recordingId !== recordingId) {
        return NextResponse.json(
          { error: 'Parent comment belongs to different recording' },
          { status: 400 }
        )
      }
    }
    
    const comment = await prisma.comment.create({
      data: {
        recordingId,
        userName: userName.trim(),
        text: text.trim(),
        timestamp: timestamp !== undefined && timestamp !== null ? parseFloat(timestamp) : null,
        chapterIndex: chapterIndex !== undefined && chapterIndex !== null ? parseInt(chapterIndex) : null,
        parentId: parentId || null
      },
      include: {
        replies: true
      }
    })
    
    console.log('[Comments API] Comment created:', comment.id)
    
    return NextResponse.json({ comment }, { status: 201 })
    
  } catch (error) {
    console.error('[Comments API] Error creating comment:', error)
    console.error('[Comments API] Error details:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && 'code' in error) {
      console.error('[Comments API] Error code:', (error as { code: string }).code)
    }
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

