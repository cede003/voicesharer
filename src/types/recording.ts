import { Transcript } from './audio'

export interface Recording {
  id: string
  name: string | null
  audioUrl: string
  status: string
  createdAt: string
  playCount: number
  lastPlayedAt: string | null
  commentCount: number
  recordingNumber: number | null
  transcript?: Transcript
}

