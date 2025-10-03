'use client'

import { useState, useRef, useCallback } from 'react'
import { formatTime } from '@/utils/formatters'
import { AudioRecorderProps } from '@/types/audio'

export default function AudioRecorder({ onRecordingComplete, onError, onRecordingStart, recordingName, onRecordingNameChange, isUploading }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isCancelledRef = useRef<boolean>(false)

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ]
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    
    return undefined // Let browser choose default
  }

  const startRecording = async () => {
    try {
      // Start countdown
      setCountdown(3)
      
      // Initialize media stream during countdown
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream
      
      const mimeType = getSupportedMimeType()
      const options = mimeType ? { mimeType } : {}
      
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      
      const chunks: Blob[] = []
      
      // Reset cancelled flag
      isCancelledRef.current = false
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      mediaRecorder.onstart = () => {
        // Only set recording state when actually started
        setIsRecording(true)
        setRecordingTime(0)
        setCountdown(null)
        startTimer()
      }
      
      mediaRecorder.onstop = () => {
        // Only process the recording if it wasn't cancelled
        if (!isCancelledRef.current) {
          const mimeType = mediaRecorder.mimeType || 'audio/webm'
          const audioBlob = new Blob(chunks, { type: mimeType })
          onRecordingComplete(audioBlob)
        }
        
        // Stop all tracks to release microphone
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop())
          audioStreamRef.current = null
        }
      }
      
      // Countdown: 3... 2... 1... Start!
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCountdown(2)
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCountdown(1)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      mediaRecorder.start(100) // Collect data every 100ms
      
      // Clear any previous errors when recording successfully starts
      if (onRecordingStart) {
        onRecordingStart()
      }
      
    } catch (error) {
      setCountdown(null)
      onError('Unable to access microphone. Please check your permissions.')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      stopTimer()
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      startTimer()
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      stopTimer()
    }
  }

  const cancelRecording = () => {
    // Set cancelled flag before stopping
    isCancelledRef.current = true
    
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
    
    // Stop all tracks and reset state
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
      audioStreamRef.current = null
    }
    
    setIsRecording(false)
    setIsPaused(false)
    setRecordingTime(0)
    stopTimer()
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {countdown !== null ? 'Get Ready...' : isRecording ? 'Recording...' : 'Ready to Record'}
        </h2>
        
        {/* Countdown Display */}
        {countdown !== null && (
          <div className="text-6xl font-bold text-blue-600 my-4 animate-pulse">
            {countdown}
          </div>
        )}
        
        {/* Recording Name Input - shown when not recording */}
        {!isRecording && onRecordingNameChange && (
          <div className="mt-4 mb-2 text-left">
            <label htmlFor="recordingName" className="block text-sm font-medium text-gray-700 mb-2">
              Recording Name (Optional)
            </label>
            <input
              id="recordingName"
              type="text"
              value={recordingName || ''}
              onChange={(e) => onRecordingNameChange(e.target.value)}
              placeholder="e.g., Team Meeting Notes, Quick Memo..."
              maxLength={100}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-500"
              disabled={isUploading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Give your recording a memorable name
            </p>
          </div>
        )}
        {isRecording && (
          <div className="text-3xl font-mono text-red-600 mb-2">
            {formatTime(recordingTime)}
          </div>
        )}
        {isRecording && (
          <div className="flex items-center justify-center space-x-2 text-red-600">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              {isPaused ? 'Paused' : 'Recording'}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-center space-x-4">
        {!isRecording && countdown === null ? (
          <button
            onClick={startRecording}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-semibold transition-colors duration-200 flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            <span>Start Recording</span>
          </button>
        ) : (
          <>
            {!isPaused ? (
              <button
                onClick={pauseRecording}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-full font-semibold transition-colors duration-200"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-full font-semibold transition-colors duration-200"
              >
                Resume
              </button>
            )}
            
            <button
              onClick={stopRecording}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-full font-semibold transition-colors duration-200"
            >
              Stop
            </button>
            
            <button
              onClick={cancelRecording}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded-full font-semibold transition-colors duration-200"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {isRecording && (
        <div className="mt-4 text-center text-sm text-gray-600">
          <p>Speak clearly into your microphone</p>
          <p className="mt-1">Recording will be automatically transcribed</p>
        </div>
      )}
    </div>
  )
}
