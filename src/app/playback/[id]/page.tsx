'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import AudioPlayer from '@/components/AudioPlayer'
import TranscriptChat from '@/components/TranscriptChat'
import { Comment } from '@/types/comment'
import { Recording } from '@/types/recording'
import { Reaction } from '@/types/reaction'

export default function PlaybackPage() {
  const params = useParams()
  const router = useRouter()
  const [recording, setRecording] = useState<Recording | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [isLoadingComments, setIsLoadingComments] = useState(true)
  const [isLoadingReactions, setIsLoadingReactions] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showCopyNotification, setShowCopyNotification] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')

  useEffect(() => {
    const fetchRecording = async () => {
      try {
        const response = await fetch(`/api/recordings/${params.id}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Recording not found')
          }
          throw new Error('Failed to fetch recording')
        }

        const data = await response.json()
        setRecording(data)
      } catch (error) {
        console.error('Error fetching recording:', error)
        setError(error instanceof Error ? error.message : 'Failed to load recording')
      } finally {
        setLoading(false)
      }
    }

    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/recordings/${params.id}/comments`)
        if (response.ok) {
          const data = await response.json()
          setComments(data.comments)
        }
      } catch (error) {
        console.error('Error fetching comments:', error)
      } finally {
        setIsLoadingComments(false)
      }
    }

    const fetchReactions = async () => {
      try {
        const response = await fetch(`/api/recordings/${params.id}/reactions`)
        if (response.ok) {
          const data = await response.json()
          setReactions(data.reactions)
        }
      } catch (error) {
        console.error('Error fetching reactions:', error)
      } finally {
        setIsLoadingReactions(false)
      }
    }

    if (params.id) {
      fetchRecording()
      fetchComments()
      fetchReactions()
    }
  }, [params.id])

  // Poll for status updates when processing
  useEffect(() => {
    if (!recording || recording.status !== 'processing') return

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/recordings/${params.id}`)
        if (response.ok) {
          const data = await response.json()
          setRecording(data)
          
          // Stop polling if status changed
          if (data.status !== 'processing') {
            clearInterval(pollInterval)
          }
        }
      } catch (error) {
        console.error('Error polling recording status:', error)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [recording, params.id])

  const copyShareUrl = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setShowCopyNotification(true)
      setTimeout(() => setShowCopyNotification(false), 2000)
    }
  }

  const downloadTranscript = () => {
    if (!recording?.transcript) return

    const fileName = recording.name 
      ? `${recording.name} - transcript.txt`
      : `Recording-${recording.recordingNumber || recording.id} - transcript.txt`
    
    const transcriptText = recording.transcript.fullText
    const blob = new Blob([transcriptText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDeleteRecording = async () => {
    if (!recording) return
    
    if (!confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      return
    }
    
    setIsDeleting(true)
    
    try {
      const response = await fetch(`/api/recordings/${recording.id}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete recording')
      }
      
      // Redirect to home page after successful deletion
      router.push('/')
      
    } catch (error) {
      console.error('Error deleting recording:', error)
      setError('Failed to delete recording')
    } finally {
      setIsDeleting(false)
    }
  }

  const handlePlay = async () => {
    // This is called on the first play, but we don't increment the count here
    // We only increment when the audio is played all the way through (in handleEnded)
  }

  const handleEnded = async () => {
    // Track completion - increment play count when audio finishes
    try {
      const response = await fetch(`/api/recordings/${params.id}/play`, {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        
        // Update local recording state with new play count
        if (recording) {
          setRecording({
            ...recording,
            playCount: data.playCount,
            lastPlayedAt: data.lastPlayedAt
          })
        }
      }
    } catch (error) {
      console.error('Error tracking completion:', error)
      // Don't throw - this shouldn't affect user experience
    }
  }

  const handleAddComment = async (userName: string, text: string, timestamp: number | null, chapterIndex: number | null, parentId?: string) => {
    try {
      const response = await fetch(`/api/recordings/${params.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, text, timestamp, chapterIndex, parentId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to post comment')
      }

      const data = await response.json()
      
      // Update comments list
      if (parentId) {
        // If it's a reply, update the parent comment's replies
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === parentId 
              ? { ...comment, replies: [...comment.replies, data.comment] }
              : comment
          )
        )
      } else {
        // If it's a top-level comment, add it to the list
        setComments(prevComments => [data.comment, ...prevComments])
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      throw error
    }
  }

  const handleAddReaction = async (chapterIndex: number, emoji: string, userName?: string) => {
    try {
      const response = await fetch(`/api/recordings/${params.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterIndex, emoji, userName })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add reaction')
      }

      const data = await response.json()
      
      // Update reactions list
      setReactions(prevReactions => [...prevReactions, data.reaction])
    } catch (error) {
      console.error('Error adding reaction:', error)
      throw error
    }
  }

  const handleTitleClick = () => {
    if (recording) {
      setEditedTitle(recording.name || '')
      setIsEditingTitle(true)
    }
  }

  const handleTitleSave = async () => {
    if (!recording || editedTitle === recording.name) {
      setIsEditingTitle(false)
      return
    }

    try {
      const response = await fetch(`/api/recordings/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedTitle })
      })

      if (!response.ok) {
        throw new Error('Failed to update recording name')
      }

      const data = await response.json()
      setRecording(data)
      setIsEditingTitle(false)
    } catch (error) {
      console.error('Error updating recording name:', error)
      alert('Failed to update recording name')
    }
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading recording...</p>
        </div>
      </div>
    )
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 text-red-800 px-6 py-4 rounded-lg max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p>{error || 'Recording not found'}</p>
            <Link 
              href="/" 
              className="inline-block mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Home Button */}
        <div className="mb-6">
          <Link 
            href="/" 
            className="inline-flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              className="text-3xl font-bold text-gray-800 mb-2 text-center bg-transparent border-b-2 border-blue-500 focus:outline-none px-2"
              placeholder="Enter recording name"
            />
          ) : (
            <h1 
              className="text-3xl font-bold text-gray-800 mb-2 cursor-pointer hover:text-blue-600 transition-colors inline-block"
              onClick={handleTitleClick}
              title="Click to edit"
            >
              {recording.name || (recording.recordingNumber ? `Recording #${recording.recordingNumber}` : 'Untitled Recording')}
            </h1>
          )}
          <div className="flex items-center justify-center space-x-4 text-sm text-gray-600 mb-2">
            <span>Recorded: {new Date(recording.createdAt).toLocaleString()}</span>
            <span>•</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              recording.status === 'completed' 
                ? 'bg-green-100 text-green-800' 
                : recording.status === 'processing'
                ? 'bg-yellow-100 text-yellow-800'
                : recording.status === 'failed'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {recording.status}
            </span>
          </div>
          
          {/* Stats */}
          <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{recording.playCount} {recording.playCount === 1 ? 'play' : 'plays'}</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{recording.commentCount} {recording.commentCount === 1 ? 'comment' : 'comments'}</span>
            </div>
            <span>•</span>
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{reactions.length} {reactions.length === 1 ? 'reaction' : 'reactions'}</span>
            </div>
            {recording.lastPlayedAt && (
              <>
                <span>•</span>
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Last played: {new Date(recording.lastPlayedAt).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Share and Delete Buttons */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={copyShareUrl}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <span>Copy Share Link</span>
            </button>
            
            {/* Download Transcript Button - only show if transcription succeeded */}
            {recording.status === 'completed' && recording.transcript && (
              <button
                onClick={downloadTranscript}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download Transcript</span>
              </button>
            )}
            
            <button
              onClick={handleDeleteRecording}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              <span>Delete Recording</span>
            </button>
          </div>
        </div>

        {/* Audio Player and Transcript */}
        {isLoadingComments || isLoadingReactions ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-4xl mx-auto">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Loading...</p>
          </div>
        ) : (
          <>
            <AudioPlayer 
              audioUrl={recording.audioUrl}
              transcript={recording.transcript || undefined}
              comments={comments}
              reactions={reactions}
              onAddComment={handleAddComment}
              onAddReaction={handleAddReaction}
              onPlay={handlePlay}
              onEnded={handleEnded}
              failed={recording.status === 'failed'}
              processing={recording.status === 'processing'}
            />
            
            {/* AI Q&A Chat - only show if transcription succeeded */}
            {recording.status === 'completed' && recording.transcript && (
              <TranscriptChat 
                key={recording.id}
                transcript={recording.transcript}
                recordingName={recording.name || undefined}
                comments={comments}
              />
            )}
          </>
        )}

        {/* Navigation */}
        <div className="text-center mt-8">
          <Link 
            href="/" 
            className="inline-block bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            Record Another
          </Link>
        </div>
      </div>

      {/* Copy Notification */}
      {showCopyNotification && (
        <div className="fixed top-4 right-4 bg-gray-800 bg-opacity-90 text-gray-100 px-4 py-2 rounded-md shadow-md flex items-center space-x-2 z-50 animate-in slide-in-from-top-2 duration-300 backdrop-blur-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm">Link copied</span>
        </div>
      )}
    </div>
  )
}
