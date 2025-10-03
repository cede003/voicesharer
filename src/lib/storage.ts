import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { uploadToSupabaseStorage, deleteFromSupabaseStorage } from './supabase-storage'

// S3 Client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

export interface UploadResult {
  url: string
  key: string
}

/**
 * Upload audio file to S3 or local storage based on environment
 */
export async function uploadAudioFile(
  file: Buffer,
  fileName: string,
  contentType: string = 'audio/webm'
): Promise<UploadResult> {
  // Use Supabase Storage if configured, otherwise local storage
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return uploadToSupabaseStorage(file, fileName, contentType)
  } else if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
    const key = `audio/${uuidv4()}-${fileName}`
    return uploadToS3(file, key, contentType)
  } else {
    const key = `audio/${uuidv4()}-${fileName}`
    return uploadToLocal(file, key)
  }
}

/**
 * Upload to AWS S3
 */
async function uploadToS3(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
    Body: file,
    ContentType: contentType,
    ACL: 'public-read',
  })

  await s3Client.send(command)
  
  const url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  
  return { url, key }
}

/**
 * Upload to local filesystem (development only)
 */
async function uploadToLocal(
  file: Buffer,
  key: string,
): Promise<UploadResult> {
  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  const filePath = path.join(uploadDir, key)
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  
  // Write file
  await fs.writeFile(filePath, file)
  
  // Return URL for local development
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/files/${key}`
  
  return { url, key }
}

/**
 * Generate a presigned URL for audio file access
 */
export async function getAudioFileUrl(key: string): Promise<string> {
  if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: key,
    })
    
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  } else {
    // For local development, return the direct URL
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/files/${key}`
  }
}

/**
 * Delete audio file from storage
 */
export async function deleteAudioFile(key: string): Promise<void> {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return deleteFromSupabaseStorage(key)
  } else if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
    // TODO: Implement S3 delete
    console.log('S3 delete not implemented yet')
  } else {
    // Delete from local storage
    const uploadDir = process.env.UPLOAD_DIR || './uploads'
    const filePath = path.join(uploadDir, key)
    
    try {
      await fs.unlink(filePath)
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }
}
