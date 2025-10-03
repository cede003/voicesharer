import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Simple database connection test endpoint
 * Visit: /api/test-db
 */
export async function GET() {
  try {
    // Simple database ping
    await prisma.$queryRaw`SELECT 1`
    
    // Also test that we can count recordings
    const recordingCount = await prisma.recording.count()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection successful',
      recordingCount,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database connection error:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

