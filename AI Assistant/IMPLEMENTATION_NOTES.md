# Gemini Live API Implementation for Spectacles AI Assistant

## Overview
This implementation replaces the original OpenAI-based AI Assistant with Google's Gemini Live API. The Gemini Live API allows for real-time streaming of video and audio data, with text responses displayed as output.

## Components Created

### 1. GeminiLiveAPI
Core component that manages WebSocket connections with Gemini, handles session setup, and processes responses.
- Establishes WebSocket connection to Gemini Live API
- Manages session setup and configuration
- Processes audio/video frames for sending
- Handles text and audio responses
- Includes reconnection logic

### 2. GeminiCameraAPI
Captures camera frames at appropriate intervals and sends them to Gemini.
- Initializes Spectacles Camera API
- Captures frames at 1 FPS (as recommended by Gemini)
- Sends frame data to GeminiLiveAPI component

### 3. GeminiAudioAPI
Manages audio capture using VoiceML and prepares data for Gemini.
- Uses VoiceML to capture audio and get transcriptions
- Converts waveform data to PCM format (16-bit, 16kHz)
- Buffers and sends audio chunks to GeminiLiveAPI

### 4. GeminiController
Coordinates all components and handles user interaction.
- Manages assistant state (active/inactive)
- Coordinates starting/stopping of camera and audio capture
- Handles user interaction through interactable component

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
- Configures response modalities for both TEXT and AUDIO
- Optimized for Spectacles performance (1 FPS video streaming)
- Handles both text and audio responses

### Audio Processing
- Captures audio using VoiceML
- Converts to PCM 16-bit format at 16kHz as required by Gemini
- Processes returned audio (24kHz PCM) for playback

### Setup Requirements
1. Replace the API key in GeminiLiveAPI component
2. Attach components to appropriate scene objects
3. Connect UI elements (status text, response text, camera display)
4. Configure an interactable element for activation

## Next Steps
- Test with actual Spectacles hardware
- Fine-tune audio processing for optimal quality
- Add additional error handling for edge cases
- Consider implementing a proxy server for secure API key storage
