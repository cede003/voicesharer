'use client'

import { useCopilotReadable } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'
import '@copilotkit/react-ui/styles.css'
import { Comment } from '@/types/comment'
import { Transcript } from '@/types/audio'

interface TranscriptChatContentProps {
  transcript: Transcript
  recordingName?: string
  comments?: Comment[]
  onClose: () => void
}

export default function TranscriptChatContent({ 
  transcript, 
  recordingName, 
  comments = [], 
  onClose 
}: TranscriptChatContentProps) {
  // Make the recording name readable by the AI
  useCopilotReadable({
    description: 'The name/title of this recording',
    value: recordingName || 'Untitled Recording',
  })

  // Make the transcript readable by the AI with chapter structure
  useCopilotReadable({
    description: 'Recording transcript organized into chapters with titles, content, and timestamps',
    value: transcript.chapters && transcript.chapters.length > 0 
      ? transcript.chapters.map(chapter => ({
          title: chapter.title,
          content: chapter.sentences.join(' '),
          startTime: chapter.startTime,
          endTime: chapter.endTime,
        }))
      : [{ 
          title: 'Full Transcript', 
          content: transcript.fullText,
          startTime: 0,
          endTime: 0 
        }],
  })

  // Make comments readable by the AI
  useCopilotReadable({
    description: 'User comments and discussions about this recording, including timestamps and replies',
    value: comments.map(comment => ({
      userName: comment.userName,
      text: comment.text,
      timestamp: comment.timestamp,
      chapterIndex: comment.chapterIndex,
      createdAt: comment.createdAt,
      replies: comment.replies.map(reply => ({
        userName: reply.userName,
        text: reply.text,
        createdAt: reply.createdAt,
      })),
    })),
  })

  return (
    <div className="fixed bottom-24 right-6 z-50">
      <div className="bg-white rounded-lg shadow-2xl w-96 max-h-[600px] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
              />
            </svg>
            <h3 className="font-semibold">AI Q&A</h3>
          </div>
          <button 
            onClick={onClose}
            className="hover:bg-white/20 rounded p-1 transition-colors"
            aria-label="Close chat"
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
          <p className="text-xs text-blue-800">
            💡 Ask me anything about this recording&apos;s transcript
          </p>
        </div>

        {/* CopilotKit Chat */}
        <div className="flex-1 overflow-hidden h-[500px]">
          <CopilotChat
            instructions="You are an AI assistant helping users understand and analyze an audio recording transcript. Your role is to:
            
1. Answer questions about the transcript content accurately and concisely
2. Summarize parts of the transcript when asked
3. Help find specific information within the transcript
4. Provide insights and key points from the recording
5. Reference specific chapters and timestamps when relevant
6. Always ground your responses in the actual transcript content - don't make up information
7. If something is not mentioned in the transcript, clearly state that

Be helpful, concise, and always reference the transcript when answering questions."
            labels={{
              title: "Ask about the transcript",
              initial: "Hi! I can help you understand this recording. Ask me anything about the transcript!",
            }}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}

