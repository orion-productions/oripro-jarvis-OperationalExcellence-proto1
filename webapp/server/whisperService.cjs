// Local Whisper Transcription Service
// Uses Python subprocess to run Whisper for transcription

const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Check if Python and Whisper are available
 */
function checkWhisperAvailable() {
	return new Promise((resolve) => {
		// Check if Python is available
		const pythonCheck = spawn("python", ["--version"], { shell: true });
		let pythonAvailable = false;
		
		pythonCheck.on("close", (code) => {
			if (code === 0) {
				pythonAvailable = true;
			}
			
			// Check if whisper is installed
			if (pythonAvailable) {
				// On Windows, use exec with proper quoting to avoid shell parsing issues
				// Use exec instead of spawn to handle Windows command line better
				exec('python -c "import whisper; exit(0)"', { shell: true }, (error, stdout, stderr) => {
					const whisperAvailable = !error;
					if (!whisperAvailable) {
						console.error("[WhisperService] Whisper check failed. Error:", error?.message);
						console.error("[WhisperService] stderr:", stderr);
						console.error("[WhisperService] stdout:", stdout);
					} else {
						console.log("[WhisperService] Whisper is available!");
					}
					resolve({
						python: pythonAvailable,
						whisper: whisperAvailable,
						available: pythonAvailable && whisperAvailable
					});
				});
			} else {
				resolve({
					python: false,
					whisper: false,
					available: false
				});
			}
		});
		
		pythonCheck.on("error", () => {
			resolve({
				python: false,
				whisper: false,
				available: false
			});
		});
	});
}

/**
 * Convert audio file to WAV format (required by Whisper)
 * Uses ffmpeg if available, otherwise tries to use the file as-is
 */
function convertToWav(inputPath, outputPath) {
	return new Promise((resolve, reject) => {
		// Check if ffmpeg is available
		const ffmpegCheck = spawn("ffmpeg", ["-version"], { shell: true });
		
		ffmpegCheck.on("close", (code) => {
			if (code === 0) {
				// Use ffmpeg to convert
				const ffmpeg = spawn("ffmpeg", [
					"-i", inputPath,
					"-ar", "16000", // Sample rate 16kHz
					"-ac", "1", // Mono
					"-f", "wav",
					outputPath
				], { shell: true });
				
				ffmpeg.on("close", (ffmpegCode) => {
					if (ffmpegCode === 0) {
						resolve(outputPath);
					} else {
						reject(new Error(`FFmpeg conversion failed with code ${ffmpegCode}`));
					}
				});
				
				ffmpeg.on("error", (error) => {
					reject(error);
				});
				
				// Suppress ffmpeg output
				ffmpeg.stdout.on("data", () => {});
				ffmpeg.stderr.on("data", () => {});
			} else {
				// FFmpeg not available, try to use file as-is
				// Whisper can handle many formats, so this might work
				console.warn("[WhisperService] FFmpeg not available, using original file format");
				resolve(inputPath);
			}
		});
		
		ffmpegCheck.on("error", () => {
			// FFmpeg not available, use file as-is
			console.warn("[WhisperService] FFmpeg not available, using original file format");
			resolve(inputPath);
		});
	});
}

/**
 * Transcribe audio file using local Whisper
 * @param {string} audioPath - Path to audio file
 * @param {string} model - Whisper model to use (tiny, base, small, medium, large)
 * @returns {Promise<Object>} Transcript object with segments and fullText
 */
function transcribeAudio(audioPath, model = "base") {
	return new Promise(async (resolve, reject) => {
		try {
			// Check if Whisper is available
			const check = await checkWhisperAvailable();
			if (!check.available) {
				reject(new Error(`Whisper not available. Python: ${check.python}, Whisper: ${check.whisper}. Please install: pip install openai-whisper`));
				return;
			}
			
			// Convert to WAV if needed
			const audioDir = path.dirname(audioPath);
			const audioName = path.basename(audioPath, path.extname(audioPath));
			const wavPath = path.join(audioDir, `${audioName}.wav`);
			
			let finalAudioPath = audioPath;
			try {
				finalAudioPath = await convertToWav(audioPath, wavPath);
			} catch (error) {
				console.warn("[WhisperService] Audio conversion failed, using original:", error.message);
				finalAudioPath = audioPath;
			}
			
			// Create Python script to run Whisper
			const scriptPath = path.join(__dirname, "whisper_transcribe.py");
			// Normalize path for Windows - use forward slashes or raw string
			const normalizedAudioPath = finalAudioPath.replace(/\\/g, "/");
			const scriptContent = `
import whisper
import json
import sys
import os

audio_path = r"${finalAudioPath.replace(/\\/g, "\\\\")}"
model_name = "${model}"

try:
    print("Loading Whisper model...", file=sys.stderr)
    model = whisper.load_model(model_name)
    
    print(f"Transcribing audio: {audio_path}", file=sys.stderr)
    if not os.path.exists(audio_path):
        print(f"ERROR: Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)
    
    result = model.transcribe(audio_path, verbose=False, language="en", task="transcribe")
    
    # Format output
    segments = []
    full_text = result.get("text", "").strip()
    
    if not full_text:
        print("WARNING: Transcription returned empty text", file=sys.stderr)
        print(f"Result keys: {list(result.keys())}", file=sys.stderr)
        print(f"Segments count: {len(result.get('segments', []))}", file=sys.stderr)
    
    for item in result.get("segments", []):
        text = item.get("text", "").strip()
        if text:  # Only include non-empty segments
            segments.append({
                "start": item.get("start", 0),
                "end": item.get("end", 0),
                "text": text
            })
    
    output = {
        "language": result.get("language", "en"),
        "segments": segments,
        "fullText": full_text
    }
    
    print(json.dumps(output))
except Exception as e:
    print(f"ERROR: {str(e)}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)
`;
			
			// Write Python script
			fs.writeFileSync(scriptPath, scriptContent);
			
			// Run Python script
			const python = spawn("python", [scriptPath], { shell: true });
			
			let stdout = "";
			let stderr = "";
			
			python.stdout.on("data", (data) => {
				stdout += data.toString();
			});
			
			python.stderr.on("data", (data) => {
				stderr += data.toString();
				// Log all output to console for debugging
				const message = data.toString();
				console.log(`[WhisperService] ${message}`);
			});
			
			python.on("close", (code) => {
				// Clean up script file
				try {
					if (fs.existsSync(scriptPath)) {
						fs.unlinkSync(scriptPath);
					}
				} catch (error) {
					console.warn("[WhisperService] Error cleaning up script:", error);
				}
				
				if (code === 0) {
					try {
						const transcript = JSON.parse(stdout);
						resolve(transcript);
					} catch (error) {
						reject(new Error(`Failed to parse Whisper output: ${error.message}\nOutput: ${stdout}`));
					}
				} else {
					console.error(`[WhisperService] Transcription failed with code ${code}`);
					console.error(`[WhisperService] stderr: ${stderr}`);
					console.error(`[WhisperService] stdout: ${stdout}`);
					reject(new Error(`Whisper transcription failed (code ${code}): ${stderr || stdout || "Unknown error"}`));
				}
			});
			
			python.on("error", (error) => {
				reject(new Error(`Failed to start Whisper process: ${error.message}`));
			});
			
		} catch (error) {
			reject(error);
		}
	});
}

module.exports = {
	checkWhisperAvailable,
	transcribeAudio
};

