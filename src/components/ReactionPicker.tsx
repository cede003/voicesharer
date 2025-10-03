'use client'

import { useEffect, useRef, useState } from 'react'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void
  onClose: () => void
  position?: { top?: number; bottom?: number; left?: number; right?: number }
}

export default function ReactionPicker({ onSelectEmoji, onClose, position }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  // Adjust position to keep picker on screen
  useEffect(() => {
    if (!pickerRef.current || !position) return

    const picker = pickerRef.current
    const rect = picker.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const newPosition = { ...position }

    // Check if picker goes off right edge
    if (position.left !== undefined && position.left + rect.width > viewportWidth) {
      newPosition.left = undefined
      newPosition.right = 16 // 16px from right edge
    }

    // Check if picker goes off bottom edge
    if (position.top !== undefined && position.top + rect.height > viewportHeight) {
      newPosition.top = undefined
      newPosition.bottom = viewportHeight - (position.top || 0) + 8 // Place above button
    }

    setAdjustedPosition(newPosition)
  }, [position])

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close picker on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Close picker on scroll
  useEffect(() => {
    const handleScroll = () => {
      onClose()
    }

    // Listen to scroll on window and all scrollable parents
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [onClose])

  const handleEmojiSelect = (emoji: { native: string }) => {
    onSelectEmoji(emoji.native)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div 
        ref={pickerRef}
        className="absolute pointer-events-auto"
        style={{
          top: adjustedPosition?.top,
          bottom: adjustedPosition?.bottom,
          left: adjustedPosition?.left,
          right: adjustedPosition?.right,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        <Picker
          data={data}
          onEmojiSelect={handleEmojiSelect}
          theme="light"
          previewPosition="none"
          skinTonePosition="search"
          maxFrequentRows={2}
        />
      </div>
    </div>
  )
}

