export interface Reaction {
  id: string
  recordingId: string
  chapterIndex: number
  emoji: string
  userName?: string | null
  createdAt: string
}

export interface ReactionGroup {
  emoji: string
  count: number
  users: string[]
}

