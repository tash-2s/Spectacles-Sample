import { GeminiLiveAPI } from "./GeminiLiveAPI";

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
  @hint("Frame rate in seconds (Gemini recommends 1 frame per second)")
  frameInterval: number = 1.0;

  private isCapturingFrames: boolean = false;
  private lastFrameTime: number = 0;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.initializeCamera();
      // Camera initialization only - actual capture will be started by GeminiController
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

      this.cameraRequest.imageSmallerDimension = 320;

      this.cameraTexture = this.cameraModule.requestCamera(this.cameraRequest);
      this.cameraTextureProvider = this.cameraTexture.control as CameraTextureProvider;

      this.cameraTextureProvider.onNewFrame.add((cameraFrame) => {
        if (this.uiImage) {
          this.uiImage.mainPass.baseTex = this.cameraTexture;
        }
      });

      print("Camera initialized successfully");
    } catch (error) {
      print(`Error initializing camera: ${error}`);
    }
  }

  sendFrameToGemini() {
    if (!this.cameraTexture) {
      print("Camera texture not available");
      return;
    }

    if (!this.geminiLiveAPI) {
      print("GeminiLiveAPI component not assigned");
      return;
    }

    if (!this.geminiLiveAPI.isSessionActive()) {
      print("Gemini session not active, skipping frame");
      return;
    }

    // Send the current frame to Gemini
    this.geminiLiveAPI.sendVideoFrame(this.cameraTexture);
  }

  startFrameCapture() {
    this.isCapturingFrames = true;
    this.lastFrameTime = getTime();
    print("Started frame capture for Gemini");
  }

  stopFrameCapture() {
    this.isCapturingFrames = false;
    print("Stopped frame capture for Gemini");
  }

  isCapturing(): boolean {
    return this.isCapturingFrames;
  }
}
