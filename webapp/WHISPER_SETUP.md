# 🎙️ Local Whisper Setup Guide

This guide will help you set up local Whisper transcription for meeting recordings.

## Prerequisites

1. **Python 3.8+** installed on your system
2. **pip** (Python package manager)
3. **FFmpeg** (optional, but recommended for audio conversion)

## Installation Steps

### 1. Install Python

**Windows:**
- Download from [python.org](https://www.python.org/downloads/)
- During installation, check "Add Python to PATH"
- Verify installation: `python --version`

**macOS:**
```bash
# Using Homebrew
brew install python3

# Or download from python.org
```

**Linux:**
```bash
sudo apt-get update
sudo apt-get install python3 python3-pip
```

### 2. Install Whisper

Open a terminal/command prompt and run:

```bash
pip install openai-whisper
```

This will install Whisper and its dependencies (including PyTorch).

**Note:** The first time you use Whisper, it will download a model (base model is ~150MB). Larger models provide better accuracy but are slower.

### 3. Install FFmpeg (Optional but Recommended)

FFmpeg helps convert audio files to the format Whisper expects.

**Windows:**
- Download from [ffmpeg.org](https://ffmpeg.org/download.html)
- Extract and add to PATH, or use [chocolatey](https://chocolatey.org/): `choco install ffmpeg`

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

### 4. Verify Installation

Test that everything is working:

```bash
# Check Python
python --version

# Check Whisper
python -c "import whisper; print('Whisper installed successfully')"

# Check FFmpeg (if installed)
ffmpeg -version
```

## Model Selection

Whisper comes with several models. The default is `base`, which is a good balance of speed and accuracy:

- **tiny**: Fastest, least accurate (~39MB)
- **base**: Good balance (default, ~150MB)
- **small**: Better accuracy (~500MB)
- **medium**: High accuracy (~1.5GB)
- **large**: Best accuracy, slowest (~3GB)

You can change the model in `webapp/server/whisperService.cjs`:

```javascript
function transcribeAudio(audioPath, model = "base") {
  // Change "base" to "small", "medium", or "large" for better accuracy
}
```

## Troubleshooting

### "Python not found" Error

- Make sure Python is in your system PATH
- On Windows, restart your terminal after installing Python
- Try using `python3` instead of `python`

### "Whisper module not found" Error

- Make sure you installed Whisper: `pip install openai-whisper`
- Try: `pip3 install openai-whisper`
- On Windows, you might need: `py -m pip install openai-whisper`

### "FFmpeg not found" Warning

- This is not critical - Whisper can handle many audio formats directly
- For best results, install FFmpeg (see step 3 above)

### Slow Transcription

- Use a smaller model (tiny or base) for faster processing
- Larger models (medium, large) are more accurate but slower
- GPU acceleration is available but requires additional setup

### Out of Memory Errors

- Use a smaller model (tiny or base)
- Close other applications
- Process shorter audio files

## Testing the Setup

1. Start your application: `npm run dev:all`
2. Check Whisper status: Visit `http://localhost:3001/api/meetings/whisper/status`
3. You should see: `{"ok": true, "python": true, "whisper": true, "available": true}`

## Performance Expectations

For a 1-hour meeting:
- **tiny model**: ~2-3 minutes processing time
- **base model**: ~5-10 minutes processing time
- **small model**: ~10-15 minutes processing time
- **medium model**: ~20-30 minutes processing time
- **large model**: ~30-60 minutes processing time

*Times are approximate and depend on your CPU/GPU*

## GPU Acceleration (Optional)

For faster transcription, you can use GPU acceleration:

1. Install CUDA (NVIDIA GPUs) or ROCm (AMD GPUs)
2. Install PyTorch with CUDA support:
   ```bash
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```
3. Whisper will automatically use GPU if available

## Next Steps

Once Whisper is installed and verified:

1. Start recording meetings using the recording control in the right panel
2. After stopping a recording, transcription will start automatically
3. Once complete, you can query: *"Summarize the latest meeting"* or *"What is your sentiment analysis on latest meeting?"*

## Support

If you encounter issues:

1. Check the server console for error messages
2. Verify Python and Whisper are installed correctly
3. Check that audio files are being saved in `webapp/server/recordings/`
4. Review the troubleshooting section above

---

**Note:** Local Whisper is completely free and runs entirely on your machine. No API keys or internet connection required for transcription!

