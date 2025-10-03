'use client'

import { useEffect, useRef } from 'react'
import AudioPlayer from 'react-h5-audio-player'
import 'react-h5-audio-player/lib/styles.css'
import './AudioControls.css'
import { AudioControlsProps } from '@/types/audio'

export default function AudioControls({
  audioUrl,
  onSeek,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onPlay,
  audioRef
}: AudioControlsProps) {
  const playerRef = useRef<AudioPlayer>(null)

  // Sync the internal audio element with the external audioRef
  useEffect(() => {
    if (playerRef.current && playerRef.current.audio) {
      const audioElement = playerRef.current.audio.current
      if (audioElement && audioRef) {
        // Assign the audio element to the parent's ref
        if ('current' in audioRef) {
          (audioRef as React.MutableRefObject<HTMLAudioElement | null>).current = audioElement
        }
        
        // Add custom seekAudio method for external use
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (audioElement as any).seekAudio = (time: number) => {
          if (audioElement) {
            audioElement.currentTime = time
            onTimeUpdate(time)
          }
        }
      }
    }
  }, [audioRef, onTimeUpdate])

  const handlePlay = () => {
    // Track play event for analytics
    if (onPlay) onPlay()
  }

  const handlePause = () => {
    // Pause event - no action needed (library handles state)
  }

  const handleListen = (e: Event) => {
    const target = e.target as HTMLAudioElement
    if (target) {
      onTimeUpdate(target.currentTime)
    }
  }

  const handleLoadedMetadata = (e: Event) => {
    const target = e.target as HTMLAudioElement
    if (target) {
      onLoadedMetadata(target.duration)
    }
  }

  const handleSeeked = (e: Event) => {
    const target = e.target as HTMLAudioElement
    if (target) {
      onSeek(target.currentTime)
    }
  }

  return (
    <div className="mb-6">
      <AudioPlayer
        ref={playerRef}
        src={audioUrl}
        showJumpControls={false}
        customAdditionalControls={[]}
        customVolumeControls={[]}
        layout="horizontal-reverse"
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={onEnded}
        onSeeked={handleSeeked}
        onListen={handleListen}
        onLoadedMetaData={handleLoadedMetadata}
        autoPlayAfterSrcChange={false}
        preload="auto"
      />
    </div>
  )
}

