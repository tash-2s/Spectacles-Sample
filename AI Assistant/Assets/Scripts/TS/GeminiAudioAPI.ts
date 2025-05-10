import { GeminiLiveAPI } from "./GeminiLiveAPI";
import NativeLogger from "../../SpectaclesInteractionKit/Utils/NativeLogger";
const log = new NativeLogger("GeminiAudioAPI");

/**
 * GeminiAudioAPI handles direct microphone audio capture and streaming to Gemini Live API
 * Uses Lens Studio's MicrophoneAudioProvider to capture raw audio frames
 */
@component
export class GeminiAudioAPI extends BaseScriptComponent {
  @input
  @hint("The GeminiLiveAPI component to stream audio to")
  geminiLiveAPI: GeminiLiveAPI;

  @input
  @hint("Audio track asset with Microphone Provider")
  micAudioTrack: AudioTrackAsset;

  // Microphone capture properties
  private micProvider: MicrophoneAudioProvider | null = null;
  private audioBuffer: Float32Array | null = null;
  private isCapturingAudio: boolean = false;
  
  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.initializeMicrophone();
    });
    
    // Add update event for regular audio frame capture
    this.createEvent("UpdateEvent").bind(() => {
      this.update();
    });
  }
  
  update() {
    if (this.isCapturingAudio && this.geminiLiveAPI && this.geminiLiveAPI.isSessionActive()) {
      this.captureAndSendAudioFrame();
    }
  }
  
  /**
   * Initialize microphone provider and audio buffer
   */
  initializeMicrophone() {
    if (!this.micAudioTrack) {
      log.e("Microphone audio track asset is not assigned");
      return;
    }
    
    try {
      // Get the microphone provider from the audio track
      const provider = this.micAudioTrack.control as MicrophoneAudioProvider;
      if (!provider) {
        log.e("Failed to get MicrophoneAudioProvider from audio track");
        return;
      }
      
      // Start the microphone (but don't capture yet)
      provider.start();
      this.micProvider = provider;
      
      // Create buffer sized to the provider's maximum frame size
      this.audioBuffer = new Float32Array(provider.maxFrameSize);
      
      log.d(`Microphone initialized (sample rate: ${provider.sampleRate}Hz)`);
    } catch (error) {
      log.e(`Error initializing microphone: ${error}`);
    }
  }
  
  /**
   * Capture a frame of audio data and send it to Gemini Live API
   */
  private captureAndSendAudioFrame() {
    if (!this.micProvider || !this.audioBuffer || !this.geminiLiveAPI) {
      return;
    }
    
    try {
      // Get audio frame from microphone (fills audioBuffer and returns shape)
      const shape = this.micProvider.getAudioFrame(this.audioBuffer);
      
      // Skip if no samples were captured
      if (shape.x <= 0) {
        return;
      }
      
      // Convert Float32 [-1,1] to Int16 [-32768,32767] for Gemini
      const int16 = new Int16Array(shape.x);
      for (let i = 0; i < shape.x; i++) {
        const sample = Math.max(-1, Math.min(1, this.audioBuffer[i]));
        int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
      
      // Encode audio as base64
      const base64Audio = Base64.encode(new Uint8Array(int16.buffer));
      
      // Send to Gemini Live API
      this.geminiLiveAPI.sendRealtimeAudio(base64Audio);
      
    } catch (error) {
      log.e(`Error capturing/sending audio frame: ${error}`);
    }
  }
  
  /**
   * Start capturing and streaming audio frames
   */
  startAudioCapture() {
    if (!this.geminiLiveAPI) {
      log.e("GeminiLiveAPI component not assigned");
      return;
    }
    
    if (!this.micProvider) {
      log.e("Microphone provider not initialized");
      return;
    }
    
    this.isCapturingAudio = true;
    log.d("Started audio capture for Gemini");
  }
  
  /**
   * Stop capturing and streaming audio frames
   */
  stopAudioCapture() {
    this.isCapturingAudio = false;
    log.d("Stopped audio capture for Gemini");
  }
  
  /**
   * Check if audio capture is active
   */
  isCapturing(): boolean {
    return this.isCapturingAudio;
  }
}