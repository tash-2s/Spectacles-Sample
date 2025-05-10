import { GeminiLiveAPI } from "./GeminiLiveAPI";
import { GeminiCameraAPI } from "./GeminiCameraAPI";
import { GeminiAudioAPI } from "./GeminiAudioAPI";
import NativeLogger from "../../SpectaclesInteractionKit/Utils/NativeLogger";
const log = new NativeLogger("GeminiController");

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

  @input
  @hint("Text component to display user query")
  queryText: Text;

  @input
  @hint("Text component to display assistant response")
  responseText: Text;

  @input
  @hint("Text component to display status")
  statusText: Text;

  private isAssistantActive: boolean = false;

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
      log.e("GeminiLiveAPI component is not assigned");
      this.updateStatus("Error: Missing GeminiLiveAPI");
      return false;
    }

    if (!this.geminiCameraAPI) {
      log.e("GeminiCameraAPI component is not assigned");
      this.updateStatus("Error: Missing GeminiCameraAPI");
      return false;
    }

    if (!this.geminiAudioAPI) {
      log.e("GeminiAudioAPI component is not assigned");
      this.updateStatus("Error: Missing GeminiAudioAPI");
      return false;
    }

    return true;
  }

  startAssistant() {
    log.d("Starting Gemini assistant");
    this.updateStatus("Starting assistant...");

    // Clear previous outputs
    if (this.responseText) {
      this.responseText.text = "";
    }

    // Connect to Gemini if not already connected
    if (!this.geminiLiveAPI.isWebSocketConnected()) {
      this.geminiLiveAPI.connect();
    }

    // Start capturing frames and audio
    this.geminiCameraAPI.startFrameCapture();
    this.geminiAudioAPI.startAudioCapture();

    this.isAssistantActive = true;
    this.updateStatus("Assistant active");
  }

  stopAssistant() {
    log.d("Stopping Gemini assistant");

    // Stop capturing frames and audio
    this.geminiCameraAPI.stopFrameCapture();
    this.geminiAudioAPI.stopAudioCapture();

    // We'll leave the connection open but stop sending data

    this.isAssistantActive = false;
    this.updateStatus("Assistant stopped");
  }

  // Update the status text
  private updateStatus(status: string) {
    if (this.statusText) {
      this.statusText.text = status;
    }
  }
}