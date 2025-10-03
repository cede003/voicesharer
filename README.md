# VoiceSharer

A full-stack web application for recording, sharing, and transcribing audio memos.

## Features

- **Audio Recording**: Record high-quality audio directly in the browser
- **Auto Transcription**: Automatic transcription with OpenAI Whisper API and word-level timestamps
- **Interactive Transcript**: Spotify-style synchronized transcript with line-by-line highlighting
- **AI Q&A**: Ask questions about recordings using CopilotKit-powered chatbot
- **Shareable Links**: Generate unique URLs to share recordings
- **Synchronized Playback**: Click any word or line to jump to that timestamp
- **Cloud Storage**: Supports Supabase Storage and local file storage
- **Comments System**: Add timestamped comments to recordings

## Tech Stack

- **Frontend**: Next.js 15 + TypeScript + TailwindCSS
- **Backend**: Next.js API routes
- **Database**: SQLite with Prisma ORM
- **File Storage**: Supabase Storage / Local filesystem
- **Transcription**: OpenAI Whisper API with word-level timestamps
- **AI**: CopilotKit for Q&A functionality

## Getting Started

### Prerequisites

- Node.js 18+
- OpenAI API key (for transcription)
- (Optional) Supabase project for cloud storage

### Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd voicesharer
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env.local` file:
   ```bash
   # Required
   OPENAI_API_KEY="sk-..."
   
   # Storage (optional - defaults to local)
   STORAGE_PROVIDER="supabase"  # or "local"
   NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   ```

3. **Set up the database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## Usage

### Recording Audio

1. Click "Start Recording" on the home page
2. Grant microphone permissions when prompted
3. Speak into your microphone
4. Click "Stop" when finished
5. Recording is automatically uploaded and transcribed

### Viewing Recordings

1. After recording, you'll be redirected to the playback page
2. Wait for transcription to complete
3. Use audio controls to play/pause and seek
4. Watch transcript highlight in sync with audio playback
5. Click any line or word to jump to that timestamp
6. Copy the share link to send to others

### AI Q&A

1. On the playback page, click the "Ask AI" button
2. Ask questions about the recording's content
3. The AI answers based on the transcript content

### Comments

1. Click the comments icon on any recording
2. Add timestamped comments at specific moments
3. View and reply to existing comments

## API Endpoints

- `POST /api/recordings/upload` - Upload audio recording
- `GET /api/recordings/[id]` - Get recording details and transcript
- `POST /api/recordings/[id]/play` - Track playback events
- `GET /api/recordings/[id]/comments` - Get comments for recording
- `POST /api/recordings/[id]/comments` - Add comment to recording
- `GET /api/files/[...path]` - Serve uploaded files (development only)
- `POST /api/copilotkit` - CopilotKit runtime endpoint for AI chat

## Database Schema

### Recording
- `id` (UUID) - Primary key
- `createdAt` (DateTime) - Creation timestamp
- `audioUrl` (String) - URL to the audio file
- `status` (String) - Recording status (pending, processing, completed, failed)
- `name` (String) - User-defined recording name

### Transcript
- `id` (UUID) - Primary key
- `recordingId` (String) - Foreign key to Recording
- `fullText` (String) - Complete transcript text
- `wordTimestamps` (JSON) - Array of word-level timestamps

### Comment
- `id` (UUID) - Primary key
- `recordingId` (String) - Foreign key to Recording
- `content` (String) - Comment text
- `timestamp` (Float) - Timestamp in seconds
- `createdAt` (DateTime) - Creation timestamp

## Deployment

### Vercel + Supabase

1. **Deploy to Vercel**:
   ```bash
   npm install -g vercel
   vercel
   ```

2. **Set up Supabase database**:
   - Create a new Supabase project
   - Update `DATABASE_URL` in Vercel environment variables
   - Run migrations: `npx prisma migrate deploy`

3. **Set up Supabase Storage** (optional):
   - Create audio-recordings bucket in Supabase
   - Add Supabase credentials to Vercel environment variables

### Environment Variables for Production

```bash
# Required
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Storage (optional - defaults to local)
STORAGE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Development

### File Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── playback/      # Playback page
│   └── page.tsx       # Home page
├── components/        # React components
├── lib/              # Utilities and configurations
├── types/            # TypeScript type definitions
└── utils/            # Helper utilities
```

### Key Files

- `src/components/AudioRecorder.tsx` - Recording interface
- `src/components/AudioPlayer.tsx` - Playback with transcript sync
- `src/components/ChapterDisplay.tsx` - Transcript display with chapters
- `src/components/TranscriptChat.tsx` - AI Q&A chatbot
- `src/components/CommentForm.tsx` - Comment submission
- `src/components/CommentList.tsx` - Comment display
- `src/lib/transcription.ts` - Transcription service
- `src/lib/storage.ts` - File storage utilities
- `src/utils/alignTranscript.ts` - Transcript alignment utilities
- `prisma/schema.prisma` - Database schema

## Transcription Features

- **Word-level timestamps**: Each word is individually timestamped for precise synchronization
- **Interactive transcript**: Click any word or line to jump to that moment in the audio
- **Spotify-style display**: Lines highlight as they're spoken with smooth animations
- **Chapter detection**: Automatic chapter breaks based on transcript content
- **Auto-scroll**: Transcript automatically scrolls to keep current line in view

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License