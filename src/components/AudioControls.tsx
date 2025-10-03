'use client'

import { useEffect, useState, useRef } from 'react'
import { formatTime } from '@/utils/formatters'
import { AudioControlsProps } from '@/types/audio'

export default function AudioControls({
  audioUrl,
  isPlaying,
  duration,
  onTogglePlayPause,
  onSeek,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onPlay,
  audioRef
}: AudioControlsProps) {
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekTime, setSeekTime] = useState(0)
  const [displayTime, setDisplayTime] = useState(0)
  const lastUpdateTimeRef = useRef<number>(0)
  const THROTTLE_INTERVAL = 200 // ms
  
  // Smooth animation effect - 100% driven by audioRef.current.currentTime
  useEffect(() => {
    let animationId: number
    let isActive = true
    
    const animate = () => {
      if (!isActive) return
      
      const audio = audioRef.current
      if (audio && !isSeeking) {
        // Always read directly from audio element
        setDisplayTime(audio.currentTime)
      }
      
      animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    
    return () => {
      isActive = false
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isSeeking, audioRef])

  // Handle play/pause state changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.play().catch(err => {
        console.error('Error playing audio:', err)
      })
    } else {
      audio.pause()
    }
  }, [isPlaying, audioRef])

  // Stabilize displayTime when playback starts
  useEffect(() => {
    let timeout: NodeJS.Timeout

    if (isPlaying && audioRef.current) {
      // Give the audio element a moment to stabilize before syncing UI
      timeout = setTimeout(() => {
        const audio = audioRef.current
        if (audio) {
          setDisplayTime(audio.currentTime)
        }
      }, 100)
    }

    return () => {
      clearTimeout(timeout)
    }
  }, [isPlaying, audioRef])

  // Time update handler with throttling to avoid excessive parent updates
  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (audio && !isSeeking) {
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current
      
      // Only call onTimeUpdate if enough time has passed (throttle)
      if (timeSinceLastUpdate >= THROTTLE_INTERVAL) {
        const audioTime = audio.currentTime
        onTimeUpdate(audioTime)
        lastUpdateTimeRef.current = now
      }
    }
  }

  // Metadata loaded handler
  const handleLoadedMetadata = () => {
    const audio = audioRef.current
    if (audio) {
      onLoadedMetadata(audio.duration)
    }
  }

  // Seek handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setSeekTime(newTime)
    setIsSeeking(true)
    onSeek(newTime)
  }

  // Handle seek end
  const handleSeekEnd = () => {
    const audio = audioRef.current
    if (audio && isSeeking) {
      audio.currentTime = seekTime
      // Sync external state after seeking
      onTimeUpdate(seekTime)
      lastUpdateTimeRef.current = Date.now() // Reset throttle timer
      setDisplayTime(seekTime)
      setIsSeeking(false)
      setSeekTime(0)
    }
  }

  // Expose seek function on audio ref for external use
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (audio as any).seekAudio = (time: number) => {
        const currentAudio = audioRef.current
        if (currentAudio) {
          currentAudio.currentTime = time
          // Sync external and display state immediately
          onTimeUpdate(time)
          lastUpdateTimeRef.current = Date.now() // Reset throttle timer
          setDisplayTime(time)
        }
      }
    }
  }, [audioRef, onTimeUpdate])

  return (
    <div className="mb-6">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        onPlay={onPlay}
        tabIndex={-1}
      />

      {/* Audio controls with inline play button */}
      <div className="flex items-center gap-3">
        {/* Play/Pause icon button */}
        <button
          onClick={onTogglePlayPause}
          onMouseDown={(e) => e.preventDefault()}
          className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        
        <span className="text-sm text-gray-600 w-12">
          {formatTime(isSeeking ? seekTime : displayTime)}
        </span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.01"
          value={isSeeking ? seekTime : displayTime}
          onChange={handleSeek}
          onMouseUp={handleSeekEnd}
          onTouchEnd={handleSeekEnd}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((isSeeking ? seekTime : displayTime) / duration) * 100}%, #E5E7EB ${((isSeeking ? seekTime : displayTime) / duration) * 100}%, #E5E7EB 100%)`
          }}
        />
        <span className="text-sm text-gray-600 w-12">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  )
}

