import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

/**
 * API route to serve uploaded files in development
 * In production, files should be served directly from S3
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathArray } = await params
    const filePath = pathArray.join('/')
    const uploadDir = process.env.UPLOAD_DIR || './uploads'
    const fullPath = path.join(uploadDir, filePath)
    
    // Security check: ensure the file is within the upload directory
    const resolvedPath = path.resolve(fullPath)
    const resolvedUploadDir = path.resolve(uploadDir)
    
    if (!resolvedPath.startsWith(resolvedUploadDir)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }
    
    const fileBuffer = await fs.readFile(fullPath)
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase()
    const contentTypes: { [key: string]: string } = {
      '.webm': 'audio/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
    }
    
    const contentType = contentTypes[ext] || 'application/octet-stream'
    
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })
    
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )
  }
}
