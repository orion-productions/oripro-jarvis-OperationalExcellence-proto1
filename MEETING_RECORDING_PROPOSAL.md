# 🎙️ Meeting Recording & Analysis Feature - Implementation Proposal

## 📋 Overview

Add meeting recording capabilities with automatic transcription, summarization, and sentiment analysis. Support up to 1-hour recordings with up to 16 participants.

## 🏗️ Architecture

### **Frontend Components**

1. **RecordingControl Component** (`webapp/src/components/RecordingControl.tsx`)
   - Start/Stop recording buttons
   - Real-time timer display (MM:SS)
   - Recording status indicator (🔴 Recording / ⏸️ Paused)
   - Participant count display (if speaker diarization available)
   - Audio level visualization (optional)

2. **MeetingList Component** (`webapp/src/components/MeetingList.tsx`)
   - List of all recorded meetings
   - Date, duration, participant count
   - Quick actions: View transcript, Summarize, Analyze sentiment

3. **Integration Points**
   - Add recording button to `ChatHeader.tsx` or `RightPanel.tsx`
   - Modal overlay for recording controls
   - Meeting list in sidebar or dedicated panel

### **Backend Services**

1. **Recording Service** (`webapp/server/recordingService.cjs`)
   - Handle audio file uploads
   - Manage recording metadata
   - Store audio files in `webapp/server/recordings/` directory
   - Store transcripts and metadata in JSON files or IndexedDB

2. **Transcription Service** (`webapp/server/transcriptionService.cjs`)
   - **Option 1: OpenAI Whisper API** (Recommended)
     - High accuracy
     - Supports multiple languages
     - Speaker diarization (identify who said what)
     - Cost: ~$0.006 per minute
   - **Option 2: Google Speech-to-Text**
     - Good accuracy
     - Speaker diarization available
     - Cost: ~$0.006 per minute
   - **Option 3: Local Whisper** (Free)
     - Requires model download (~1.5GB)
     - No API costs
     - Slower processing
     - No speaker diarization by default

3. **Analysis Service** (`webapp/server/meetingAnalysisService.cjs`)
   - Summarization using AI (OpenAI/Gemini)
   - Sentiment analysis
   - Key points extraction
   - Action items detection

### **Storage Structure**

```
webapp/server/
  recordings/
    {meeting-id}/
      audio.webm (or .mp3)
      transcript.json
      metadata.json
```

**Metadata Format:**
```json
{
  "id": "meeting-2025-01-15-14-30-00",
  "date": "2025-01-15T14:30:00Z",
  "duration": 3600, // seconds
  "participants": 8,
  "audioPath": "recordings/meeting-2025-01-15-14-30-00/audio.webm",
  "transcriptPath": "recordings/meeting-2025-01-15-14-30-00/transcript.json",
  "status": "completed" // recording, processing, completed, error
}
```

**Transcript Format:**
```json
{
  "segments": [
    {
      "start": 0.0,
      "end": 5.2,
      "speaker": "Speaker 1",
      "text": "Welcome everyone to today's meeting..."
    },
    {
      "start": 5.2,
      "end": 12.5,
      "speaker": "Speaker 2",
      "text": "Thank you. Let's start with the agenda..."
    }
  ],
  "fullText": "Welcome everyone... Thank you. Let's start..."
}
```

## 🔌 API Endpoints

### Recording Management

```
POST /api/meetings/start
  Body: { title?: string, participants?: number }
  Response: { meetingId: string, status: "recording" }

POST /api/meetings/stop
  Body: { meetingId: string }
  Response: { meetingId: string, status: "processing" }

POST /api/meetings/upload
  Body: FormData with audio file
  Response: { meetingId: string, status: "processing" }

GET /api/meetings
  Response: { meetings: MeetingMetadata[] }

GET /api/meetings/:id
  Response: { meeting: MeetingMetadata }

GET /api/meetings/:id/transcript
  Response: { transcript: Transcript }

GET /api/meetings/:id/audio
  Response: Audio file stream
```

### Analysis Endpoints

```
POST /api/meetings/:id/summarize
  Response: { summary: string, keyPoints: string[], duration: number }

POST /api/meetings/:id/sentiment
  Response: { 
    overall: "positive" | "neutral" | "negative",
    score: number, // -1 to 1
    segments: SentimentSegment[]
  }

POST /api/meetings/:id/action-items
  Response: { actionItems: ActionItem[] }
```

## 🛠️ MCP Tools

Add to `MCP_TOOLS` array in `server/index.cjs`:

1. **`meeting_list`**
   - List all recorded meetings
   - Example: *"List all meetings"* or *"Show recorded meetings"*

2. **`meeting_latest`**
   - Get latest meeting
   - Example: *"What was the latest meeting?"*

3. **`meeting_transcript`**
   - Get transcript for a meeting
   - Example: *"Show transcript for latest meeting"*

4. **`meeting_summarize`**
   - Summarize a meeting
   - Example: *"Can you summarize the latest meeting?"*

