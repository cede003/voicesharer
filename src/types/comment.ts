export interface Comment {
  id: string
  userName: string
  text: string
  timestamp: number | null
  chapterIndex: number | null
  createdAt: string
  parentId: string | null
  replies: Comment[]
}

