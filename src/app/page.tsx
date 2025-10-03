'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AudioRecorder from '@/components/AudioRecorder'

interface ExpandedTranscripts {
  [key: string]: boolean
}

interface Recording {
  id: string
  name: string | null
  audioUrl: string
  status: string
  createdAt: string
  recordingNumber: number
  transcript: {
    fullText: string
  } | null
  analytics: {
    playCount: number
    commentCount: number
    reactionCount: number
    engagementScore: number
    lastPlayedAt: string | null
    shareCount: number
  }
}

export default function Home() {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isLoadingRecordings, setIsLoadingRecordings] = useState(true)
  const [recordingName, setRecordingName] = useState<string>('')
  const [deletingRecordingId, setDeletingRecordingId] = useState<string | null>(null)
  const [expandedTranscripts, setExpandedTranscripts] = useState<ExpandedTranscripts>({})
  const router = useRouter()

  useEffect(() => {
    fetchRecordings()
  }, [])

  // Refetch recordings when user returns to the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page is visible again, refetch recordings
        fetchRecordings()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const fetchRecordings = async () => {
    try {
      setIsLoadingRecordings(true)
      const response = await fetch('/api/recordings')
      if (!response.ok) {
        throw new Error('Failed to fetch recordings')
      }
      const data = await response.json()
      setRecordings(data.recordings)
    } catch (error) {
      console.error('Error fetching recordings:', error)
    } finally {
      setIsLoadingRecordings(false)
    }
  }

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      // Let the server generate the filename based on MIME type
      formData.append('audio', audioBlob, 'recording')
      
      // Add recording name if provided
      if (recordingName.trim()) {
        formData.append('name', recordingName.trim())
      }

      const response = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      
      // Reset recording name
      setRecordingName('')
      
      // Redirect to playback page
      router.push(`/playback/${result.id}`)
      
    } catch (error) {
      console.error('Upload error:', error)
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleError = (errorMessage: string) => {
    setError(errorMessage)
  }

  const handleRecordingStart = () => {
    setError(null)
  }

  const handleDeleteRecording = async (recordingId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent navigation when clicking delete
    
    if (!confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      return
    }
    
    setDeletingRecordingId(recordingId)
    
    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete recording')
      }
      
      // Remove the recording from the local state
      setRecordings(recordings.filter(recording => recording.id !== recordingId))
      
    } catch (error) {
      console.error('Error deleting recording:', error)
      setError('Failed to delete recording')
    } finally {
      setDeletingRecordingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-yellow-100 text-yellow-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const toggleTranscript = (recordingId: string) => {
    setExpandedTranscripts(prev => ({
      ...prev,
      [recordingId]: !prev[recordingId]
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
            VoiceSharer
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Record, share, and transcribe audio memos with ease. 
            Perfect for quick voice messages, meeting notes, and more.
          </p>
        </div>

        {/* Recording Interface */}
        <div className="max-w-md mx-auto mb-8">
          <AudioRecorder 
            onRecordingComplete={handleRecordingComplete}
            onError={handleError}
            onRecordingStart={handleRecordingStart}
            recordingName={recordingName}
            onRecordingNameChange={setRecordingName}
            isUploading={isUploading}
          />
        </div>

        {/* Status Messages */}
        {isUploading && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Uploading and processing your recording...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-red-100 text-red-800 px-4 py-2 rounded-full">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Recordings List */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">Your Recordings</h2>
          
          {isLoadingRecordings ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : recordings.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No recordings yet</h3>
              <p className="text-gray-500">Start by recording your first audio message above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recordings.map((recording) => (
                <div 
                  key={recording.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 
                              onClick={() => router.push(`/playback/${recording.id}`)}
                              className="text-lg font-semibold text-gray-800 cursor-pointer hover:text-blue-600 hover:underline transition-colors duration-200"
                            >
                              {recording.name || `Recording #${recording.recordingNumber}`}
                            </h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(recording.status)}`}>
                              {recording.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span className="flex items-center space-x-1">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-medium">{recording.analytics.playCount}</span>
                              <span className="text-gray-500">plays</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              <span className="font-medium">{recording.analytics.commentCount}</span>
                              <span className="text-gray-500">comments</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-medium">{recording.analytics.reactionCount}</span>
                              <span className="text-gray-500">reactions</span>
                            </span>
                            {recording.analytics.lastPlayedAt && (
                              <span className="flex items-center space-x-1">
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-gray-500">Last played:</span>
                                <span className="font-medium">{formatDate(recording.analytics.lastPlayedAt)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteRecording(recording.id, e)}
                          disabled={deletingRecordingId === recording.id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete recording"
                        >
                          {deletingRecordingId === recording.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-gray-500">
                        Created: {formatDate(recording.createdAt)}
                      </p>
                    </div>

                    {/* Transcript Preview Dropdown */}
                    {recording.transcript && (
                      <div className="border-t border-gray-200 mt-4">
                        <button
                          onClick={() => toggleTranscript(recording.id)}
                          className="flex items-center space-x-2 w-full text-left hover:bg-gray-50 py-3 transition-colors duration-200"
                        >
                          <svg 
                            className={`w-4 h-4 text-gray-500 transform transition-transform duration-200 flex-shrink-0 ${expandedTranscripts[recording.id] ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm font-medium text-gray-700">Transcript</span>
                        </button>
                        {expandedTranscripts[recording.id] && (
                          <div className="pb-3">
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {recording.transcript.fullText}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Easy Recording</h3>
            <p className="text-gray-600">
              Record high-quality audio directly in your browser with just one click.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Auto Transcription</h3>
            <p className="text-gray-600">
              Get instant transcriptions of your audio with word-level timestamps.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Share & Sync</h3>
            <p className="text-gray-600">
              Share your recordings with others and sync text with audio playback.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}