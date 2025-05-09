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
    options.shouldReturnAudioWaveform = true; // Important for getting raw audio data
    options.waveformMaxDurationSec = 10; // Max buffer size
    
    this.voiceMLModule.onListeningEnabled.add(() => {
      this.voiceMLModule.startListening(options);
      this.voiceMLModule.onListeningUpdate.add(this.onListenUpdate);
    });
  }
  
  update() {
    if (this.isCapturingAudio && this.geminiLiveAPI && this.geminiLiveAPI.isSessionActive()) {
      const currentTime = getTime();
      if (currentTime - this.lastAudioSendTime >= this.audioSendInterval) {
        this.sendBufferedAudio();
        this.lastAudioSendTime = currentTime;
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
    }
    
    // Process audio data if available
    if (eventData.audioWaveform && this.isCapturingAudio) {
      this.processAudioData(eventData.audioWaveform);
    }
  };
  
  processAudioData(audioWaveform: VoiceML.AudioWaveform) {
    if (!audioWaveform || !this.isCapturingAudio) {
      return;
    }
    
    try {
      // Convert audio waveform to PCM format required by Gemini
      // Note: This implementation is simplified and may need adjustment based on 
      // the actual format provided by VoiceML.AudioWaveform
      
      const samples = audioWaveform.samples;
      if (!samples || samples.length === 0) {
        return;
      }
      
      // Create PCM buffer (16-bit signed, little-endian)
      const pcmBuffer = new Uint8Array(samples.length * 2);
      
      // Convert floating point samples (-1.0 to 1.0) to 16-bit PCM
      for (let i = 0; i < samples.length; i++) {
        // Convert to int16 range and clamp
        const sample = Math.max(-32768, Math.min(32767, Math.floor(samples[i] * 32767)));
        
        // Write as little-endian
        pcmBuffer[i * 2] = sample & 0xFF;
        pcmBuffer[i * 2 + 1] = (sample >> 8) & 0xFF;
      }
      
      // Add to buffer for sending
      this.audioBuffer.push(pcmBuffer);
      
    } catch (error) {
      log.e(`Error processing audio data: ${error}`);
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
    this.audioBuffer = [];
    
    // Enable VoiceML listening if not already enabled
    if (!this.voiceMLModule.isListening()) {
      this.voiceMLModule.enableListening();
    }
    
    log.d("Started audio capture for Gemini");
  }
  
  stopAudioCapture() {
    this.isCapturingAudio = false;
    
    // Send any remaining buffered audio
    if (this.audioBuffer.length > 0) {
      this.sendBufferedAudio();
    }
    
    log.d("Stopped audio capture for Gemini");
  }
  
  isCapturing(): boolean {
    return this.isCapturingAudio;
  }
}