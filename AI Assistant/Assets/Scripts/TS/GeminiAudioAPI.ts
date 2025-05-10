import { GeminiLiveAPI } from "./GeminiLiveAPI";
import NativeLogger from "../../SpectaclesInteractionKit/Utils/NativeLogger";
const log = new NativeLogger("GeminiAudioAPI");

@component
export class GeminiAudioAPI extends BaseScriptComponent {
  @input
  @hint("The GeminiLiveAPI component to send audio to")
  geminiLiveAPI: GeminiLiveAPI;

  @input
  @hint("Text component to display user speech transcription")
  transcriptionText: Text;

  @input
  @hint("Whether to automatically start capturing audio")
  autoStartAudio: boolean = false;

  // Voice ML module for speech recognition
  private voiceMLModule: VoiceMLModule = require("LensStudio:VoiceMLModule");
  private isCapturingAudio: boolean = false;
  private audioBuffer: Uint8Array[] = [];

  // Buffer management
  private readonly AUDIO_CHUNK_SIZE = 8192; // Size of audio chunks to send
  private lastAudioSendTime: number = 0;
  private audioSendInterval: number = 0.1; // Send audio every 100ms

  // Simulated audio data for testing
  private simulateAudioTimer: number = 0;
  private simulateAudioInterval: number = 0.5; // Simulate audio every 500ms

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      if (this.autoStartAudio) {
        this.startAudioCapture();
      }
    });

    this.createEvent("UpdateEvent").bind(() => {
      this.update();
    });

    // Set up VoiceML for transcription
    let options = VoiceML.ListeningOptions.create();
    options.shouldReturnAsrTranscription = true;
    options.shouldReturnInterimAsrTranscription = true;

    this.voiceMLModule.onListeningEnabled.add(() => {
      this.voiceMLModule.startListening(options);
      this.voiceMLModule.onListeningUpdate.add(this.onListenUpdate);
    });
  }

  update() {
    if (this.isCapturingAudio && this.geminiLiveAPI && this.geminiLiveAPI.isSessionActive()) {
      const currentTime = getTime();

      // Check if it's time to send buffered audio
      if (currentTime - this.lastAudioSendTime >= this.audioSendInterval) {
        this.sendBufferedAudio();
        this.lastAudioSendTime = currentTime;
      }

      // Simulate audio data if we don't have real waveform data
      this.simulateAudioTimer -= getDeltaTime();
      if (this.simulateAudioTimer <= 0) {
        this.simulateAudioData();
        this.simulateAudioTimer = this.simulateAudioInterval;
      }
    }
  }

  onListenUpdate = (eventData: VoiceML.ListeningUpdateEventArgs) => {
    // Handle transcription
    if (eventData.isFinalTranscription) {
      if (this.transcriptionText) {
        this.transcriptionText.text = eventData.transcription;
      }
      log.d(`Transcription: ${eventData.transcription}`);

      // When we get transcription, simulate audio data based on it
      if (eventData.transcription && eventData.transcription.length > 0) {
        this.simulateAudioFromTranscription(eventData.transcription);
      }
    }
  };

  // Since waveform data isn't available, we'll simulate audio data
  simulateAudioData() {
    if (!this.isCapturingAudio) {
      return;
    }

    try {
      // Create a small buffer of "silence" with occasional noise
      // This will just keep the connection alive
      const sampleCount = 1600; // 100ms of audio at 16kHz
      const pcmBuffer = new Uint8Array(sampleCount * 2);

      // Add to buffer for sending
      this.audioBuffer.push(pcmBuffer);

      log.d("Simulated audio data (silence)");
    } catch (error) {
      log.e(`Error simulating audio data: ${error}`);
    }
  }

  // Generate audio data based on transcription text (just a simulation)
  simulateAudioFromTranscription(text: string) {
    if (!this.isCapturingAudio) {
      return;
    }

    try {
      // Create a buffer with some "noise" proportional to text length
      // This is just a simulation - in real life we'd need actual audio data
      const sampleCount = Math.max(1600, text.length * 100);
      const pcmBuffer = new Uint8Array(sampleCount * 2);

      // Add some "audio data" pattern based on text
      for (let i = 0; i < sampleCount; i++) {
        // Create some variation based on character codes
        const charIndex = i % text.length;
        const charCode = text.charCodeAt(charIndex);

        // Create a simple pattern based on character code
        const sample = Math.sin(i * 0.01 * (charCode % 10)) * 5000;
        const sampleInt = Math.floor(sample);

        // Write as little-endian
        pcmBuffer[i * 2] = sampleInt & 0xFF;
        pcmBuffer[i * 2 + 1] = (sampleInt >> 8) & 0xFF;
      }

      // Add to buffer for sending
      this.audioBuffer.push(pcmBuffer);

      log.d(`Simulated audio data based on transcription (${text.length} chars)`);
    } catch (error) {
      log.e(`Error simulating audio from transcription: ${error}`);
    }
  }

  sendBufferedAudio() {
    if (!this.geminiLiveAPI || !this.geminiLiveAPI.isSessionActive() || this.audioBuffer.length === 0) {
      return;
    }

    try {
      // Combine all buffered chunks
      let totalLength = 0;
      for (const chunk of this.audioBuffer) {
        totalLength += chunk.length;
      }

      const combinedBuffer = new Uint8Array(totalLength);
      let offset = 0;

      for (const chunk of this.audioBuffer) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // Send to Gemini
      this.geminiLiveAPI.sendAudioData(combinedBuffer);

      // Clear buffer after sending
      this.audioBuffer = [];

    } catch (error) {
      log.e(`Error sending audio data: ${error}`);
    }
  }

  startAudioCapture() {
    if (!this.geminiLiveAPI) {
      log.e("GeminiLiveAPI component not assigned");
      return;
    }

    this.isCapturingAudio = true;
    this.lastAudioSendTime = getTime();
    this.simulateAudioTimer = 0; // Start simulating immediately
    this.audioBuffer = [];

    // Start VoiceML listening if it's not already active
    try {
      this.voiceMLModule.startListening(VoiceML.ListeningOptions.create());
      log.d("Started VoiceML listening");
    } catch (error) {
      log.e(`Error starting VoiceML listening: ${error}`);
    }

    log.d("Started audio capture for Gemini");
  }

  stopAudioCapture() {
    this.isCapturingAudio = false;

    // Send any remaining buffered audio
    if (this.audioBuffer.length > 0) {
      this.sendBufferedAudio();
    }

    // Stop VoiceML listening
    try {
      this.voiceMLModule.stopListening();
    } catch (error) {
      log.e(`Error stopping VoiceML listening: ${error}`);
    }

    log.d("Stopped audio capture for Gemini");
  }

  isCapturing(): boolean {
    return this.isCapturingAudio;
  }
}