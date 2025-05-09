import { GeminiLiveAPI } from "./GeminiLiveAPI";
import NativeLogger from "../../SpectaclesInteractionKit/Utils/NativeLogger";
const log = new NativeLogger("GeminiCameraAPI");

@component
export class GeminiCameraAPI extends BaseScriptComponent {
  private cameraModule: CameraModule = require("LensStudio:CameraModule");
  private cameraRequest: CameraModule.CameraRequest;
  private cameraTexture: Texture;
  private cameraTextureProvider: CameraTextureProvider;

  @input
  @hint("The image in the scene that will be showing the captured frame")
  uiImage: Image | undefined;
  
  @input
  @hint("The GeminiLiveAPI component to send frames to")
  geminiLiveAPI: GeminiLiveAPI;
  
  @input
  @hint("Whether to automatically start sending frames to Gemini")
  autoStartFrames: boolean = false;
  
  @input
  @hint("Frame rate in seconds (Gemini recommends 1 frame per second)")
  frameInterval: number = 1.0;
  
  private isCapturingFrames: boolean = false;
  private lastFrameTime: number = 0;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.initializeCamera();
      
      if (this.autoStartFrames) {
        this.startFrameCapture();
      }
    });
    
    this.createEvent("UpdateEvent").bind(() => {
      this.update();
    });
  }
  
  update() {
    if (this.isCapturingFrames && this.geminiLiveAPI && this.geminiLiveAPI.isSessionActive()) {
      const currentTime = getTime();
      if (currentTime - this.lastFrameTime >= this.frameInterval) {
        this.sendFrameToGemini();
        this.lastFrameTime = currentTime;
      }
    }
  }

  initializeCamera() {
    try {
      this.cameraRequest = CameraModule.createCameraRequest();
      this.cameraRequest.cameraId = CameraModule.CameraId.Default_Color;

      this.cameraTexture = this.cameraModule.requestCamera(this.cameraRequest);
      this.cameraTextureProvider = this.cameraTexture.control as CameraTextureProvider;

      this.cameraTextureProvider.onNewFrame.add((cameraFrame) => {
        if (this.uiImage) {
          this.uiImage.mainPass.baseTex = this.cameraTexture;
        }
      });
      
      log.d("Camera initialized successfully");
    } catch (error) {
      log.e(`Error initializing camera: ${error}`);
    }
  }
  
  sendFrameToGemini() {
    if (!this.cameraTexture) {
      log.e("Camera texture not available");
      return;
    }
    
    if (!this.geminiLiveAPI) {
      log.e("GeminiLiveAPI component not assigned");
      return;
    }
    
    if (!this.geminiLiveAPI.isSessionActive()) {
      log.d("Gemini session not active, skipping frame");
      return;
    }
    
    // Send the current frame to Gemini
    this.geminiLiveAPI.sendVideoFrame(this.cameraTexture);
  }
  
  startFrameCapture() {
    this.isCapturingFrames = true;
    this.lastFrameTime = getTime();
    log.d("Started frame capture for Gemini");
  }
  
  stopFrameCapture() {
    this.isCapturingFrames = false;
    log.d("Stopped frame capture for Gemini");
  }
  
  isCapturing(): boolean {
    return this.isCapturingFrames;
  }
}