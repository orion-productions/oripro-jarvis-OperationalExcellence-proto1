import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../store/chatStore";
import { t, type Language } from "../i18n/translations";

interface RecordingControlProps {
	onRecordingComplete?: (meetingId: string, audioBlob: Blob) => void;
}

export function RecordingControl({ onRecordingComplete }: RecordingControlProps) {
	const { settings } = useChatStore();
	const currentLang = (settings.language || 'en') as Language;
	const [isRecording, setIsRecording] = useState(false);
	const [recordingTime, setRecordingTime] = useState(0);
	const [meetingId, setMeetingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [transcriptStatus, setTranscriptStatus] = useState<{ status: string; progress?: number; error?: string } | null>(null);
	
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const userStoppedRef = useRef<boolean>(false); // Track if user explicitly stopped

	// Format time as MM:SS
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	};

	// Start recording
	const startRecording = async () => {
		try {
			setError(null);
			userStoppedRef.current = false; // Reset flag when starting new recording
			
			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			streamRef.current = stream;
			
			// Check supported mime types
			const supportedTypes = [
				'audio/webm;codecs=opus',
				'audio/webm',
				'audio/ogg;codecs=opus',
				'audio/mp4',
				'audio/wav'
			];
			
			let mimeType = 'audio/webm';
			for (const type of supportedTypes) {
				if (MediaRecorder.isTypeSupported(type)) {
					mimeType = type;
					break;
				}
			}
			
			console.log(`[RecordingControl] Using mimeType: ${mimeType}`);
			
			// Create MediaRecorder
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType: mimeType
			});
			
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			
			// Handle errors
			mediaRecorder.onerror = (event: any) => {
				const error = event.error || event;
				console.error('[RecordingControl] MediaRecorder error:', error);
				console.error('[RecordingControl] Error name:', error?.name);
				console.error('[RecordingControl] Error message:', error?.message);
				setError(`Recording error: ${error?.message || 'Unknown error'}`);
				setIsRecording(false);
				if (timerRef.current) {
					clearInterval(timerRef.current);
					timerRef.current = null;
				}
				// Don't stop stream here - let onstop handle it if it fires
			};
			
			// Monitor state changes
			mediaRecorder.onstart = () => {
				console.log('[RecordingControl] MediaRecorder started');
			};
			
			mediaRecorder.onpause = () => {
				console.log('[RecordingControl] MediaRecorder paused');
			};
			
			mediaRecorder.onresume = () => {
				console.log('[RecordingControl] MediaRecorder resumed');
			};
			
			// Handle data available
			mediaRecorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) {
					audioChunksRef.current.push(event.data);
					console.log(`[RecordingControl] Data chunk received: ${event.data.size} bytes, total chunks: ${audioChunksRef.current.length}, recorder state: ${mediaRecorder.state}`);
				} else {
					console.warn(`[RecordingControl] Empty data chunk received, recorder state: ${mediaRecorder.state}`);
				}
			};
			
			// Handle stop
			mediaRecorder.onstop = async () => {
				console.log('[RecordingControl] onstop event fired, chunks:', audioChunksRef.current.length, 'userStopped:', userStoppedRef.current);
				
				// Check if this was an unexpected stop (not user-initiated and very short)
				if (!userStoppedRef.current && audioChunksRef.current.length < 10) {
					console.warn('[RecordingControl] Recording stopped unexpectedly after only', audioChunksRef.current.length, 'chunks');
					setError('Recording stopped unexpectedly. This may be due to browser limitations or microphone issues.');
				}
				
				// Reset the flag
				userStoppedRef.current = false;
				
				// Check if we have enough data
				if (audioChunksRef.current.length === 0) {
					console.error('[RecordingControl] No audio chunks collected!');
					setError('Recording stopped with no data. Please try again.');
					setIsRecording(false);
					if (streamRef.current) {
						streamRef.current.getTracks().forEach(track => track.stop());
						streamRef.current = null;
					}
					if (timerRef.current) {
						clearInterval(timerRef.current);
						timerRef.current = null;
					}
					return;
				}
				
				// Stop all tracks
				if (streamRef.current) {
					streamRef.current.getTracks().forEach(track => track.stop());
					streamRef.current = null;
				}
				
				// Clear timer
				if (timerRef.current) {
					clearInterval(timerRef.current);
					timerRef.current = null;
				}
				
				const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
				console.log('[RecordingControl] Audio blob created:', audioBlob.size, 'bytes');
				
				// Create meeting
				try {
					const response = await fetch("http://localhost:3001/api/meetings/start", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({})
					});
					
					// Check content type before parsing
					const contentType = response.headers.get("content-type");
					if (!contentType || !contentType.includes("application/json")) {
						const text = await response.text();
						console.error('[RecordingControl] Non-JSON response:', text.substring(0, 200));
						throw new Error(`Server returned ${response.status}: ${text.substring(0, 100)}`);
					}
					
					// Parse JSON once
					const jsonData = await response.json().catch(async (err) => {
						// If JSON parsing fails, try to get text
						const text = await response.text();
						console.error('[RecordingControl] JSON parse error:', err, 'Response:', text.substring(0, 200));
						throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
					});
					
					console.log('[RecordingControl] Meeting created response:', jsonData);
					
					if (!response.ok) {
						throw new Error(jsonData.error || `Failed to create meeting: ${response.status}`);
					}
					
					if (!jsonData.ok || !jsonData.meeting) {
						throw new Error(jsonData.error || "Invalid response from server");
					}
					
					const { meeting } = jsonData;
					setMeetingId(meeting.id);
					setTranscriptStatus({ status: "processing", progress: 0 }); // Initialize as processing
					
					// Upload audio
					const formData = new FormData();
					formData.append("audio", audioBlob, "recording.webm");
					formData.append("meetingId", meeting.id);
					
					console.log('[RecordingControl] Uploading audio, size:', audioBlob.size, 'bytes, meetingId:', meeting.id);
					
					const uploadResponse = await fetch("http://localhost:3001/api/meetings/upload", {
						method: "POST",
						body: formData
					});
					
					// Check content type before parsing
					const uploadContentType = uploadResponse.headers.get("content-type");
					if (!uploadContentType || !uploadContentType.includes("application/json")) {
						const text = await uploadResponse.text();
						console.error('[RecordingControl] Non-JSON upload response:', text.substring(0, 200));
						throw new Error(`Server returned ${uploadResponse.status}: ${text.substring(0, 100)}`);
					}
					
					// Parse JSON once
					const uploadJsonData = await uploadResponse.json().catch(async (err) => {
						// If JSON parsing fails, try to get text
						const text = await uploadResponse.text();
						console.error('[RecordingControl] Upload JSON parse error:', err, 'Response:', text.substring(0, 200));
						throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
					});
					
					console.log('[RecordingControl] Upload response:', uploadJsonData);
					
					if (!uploadResponse.ok) {
						throw new Error(uploadJsonData.error || `Failed to upload audio: ${uploadResponse.status}`);
					}
					
					if (onRecordingComplete) {
						onRecordingComplete(meeting.id, audioBlob);
					}
					
					setIsRecording(false);
					setRecordingTime(0);
					
				} catch (err) {
					setError(err instanceof Error ? err.message : "Failed to save recording");
				}
			};
			
			// Start recording (timeslice of 1000ms = collect data every second)
			// Some browsers work better without timeslice, but we'll use it for better data collection
			try {
				mediaRecorder.start(1000);
				console.log('[RecordingControl] Recording started');
			} catch (err) {
				console.error('[RecordingControl] Failed to start recording:', err);
				setError(err instanceof Error ? err.message : 'Failed to start recording');
				setIsRecording(false);
				if (streamRef.current) {
					streamRef.current.getTracks().forEach(track => track.stop());
					streamRef.current = null;
				}
				return;
			}
			
			setIsRecording(true);
			setRecordingTime(0);
			
			// Start timer
			timerRef.current = setInterval(() => {
				setRecordingTime(prev => {
					const newTime = prev + 1;
					// Stop at 1 hour (3600 seconds)
					if (newTime >= 3600) {
						if (timerRef.current) {
							clearInterval(timerRef.current);
							timerRef.current = null;
						}
						stopRecording();
						return 3600;
					}
					return newTime;
				});
			}, 1000);
			
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to access microphone");
			setIsRecording(false);
		}
	};

	// Stop recording
	const stopRecording = () => {
		console.log('[RecordingControl] stopRecording called, isRecording:', isRecording);
		
		// Mark that this is a user-initiated stop
		userStoppedRef.current = true;
		
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		
		if (mediaRecorderRef.current) {
			const state = mediaRecorderRef.current.state;
			console.log('[RecordingControl] MediaRecorder state:', state);
			if (state === 'recording' || state === 'paused') {
				try {
					mediaRecorderRef.current.stop();
					console.log('[RecordingControl] MediaRecorder.stop() called');
				} catch (err) {
					console.error('[RecordingControl] Error stopping MediaRecorder:', err);
				}
			}
		}
		
		// Don't stop stream here - let onstop handler do it
		setIsRecording(false);
	};

	// Poll meeting status for transcript progress
	useEffect(() => {
		if (!meetingId) {
			setTranscriptStatus(null);
			return;
		}
		
		let pollInterval: ReturnType<typeof setInterval> | null = null;
		
		const checkStatus = async () => {
			try {
				const response = await fetch(`http://localhost:3001/api/meetings/${meetingId}`);
				if (!response.ok) return;
				
				const contentType = response.headers.get("content-type");
				if (!contentType || !contentType.includes("application/json")) return;
				
				const jsonData = await response.json();
				if (jsonData.ok && jsonData.meeting) {
					const meeting = jsonData.meeting;
					
					if (meeting.status === "completed") {
						setTranscriptStatus({ status: "done" });
						if (pollInterval) {
							clearInterval(pollInterval);
							pollInterval = null;
						}
					} else if (meeting.status === "processing") {
						// Estimate progress based on time elapsed (rough estimate)
						// Transcription typically takes 1-2x the audio duration
						const meetingDate = new Date(meeting.date);
						const now = new Date();
						const elapsedSeconds = (now.getTime() - meetingDate.getTime()) / 1000;
						const estimatedDuration = meeting.duration || 60; // Default to 60 seconds if unknown
						// Assume transcription takes ~1.5x audio duration
						const estimatedTranscriptionTime = estimatedDuration * 1.5;
						const progress = Math.min(95, Math.floor((elapsedSeconds / estimatedTranscriptionTime) * 100));
						
						setTranscriptStatus({ status: "processing", progress });
					} else if (meeting.status === "error") {
						setTranscriptStatus({ 
							status: "error", 
							error: meeting.error || "Transcription failed" 
						});
						if (pollInterval) {
							clearInterval(pollInterval);
							pollInterval = null;
						}
					} else {
						setTranscriptStatus({ status: "pending" });
					}
				}
			} catch (err) {
				console.error('[RecordingControl] Error checking transcript status:', err);
			}
		};
		
		// Check immediately
		checkStatus();
		
		// Poll every 2 seconds
		pollInterval = setInterval(checkStatus, 2000);
		
		return () => {
			if (pollInterval) {
				clearInterval(pollInterval);
			}
		};
	}, [meetingId]);
	
	// Cleanup on unmount only
	useEffect(() => {
		return () => {
			// Only cleanup on unmount, not on isRecording change
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
			if (mediaRecorderRef.current) {
				const state = mediaRecorderRef.current.state;
				if (state === 'recording' || state === 'paused') {
					try {
						mediaRecorderRef.current.stop();
					} catch (err) {
						console.error('[RecordingControl] Error in cleanup:', err);
					}
				}
			}
			if (streamRef.current) {
				streamRef.current.getTracks().forEach(track => track.stop());
				streamRef.current = null;
			}
		};
	}, []); // Empty dependency array - only run on unmount

	return (
		<div className="p-4 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900">
			<div className="flex items-center gap-4">
				{isRecording ? (
					<>
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
							<span className="text-sm font-medium">{t('recording', currentLang)}</span>
						</div>
						<div className="text-lg font-mono font-bold">
							{formatTime(recordingTime)}
						</div>
						<button
							onClick={stopRecording}
							className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
						>
							{t('stopRecording', currentLang)}
						</button>
					</>
				) : (
					<>
						<button
							onClick={startRecording}
							className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium flex items-center gap-2"
						>
							<span>🎙️</span>
							{t('startRecording', currentLang)}
						</button>
						{recordingTime > 0 && (
							<span className="text-sm text-neutral-500">
								Last recording: {formatTime(recordingTime)}
							</span>
						)}
					</>
				)}
			</div>
			{error && (
				<div className="mt-2 text-sm text-red-600 dark:text-red-400">
					{error}
				</div>
			)}
			{meetingId && !isRecording && (
				<div className="mt-2 space-y-1">
					<div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
						<span>{t('meetingId', currentLang)}: {meetingId}</span>
						{transcriptStatus && (
							<span className={`font-medium ${
								transcriptStatus.status === "completed" || transcriptStatus.status === "done"
									? "text-green-600 dark:text-green-400"
									: transcriptStatus.status === "error"
										? "text-red-600 dark:text-red-400"
										: "text-blue-600 dark:text-blue-400"
							}`}>
								{transcriptStatus.status === "completed" || transcriptStatus.status === "done" 
									? `${t('transcriptProgress', currentLang)} ${t('transcriptDone', currentLang)}` 
									: transcriptStatus.progress !== undefined 
										? `${t('transcriptProgress', currentLang)} ${transcriptStatus.progress}%`
										: transcriptStatus.status === "processing"
											? `${t('transcriptProgress', currentLang)} ${t('transcriptionInProgress', currentLang)}`
											: transcriptStatus.status === "error"
												? `${t('transcriptProgress', currentLang)} ${t('transcriptError', currentLang)}`
												: `${t('transcriptProgress', currentLang)} pending`}
							</span>
						)}
					</div>
					{transcriptStatus?.error && (
						<div className="text-xs text-red-600 dark:text-red-400 mt-1">
							{transcriptStatus.error}
						</div>
					)}
					<button
						onClick={async () => {
							try {
								const response = await fetch(`http://localhost:3001/api/meetings/${meetingId}/retry-transcription`, {
									method: "POST"
								});
								
								// Check content type before parsing
								const contentType = response.headers.get("content-type");
								if (!contentType || !contentType.includes("application/json")) {
									const text = await response.text();
									console.error('[RecordingControl] Non-JSON retry response:', text.substring(0, 200));
									setError(`Server returned ${response.status}: ${text.substring(0, 100)}`);
									return;
								}
								
								// Parse JSON once
								const jsonData = await response.json().catch(async (err) => {
									const text = await response.text();
									console.error('[RecordingControl] Retry JSON parse error:', err, 'Response:', text.substring(0, 200));
									throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
								});
								
								if (response.ok && jsonData.ok) {
									setError(null);
									setTranscriptStatus({ status: "processing", progress: 0 }); // Reset to processing
									alert("Transcription retry started. Check back in a few minutes.");
								} else {
									setError(jsonData.error || "Failed to retry transcription");
								}
							} catch (err) {
								setError(err instanceof Error ? err.message : "Failed to retry transcription");
							}
						}}
						className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
					>
						{t('retryTranscription', currentLang)}
					</button>
				</div>
			)}
		</div>
	);
}

