// import required modules
const WorldQueryModule = require("LensStudio:WorldQueryModule");
const SIK = require("SpectaclesInteractionKit.lspkg/SIK").SIK;
const InteractorTriggerType =
  require("SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor").InteractorTriggerType;

// Import CameraService
import { CameraService, CameraType } from "./CameraService";
import { DetectionContainer } from "./DetectionContainer"; // Import DetectionContainer

@component
export class NewScript extends BaseScriptComponent {
  private hitTestSession: HitTestSession;
  private transform: Transform;
  private cameraService: CameraService;

  @input
  timeoutDuration: number = 10; // Default 10 seconds

  @input
  container: DetectionContainer;

  @input
  filterEnabled: boolean;

  private startTime: number;
  private isTimedOut: boolean = false;
  private targetObject: SceneObject;

  onAwake() {
    // Initialize CameraService
    this.cameraService = CameraService.getInstance();
    print("CameraService initialized in WorldQueryHitAdjuster");

    this.targetObject = this.sceneObject.getParent();

    // Start the timer
    this.startTime = getTime();
    this.isTimedOut = false;

    // create new hit session
    this.hitTestSession = this.createHitTestSession(this.filterEnabled);
    if (!this.sceneObject) {
      print("Please set Target Object input");
      return;
    }
    // create update event
    this.createEvent("UpdateEvent").bind(this.onUpdate.bind(this));
  }

  createHitTestSession(filterEnabled) {
    // create hit test session with options
    var options = HitTestSessionOptions.create();
    options.filter = filterEnabled;

    var session = WorldQueryModule.createHitTestSessionWithOptions(options);
    return session;
  }

  onHitTestResult(results) {
    if (results === null) {
      //this.targetObject.enabled = false;
    } else {
      this.targetObject.enabled = true;
      // get hit information
      const hitPosition = results.position;
      
      // Set position
      this.targetObject.getTransform().setWorldPosition(hitPosition);
      print("Hit Position: " + hitPosition);
      
      // Get camera position
      const cameraPos = this.getCameraPosition();
      
      // Calculate direction in the XZ plane (for y-axis rotation only)
      const lookDir = new vec3(
      cameraPos.x - hitPosition.x,
      0, // Zero out Y component for rotation only around Y axis
      cameraPos.z - hitPosition.z
      ).normalize();
      
      // Create rotation that only affects the y-axis
      const yRotation = quat.lookAt(lookDir, vec3.up());
      
      // Apply the rotation
      this.targetObject.getTransform().setWorldRotation(yRotation);
      
      // Update the container's distance
      const distance = (hitPosition.distance(cameraPos)).toFixed(2).replace(".", ",");
      this.container.distanceFromCamera.text = "Distance: " + distance + " cm";
    }
  }

  onUpdate() {
    // If we've already timed out, do nothing.
    if (this.isTimedOut) {
      return;
    }

    // Check if the timeout duration has been exceeded.
    if (getTime() - this.startTime > this.timeoutDuration) {
      print(
        "WorldQueryModuleAdjuster timed out after " +
          this.timeoutDuration +
          " seconds"
      );
      this.isTimedOut = true;
      return;
    }

    print("Updating...");

    const rayStart = this.getCameraPosition();
    const pos1 = this.getCameraPosition();
    const pos2 = this.targetObject.getTransform().getWorldPosition();
    const direction = new vec3(
      pos2.x - pos1.x,
      pos2.y - pos1.y,
      pos2.z - pos1.z
    );

    // Create rayEnd by manually adding scaled direction components.
    const rayEnd = new vec3(
      rayStart.x + direction.x * 1000,
      rayStart.y + direction.y * 1000,
      rayStart.z + direction.z * 1000
    );

    this.hitTestSession.hitTest(
      rayStart,
      rayEnd,
      this.onHitTestResult.bind(this)
    );
  }

  getCameraPosition(): vec3 {
    const mainCamera = this.cameraService.getCamera(CameraType.Main);
    return mainCamera.getTransform().getWorldPosition();
  }
}
