import { supabase } from './supabase'
import { v4 as uuidv4 } from 'uuid'
import { getFileExtension } from '@/utils/formatters'

export interface SupabaseUploadResult {
  url: string
  key: string
}

/**
 * Upload audio file to Supabase Storage
 */
export async function uploadToSupabaseStorage(
  file: Buffer,
  fileName: string,
  contentType: string = 'audio/webm'
): Promise<SupabaseUploadResult> {
  const fileExtension = getFileExtension(contentType)
  const filePath = `audio/${uuidv4()}${fileExtension}`
  
  const { data, error } = await supabase.storage
    .from('audio-recordings')
    .upload(filePath, file, {
      contentType,
      upsert: false
    })
  
  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`)
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('audio-recordings')
    .getPublicUrl(filePath)
  
  return {
    url: urlData.publicUrl,
    key: filePath
  }
}

/**
 * Delete audio file from Supabase Storage
 */
export async function deleteFromSupabaseStorage(filePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from('audio-recordings')
    .remove([filePath])
  
  if (error) {
    console.error('Error deleting file from Supabase:', error)
  }
}