5. **`meeting_sentiment`**
   - Analyze sentiment
   - Example: *"What is your sentiment analysis on latest meeting?"*

6. **`meeting_search`**
   - Search in transcripts
   - Example: *"Search for 'budget' in meeting transcripts"*

## 💻 Implementation Steps

### Phase 1: Basic Recording (Frontend)
1. Create `RecordingControl.tsx` component
2. Implement MediaRecorder API for browser audio capture
3. Add recording UI to chat interface
4. Handle start/stop and timer display
5. Convert audio to blob and send to backend

### Phase 2: Backend Storage
1. Create `recordingService.cjs`
2. Add endpoints for upload and metadata management
3. Set up file storage structure
4. Implement metadata JSON storage

### Phase 3: Transcription
1. Create `transcriptionService.cjs`
2. Integrate OpenAI Whisper API (or chosen service)
3. Handle audio file processing
4. Store transcripts in structured format
5. Add speaker diarization if available

### Phase 4: Analysis Services
1. Create `meetingAnalysisService.cjs`
2. Implement summarization using existing AI provider
3. Implement sentiment analysis
4. Add key points extraction
5. Add action items detection

### Phase 5: MCP Tools Integration
1. Add meeting MCP tools to `MCP_TOOLS` array
2. Create endpoints: `/mcp/tools/meeting/*`
3. Add pattern matching in `chatStore.ts`
4. Test natural language queries

### Phase 6: UI Polish
1. Create `MeetingList.tsx` component
2. Add meeting list to sidebar or panel
3. Add transcript viewer
4. Add summary and sentiment display
5. Add search functionality

## 📦 Dependencies

### Frontend
```json
{
  "dependencies": {
    // No new dependencies needed - MediaRecorder is built-in
  }
}
```

### Backend
```json
{
  "dependencies": {
    "multer": "^1.4.5-lts.1", // For file uploads
    "openai": "^4.0.0", // For Whisper API (if using OpenAI)
    // OR
    "@google-cloud/speech": "^6.0.0" // For Google Speech-to-Text
  }
}
```

## 🔐 Environment Variables

```bash
# Transcription Service (Choose one)
OPENAI_API_KEY=sk-... # For Whisper API
# OR
GOOGLE_SPEECH_API_KEY=... # For Google Speech-to-Text
GOOGLE_SPEECH_PROJECT_ID=...

# Storage
RECORDINGS_DIR=./recordings # Default: webapp/server/recordings
MAX_RECORDING_DURATION=3600 # 1 hour in seconds
MAX_FILE_SIZE=500000000 # 500MB in bytes
```

## 💰 Cost Estimation

### OpenAI Whisper API
- **Transcription**: ~$0.006 per minute
- **1-hour meeting**: ~$0.36
- **Speaker diarization**: Included
- **Processing time**: ~30-60 seconds for 1 hour

### Google Speech-to-Text
- **Transcription**: ~$0.006 per minute
- **1-hour meeting**: ~$0.36
- **Speaker diarization**: Additional cost
- **Processing time**: ~30-60 seconds for 1 hour

### Local Whisper (Free)
- **Cost**: $0 (but requires GPU for reasonable speed)
- **Processing time**: 5-15 minutes for 1 hour (CPU) or 1-2 minutes (GPU)

## 🎯 Recommended Approach

**Phase 1: Start with OpenAI Whisper API**
- Best accuracy and features
- Speaker diarization included
- Fast processing
- Reasonable cost (~$0.36 per hour meeting)
- Easy integration

**Phase 2: Add Local Option**
- Allow users to choose local Whisper for cost savings
- Fallback if API unavailable

## 🚀 Quick Start Implementation

1. **Frontend Recording Component**
   - Use MediaRecorder API (browser native)
   - Capture audio from user's microphone
   - Show recording timer
   - Upload to backend on stop

2. **Backend Processing**
   - Receive audio file
   - Call OpenAI Whisper API
   - Store transcript and metadata
   - Return transcript to frontend

3. **MCP Tools**
   - Add pattern matching for meeting queries
   - Call analysis endpoints
   - Return formatted results

## 📝 Example User Flow

1. User clicks "Start Recording" button
2. Browser requests microphone permission
3. Recording starts, timer displays
4. User clicks "Stop Recording"
5. Audio file uploaded to backend
6. Backend processes with Whisper API
7. Transcript generated and stored
8. User can query: *"Summarize the latest meeting"*
9. AI analyzes transcript and returns summary

## 🔍 Future Enhancements

- Real-time transcription (streaming)
- Video recording support
- Multiple language support
- Export transcripts (PDF, DOCX)
- Integration with calendar (auto-record scheduled meetings)
- Cloud storage option (S3, Google Drive)
- Meeting templates and tags
- Search across all meetings
- Automatic action items extraction
- Integration with Jira (create tasks from action items)

---

**Ready to implement?** Let me know which transcription service you prefer, and I'll start building!

