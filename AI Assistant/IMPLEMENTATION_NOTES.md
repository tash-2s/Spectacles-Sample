# Gemini Live API Implementation for Spectacles AI Assistant

## Overview
This implementation replaces the original OpenAI-based AI Assistant with Google's Gemini Live API. The Gemini Live API allows for real-time streaming of both video frames from the camera and raw audio from the microphone, with text responses displayed as output. This implementation automatically starts on application launch without requiring user interaction.

## Components Created

### 1. GeminiLiveAPI
Core component that manages WebSocket connections with Gemini, handles session setup, and processes responses.
- Establishes WebSocket connection to Gemini Live API's BidiGenerateContent endpoint
- Manages session setup and configuration (TEXT responses only)
- Processes both video frames and audio input in real-time
- Handles streaming text responses from Gemini
- Can convert responses to speech using TextToSpeechOpenAI
- Includes automatic reconnection logic

### 2. GeminiCameraAPI
Captures camera frames at appropriate intervals and sends them to Gemini.
- Initializes Spectacles Camera API
- Captures and sends frames every 500ms (configurable)
- Converts frames to base64-encoded JPEG images
- Auto-initializes camera on startup

### 3. GeminiAudioAPI
Captures and streams raw microphone audio directly to Gemini.
- Uses MicrophoneAudioProvider to capture raw audio frames
- Converts audio from Float32 to Int16 format (required by Gemini)
- Streams audio data in real-time to Gemini Live API
- Handles audio buffer management

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

## Implementation Details

### Direct Audio Streaming
- Uses Lens Studio's MicrophoneAudioProvider to access raw microphone data
- Converts Float32 audio samples to Int16 format (required by Gemini)
- Streams audio frames directly to Gemini Live in base64-encoded format
- Processes audio in real-time during the Update loop

### BidiGenerateContent API Integration
- Uses the newer WebSocket endpoint: `/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
- Implements the realtimeInput message format for both audio and video
- Handles setupComplete confirmation from Gemini
- Processes modelTurn responses in streaming fashion

### Camera Integration
- Captures camera frames every 500ms (configurable via videoIntervalMs)
- Converts camera textures to base64-encoded JPEG images
- Sends images as part of the realtimeInput stream

### Auto-Start Functionality
- The assistant starts automatically when the app launches
- No manual interaction or button press is required
- Components initialize and connect automatically

## Setup Requirements
1. Replace the API key in GeminiLiveAPI component with your Gemini API key
2. Replace the API key in TextToSpeechOpenAI component with your OpenAI API key (if using speech output)
3. Set up a Microphone AudioTrack asset for raw audio capture
4. Attach components to appropriate scene objects
5. Connect UI elements (response text, camera display)

## Integration in Lens Studio
1. Import all four script files (.ts) into your Lens Studio project
2. Create an AudioTrack asset with Microphone Provider type
3. Add the scripts to separate Script Components in your scene
4. Set the API key in the GeminiLiveAPI component
5. Connect the components to each other via the Inspector panel:
   - GeminiController → GeminiLiveAPI, GeminiCameraAPI, GeminiAudioAPI
   - GeminiCameraAPI → GeminiLiveAPI
   - GeminiAudioAPI → GeminiLiveAPI + micAudioTrack (AudioTrack asset)
6. Connect UI elements:
   - Status text (to show connection status)
   - Response text (to display Gemini's responses)
   - Camera display (to show what the camera sees)

## Example Scene Setup
1. Create AudioTrack asset:
   - Project panel → Create → AudioTrack
   - Set Provider Type to "Microphone"

2. Create SceneObjects:
   - Camera object with GeminiCameraAPI component
   - UI object with Text component for response display
   - Controller object with GeminiController and GeminiLiveAPI components
   - Audio object with GeminiAudioAPI component
   - TTS object with TextToSpeechOpenAI component (if using speech output)

3. Connect components:
   - Assign the micAudioTrack to GeminiAudioAPI
   - Connect TextToSpeechOpenAI to GeminiLiveAPI (if using speech output)
   - Connect GeminiLiveAPI to both GeminiCameraAPI and GeminiAudioAPI
   - Connect all components to GeminiController

## Technical Notes

### Audio Format
- Gemini Live expects PCM audio with the following characteristics:
  - 16-bit signed integers
  - 16kHz sample rate (typically)
  - Mono channel
- The implementation handles conversion from Lens Studio's Float32 audio format

### WebSocket Handling
- Uses blob type for binary data handling
- Implements proper message parsing for both string and blob data types
- Handles connection state management and automatic reconnection

## Next Steps
- Test with actual Spectacles hardware
- Fine-tune audio quality and frame rate for optimal performance
- Add additional error handling for edge cases
- Consider implementing a proxy server for secure API key storage
