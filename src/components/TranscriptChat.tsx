'use client'

import { useState, useEffect, Suspense, lazy } from 'react'
import { Comment } from '@/types/comment'
import { Transcript } from '@/types/audio'

// Lazy load CopilotKit components (saves ~200KB from initial bundle)
const CopilotChatContent = lazy(() => 
  import('./TranscriptChatContent').then(module => ({ default: module.default }))
)

interface TranscriptChatProps {
  transcript: Transcript
  recordingName?: string
  comments?: Comment[]
}

export default function TranscriptChat({ transcript, recordingName, comments = [] }: TranscriptChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [chatKey, setChatKey] = useState(0)

  // Reset chat when component mounts
  useEffect(() => {
    setChatKey(prev => prev + 1)
    setIsOpen(false)
  }, [])

  return (
    <div className="relative">
      {/* Chat Toggle Button */}
      <button
        onClick={() => {
          if (!isOpen) {
            setChatKey(prev => prev + 1)
          }
          setIsOpen(!isOpen)
        }}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 transform hover:scale-110 z-50 flex items-center space-x-2"
        aria-label="Toggle AI Q&A Chat"
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
          />
        </svg>
        <span className="font-medium">Ask AI</span>
      </button>

      {/* Chat Interface - Only load when opened */}
      {isOpen && (
        <Suspense fallback={<ChatLoadingSkeleton />}>
          <CopilotChatContent
            key={chatKey}
            transcript={transcript}
            recordingName={recordingName}
            comments={comments}
            onClose={() => setIsOpen(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

function ChatLoadingSkeleton() {
  return (
    <div className="fixed bottom-24 right-6 z-50">
      <div className="bg-white rounded-lg shadow-2xl w-96 h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading AI Chat...</p>
        </div>
      </div>
    </div>
  )
}

