import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/recordings/[id]/reactions - Get all reactions for a recording
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params

    // Fetch all reactions for this recording
    const reactions = await prisma.reaction.findMany({
      where: { recordingId },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ reactions })
  } catch (error) {
    console.error('Error fetching reactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reactions' },
      { status: 500 }
    )
  }
}

// POST /api/recordings/[id]/reactions - Add a new reaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordingId } = await params
    const { chapterIndex, emoji, userName } = await request.json()

    // Validate required fields
    if (chapterIndex === undefined || !emoji) {
      return NextResponse.json(
        { error: 'Chapter index and emoji are required' },
        { status: 400 }
      )
    }

    // Create the reaction
    const reaction = await prisma.reaction.create({
      data: {
        recordingId,
        chapterIndex,
        emoji,
        userName: userName || null
      }
    })

    return NextResponse.json({ reaction }, { status: 201 })
  } catch (error) {
    console.error('Error adding reaction:', error)
    return NextResponse.json(
      { error: 'Failed to add reaction' },
      { status: 500 }
    )
  }
}

