import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";
import { PinholeCameraModel } from "ObjectDetection/Scripts/TS/PinholeCameraModel";

@component
export class PinholeCapture extends BaseScriptComponent {
  private cameraModule: CameraModule = require("LensStudio:CameraModule");
  private cameraRequest: CameraModule.CameraRequest;
  cameraModel: any;
  cameraDevice: any;
  mainCamera: any;
  viewToWorld: any;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      // Initialize camera module and its dependencies
      this.cameraRequest = CameraModule.createCameraRequest();
      this.cameraRequest.cameraId = CameraModule.CameraId.Right_Color;
      const cameraTexture = this.cameraModule.requestCamera(this.cameraRequest);
      this.cameraDevice = global.deviceInfoSystem.getTrackingCameraForId(
        this.cameraRequest.cameraId
      );

      this.cameraModel = PinholeCameraModel.create(this.cameraDevice);

      this.mainCamera = WorldCameraFinderProvider.getInstance().getComponent();
    });
  }

  saveMatrix() {
    if (!this.mainCamera) {
      print("Error: mainCamera is not initialized");
      return false;
    }

    try {
      this.viewToWorld = this.mainCamera.getTransform().getWorldTransform();
      print("Matrix saved successfully");
      return true;
    } catch (e) {
      print("Error saving matrix: " + e);
      return false;
    }
  }

  worldToCapture(worldPos: vec3): vec2 {
    const viewPos = this.viewToWorld.inverse().multiplyPoint(worldPos);
    const capturePos = this.cameraDevice.pose.multiplyPoint(viewPos);
    const captureUV = this.cameraModel.projectToUV(capturePos);
    return captureUV;
  }

  captureToWorld(captureUV: vec2, depth: number): vec3 {
    if (!this.viewToWorld) {
      print("Error: viewToWorld matrix is undefined. Call saveMatrix() first.");
      // Return a default position or null
      return new vec3(0, 0, 0);
    }

    const capturePos = this.cameraModel.unprojectFromUV(captureUV, depth);
    const viewPos = this.cameraDevice.pose.inverse().multiplyPoint(capturePos);
    const worldPos = this.viewToWorld.multiplyPoint(viewPos);
    return worldPos;
  }
}
