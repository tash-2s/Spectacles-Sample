# Gemini Live API Implementation for Spectacles AI Assistant

## Overview
This implementation replaces the original OpenAI-based AI Assistant with Google's Gemini Live API. The Gemini Live API allows for real-time streaming of video and audio data from the user, with text responses displayed as output. This implementation automatically starts on application launch without requiring user interaction.

## Components Created

### 1. GeminiLiveAPI
Core component that manages WebSocket connections with Gemini, handles session setup, and processes responses.
- Establishes WebSocket connection to Gemini Live API
- Manages session setup and configuration (TEXT responses only)
- Processes audio/video frames for sending
- Handles text responses
- Includes reconnection logic

### 2. GeminiCameraAPI
Captures camera frames at appropriate intervals and sends them to Gemini.
- Initializes Spectacles Camera API
- Captures frames at 1 FPS (as recommended by Gemini)
- Sends frame data to GeminiLiveAPI component
- Auto-initializes camera on startup

### 3. GeminiAudioAPI
Manages audio capture using VoiceML and prepares data for Gemini.
- Uses VoiceML to capture audio and get transcriptions
- Converts waveform data to PCM format (16-bit, 16kHz)
- Buffers and sends audio chunks to GeminiLiveAPI
- Initializes VoiceML on startup

### 4. GeminiController
Coordinates all components with auto-start functionality.
- Automatically starts the assistant on application launch
- Manages assistant state (active/inactive)
- Coordinates starting/stopping of camera and audio capture
- No user interaction required to activate

## Files Created
- `/Assets/Scripts/TS/GeminiLiveAPI.ts`
- `/Assets/Scripts/TS/GeminiCameraAPI.ts`
- `/Assets/Scripts/TS/GeminiAudioAPI.ts`
- `/Assets/Scripts/TS/GeminiController.ts`

## Implementation Notes

### WebSocket Connection
- Uses RemoteServiceModule from Lens Studio to create WebSocket connections
- Handles binary data using blob type
- Implements reconnection logic with configurable retry attempts

### Gemini Live API
- Uses the streaming protocol with session-based communication
- Configures response modality for TEXT only (as per Gemini Live limitations)
- Optimized for Spectacles performance (1 FPS video streaming)
- No audio response processing (TEXT responses only)

### Audio Processing
- Captures audio using VoiceML
- Converts to PCM 16-bit format at 16kHz as required by Gemini
- Sends audio data for analysis by Gemini Live

### Setup Requirements
1. Replace the API key in GeminiLiveAPI component
2. Attach components to appropriate scene objects
3. Connect UI elements (status text, response text, camera display)
4. No interactable element needed - assistant starts automatically

## Integration in Lens Studio
1. Import all four script files (.ts) into your Lens Studio project
2. Add the scripts to separate Script Components in your scene
3. Set the API key in the GeminiLiveAPI component
4. Connect the components to each other via the Inspector panel:
   - GeminiController → GeminiLiveAPI, GeminiCameraAPI, GeminiAudioAPI
   - GeminiCameraAPI → GeminiLiveAPI
   - GeminiAudioAPI → GeminiLiveAPI
5. Connect UI elements (Text components) for status and response display
6. Assign a camera texture or image component for displaying camera feed

## Next Steps
- Test with actual Spectacles hardware
- Fine-tune speech recognition for optimal quality
- Add additional error handling for edge cases
- Consider implementing a proxy server for secure API key storage
