import { GeminiLiveAPI } from "./GeminiLiveAPI";
import { GeminiCameraAPI } from "./GeminiCameraAPI";
import { GeminiAudioAPI } from "./GeminiAudioAPI";
import { Interactable } from "SpectaclesInteractionKit/Components/Interaction/Interactable/Interactable";
import { InteractorEvent } from "SpectaclesInteractionKit/Core/Interactor/InteractorEvent";
import { SIK } from "SpectaclesInteractionKit/SIK";
import NativeLogger from "../../SpectaclesInteractionKit/Utils/NativeLogger";
const log = new NativeLogger("GeminiController");

/**
 * Main controller for Gemini Live integration
 * Handles user interaction and coordinates between camera, audio and Gemini API
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
  @hint("Interactable for triggering the assistant")
  interactable: Interactable;
  
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
    let interactionManager = SIK.InteractionManager;

    // Define callback for interaction
    let onTriggerEndCallback = (event: InteractorEvent) => {
      this.handleTriggerEnd(event);
    };

    this.interactable.onInteractorTriggerEnd(onTriggerEndCallback);
    
    // Verify components are connected
    this.verifyComponents();
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

  async handleTriggerEnd(eventData) {
    if (!this.verifyComponents()) {
      return;
    }
    
    // Toggle assistant state
    this.isAssistantActive = !this.isAssistantActive;
    
    if (this.isAssistantActive) {
      this.startAssistant();
    } else {
      this.stopAssistant();
    }
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
    
    this.updateStatus("Assistant active");
  }
  
  stopAssistant() {
    log.d("Stopping Gemini assistant");
    
    // Stop capturing frames and audio
    this.geminiCameraAPI.stopFrameCapture();
    this.geminiAudioAPI.stopAudioCapture();
    
    // We'll leave the connection open but stop sending data
    
    this.updateStatus("Assistant stopped");
  }
  
  // Update the status text
  private updateStatus(status: string) {
    if (this.statusText) {
      this.statusText.text = status;
    }
  }
}