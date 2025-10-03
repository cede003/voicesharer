'use client'

import { useState, FormEvent } from 'react'

interface CommentFormProps {
  onSubmit: (userName: string, text: string) => Promise<void>
  isSubmitting: boolean
  placeholder?: string
}

export default function CommentForm({ onSubmit, isSubmitting, placeholder }: CommentFormProps) {
  const [userName, setUserName] = useState('')
  const [text, setText] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!userName.trim() || !text.trim()) return

    try {
      await onSubmit(userName.trim(), text.trim())
      // Clear form on success
      setUserName('')
      setText('')
    } catch (error) {
      // Error is handled by parent component
      console.error('Error in comment form:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Your name"
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
          disabled={isSubmitting}
          required
        />
        <button
          type="submit"
          disabled={isSubmitting || !userName.trim() || !text.trim()}
          className="bg-blue-600 text-white px-4 py-1.5 text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || "Add your comment..."}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white text-gray-900 placeholder-gray-400"
        rows={2}
        disabled={isSubmitting}
        required
      />
    </form>
  )
}

