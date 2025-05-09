import { GeminiLiveAPI } from "./GeminiLiveAPI";
import { GeminiCameraAPI } from "./GeminiCameraAPI";
import { GeminiAudioAPI } from "./GeminiAudioAPI";

/**
 * Main controller for Gemini Live integration
 * Automatically starts and coordinates between camera, audio and Gemini API
 */
@component
export class GeminiController extends BaseScriptComponent {
  @input
  @hint("GeminiLiveAPI component")
  geminiLiveAPI: GeminiLiveAPI;

  @input
  @hint("GeminiCameraAPI component")
  geminiCameraAPI: GeminiCameraAPI;

  @input
  @hint("GeminiAudioAPI component")
  geminiAudioAPI: GeminiAudioAPI;

  // No UI text components required - responses are handled by GeminiLiveAPI

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart();
    });
  }

  onStart() {
    // Verify components are connected and start assistant automatically
    if (this.verifyComponents()) {
      this.startAssistant();
    }
  }

  verifyComponents() {
    if (!this.geminiLiveAPI) {
      print("GeminiLiveAPI component is not assigned");
      return false;
    }

    if (!this.geminiCameraAPI) {
      print("GeminiCameraAPI component is not assigned");
      return false;
    }

    if (!this.geminiAudioAPI) {
      print("GeminiAudioAPI component is not assigned");
      return false;
    }

    return true;
  }

  startAssistant() {
    print("Starting Gemini assistant");

    // Connect to Gemini if not already connected
    if (!this.geminiLiveAPI.isWebSocketConnected()) {
      this.geminiLiveAPI.connect();
    }

    // Start capturing frames and audio
    this.geminiCameraAPI.startFrameCapture();
    this.geminiAudioAPI.startAudioCapture();

    print("Assistant active");
  }

  stopAssistant() {
    print("Stopping Gemini assistant");

    // Stop capturing frames and audio
    this.geminiCameraAPI.stopFrameCapture();
    this.geminiAudioAPI.stopAudioCapture();

    // We'll leave the connection open but stop sending data

    print("Assistant stopped");
  }

}
