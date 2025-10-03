#!/usr/bin/env node

/**
 * Manual script to process pending transcriptions
 * Run with: node process-transcriptions.js
 */

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function processTranscriptions() {
  try {
    console.log('Processing pending transcriptions...')
    
    const response = await fetch(`${API_URL}/api/recordings/process-transcription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const result = await response.json()
    console.log('Processing result:', JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error('Error processing transcriptions:', error)
    process.exit(1)
  }
}

processTranscriptions()
