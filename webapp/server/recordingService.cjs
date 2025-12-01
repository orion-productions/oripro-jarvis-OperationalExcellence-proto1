// Meeting Recording Service
// Handles audio file storage and metadata management

const fs = require("fs");
const path = require("path");

const RECORDINGS_DIR = path.join(__dirname, "recordings");
const METADATA_FILE = path.join(RECORDINGS_DIR, "metadata.json");

// Ensure recordings directory exists
if (!fs.existsSync(RECORDINGS_DIR)) {
	fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// Initialize metadata file if it doesn't exist
if (!fs.existsSync(METADATA_FILE)) {
	fs.writeFileSync(METADATA_FILE, JSON.stringify({ meetings: [] }, null, 2));
}

/**
 * Generate a unique meeting ID
 */
function generateMeetingId() {
	const now = new Date();
	return `meeting-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
}

/**
 * Get all meetings metadata
 */
function getAllMeetings() {
	try {
		const data = fs.readFileSync(METADATA_FILE, "utf8");
		const metadata = JSON.parse(data);
		return metadata.meetings || [];
	} catch (error) {
		console.error("[RecordingService] Error reading metadata:", error);
		return [];
	}
}

/**
 * Get a specific meeting by ID
 */
function getMeeting(meetingId) {
	const meetings = getAllMeetings();
	return meetings.find(m => m.id === meetingId) || null;
}

/**
 * Save meeting metadata
 */
function saveMeeting(meetingData) {
	try {
		const meetings = getAllMeetings();
		const existingIndex = meetings.findIndex(m => m.id === meetingData.id);
		
		if (existingIndex >= 0) {
			meetings[existingIndex] = { ...meetings[existingIndex], ...meetingData };
		} else {
			meetings.push(meetingData);
		}
		
		// Sort by date (newest first)
		meetings.sort((a, b) => new Date(b.date) - new Date(a.date));
		
		fs.writeFileSync(METADATA_FILE, JSON.stringify({ meetings }, null, 2));
		return meetingData;
	} catch (error) {
		console.error("[RecordingService] Error saving meeting:", error);
		throw error;
	}
}

/**
 * Create a new meeting
 */
function createMeeting(title = null, participants = null) {
	const meetingId = generateMeetingId();
	const meetingDir = path.join(RECORDINGS_DIR, meetingId);
	
	// Create meeting directory
	if (!fs.existsSync(meetingDir)) {
		fs.mkdirSync(meetingDir, { recursive: true });
	}
	
	const meeting = {
		id: meetingId,
		title: title || `Meeting ${new Date().toLocaleString()}`,
		date: new Date().toISOString(),
		duration: 0,
		participants: participants || null,
		status: "recording",
		audioPath: null,
		transcriptPath: null,
		summary: null,
		sentiment: null,
		error: null
	};
	
	saveMeeting(meeting);
	return meeting;
}

/**
 * Update meeting with audio file
 */
function updateMeetingWithAudio(meetingId, audioBuffer, filename) {
	const meeting = getMeeting(meetingId);
	if (!meeting) {
		throw new Error(`Meeting ${meetingId} not found`);
	}
	
	const meetingDir = path.join(RECORDINGS_DIR, meetingId);
	const audioPath = path.join(meetingDir, filename || "audio.webm");
	
	// Save audio file
	fs.writeFileSync(audioPath, audioBuffer);
	
	// Update metadata
	meeting.audioPath = path.relative(__dirname, audioPath);
	meeting.status = "processing";
	meeting.duration = 0; // Will be calculated from audio file
	
	saveMeeting(meeting);
	return meeting;
}

/**
 * Update meeting with transcript
 */
function updateMeetingWithTranscript(meetingId, transcript) {
	const meeting = getMeeting(meetingId);
	if (!meeting) {
		throw new Error(`Meeting ${meetingId} not found`);
	}
	
	const meetingDir = path.join(RECORDINGS_DIR, meetingId);
	const transcriptPath = path.join(meetingDir, "transcript.json");
	
	// Save transcript
	fs.writeFileSync(transcriptPath, JSON.stringify(transcript, null, 2));
	
	// Update metadata
	meeting.transcriptPath = path.relative(__dirname, transcriptPath);
	meeting.status = "completed";
	
	// Calculate duration from transcript if available
	if (transcript.segments && transcript.segments.length > 0) {
		const lastSegment = transcript.segments[transcript.segments.length - 1];
		meeting.duration = Math.round(lastSegment.end || 0);
	}
	
	saveMeeting(meeting);
	return meeting;
}

/**
 * Get audio file path
 */
function getAudioPath(meetingId) {
	const meeting = getMeeting(meetingId);
	if (!meeting || !meeting.audioPath) {
		return null;
	}
	return path.join(__dirname, meeting.audioPath);
}

/**
 * Get transcript
 */
function getTranscript(meetingId) {
	const meeting = getMeeting(meetingId);
	if (!meeting || !meeting.transcriptPath) {
		return null;
	}
	
	try {
		const transcriptPath = path.join(__dirname, meeting.transcriptPath);
		const data = fs.readFileSync(transcriptPath, "utf8");
		return JSON.parse(data);
	} catch (error) {
		console.error("[RecordingService] Error reading transcript:", error);
		return null;
	}
}

/**
 * Update meeting analysis (summary, sentiment)
 */
function updateMeetingAnalysis(meetingId, analysis) {
	const meeting = getMeeting(meetingId);
	if (!meeting) {
		throw new Error(`Meeting ${meetingId} not found`);
	}
	
	if (analysis.summary) {
		meeting.summary = analysis.summary;
	}
	if (analysis.sentiment) {
		meeting.sentiment = analysis.sentiment;
	}
	
	saveMeeting(meeting);
	return meeting;
}

/**
 * Save meeting (internal helper)
 */
function saveMeeting(meetingData) {
	try {
		const meetings = getAllMeetings();
		const existingIndex = meetings.findIndex(m => m.id === meetingData.id);
		
		if (existingIndex >= 0) {
			meetings[existingIndex] = { ...meetings[existingIndex], ...meetingData };
		} else {
			meetings.push(meetingData);
		}
		
		// Sort by date (newest first)
		meetings.sort((a, b) => new Date(b.date) - new Date(a.date));
		
		fs.writeFileSync(METADATA_FILE, JSON.stringify({ meetings }, null, 2));
		return meetingData;
	} catch (error) {
		console.error("[RecordingService] Error saving meeting:", error);
		throw error;
	}
}

/**
 * Delete a meeting
 */
function deleteMeeting(meetingId) {
	const meeting = getMeeting(meetingId);
	if (!meeting) {
		return false;
	}
	
	// Remove meeting directory
	const meetingDir = path.join(RECORDINGS_DIR, meetingId);
	if (fs.existsSync(meetingDir)) {
		fs.rmSync(meetingDir, { recursive: true, force: true });
	}
	
	// Remove from metadata
	const meetings = getAllMeetings();
	const filtered = meetings.filter(m => m.id !== meetingId);
	fs.writeFileSync(METADATA_FILE, JSON.stringify({ meetings: filtered }, null, 2));
	
	return true;
}

module.exports = {
	RECORDINGS_DIR,
	generateMeetingId,
	getAllMeetings,
	getMeeting,
	createMeeting,
	updateMeetingWithAudio,
	updateMeetingWithTranscript,
	getAudioPath,
	getTranscript,
	updateMeetingAnalysis,
	deleteMeeting,
	saveMeeting
};

