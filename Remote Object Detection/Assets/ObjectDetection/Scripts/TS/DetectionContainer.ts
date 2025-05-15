import { Billboard } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard";
import { ClosedPolyline } from "./ClosedPolyline";

@component
export class DetectionContainer extends BaseScriptComponent {

    @input
    categoryAndConfidence: Text;

    @input
    distanceFromCamera: Text;

    @input
    polyline: ClosedPolyline;

    @input
    billboard: Billboard;

    @input
    public polylinePoints: SceneObject[]

    private _billboardOnUpdate: boolean;

    onAwake() {
        if (!this.polylinePoints || this.polylinePoints.length < 4) {
            print("Warning: Insufficient polyline points in NewScript");
        }
        this.createEvent('OnStartEvent').bind(() => {
            this.onStart();
        });
    }

    onStart() {
        // Initially enable the billboard
        this.billboard.enabled = true;
        print(`Billboard is active: ${this.billboard.enabled}`);

        // Create and setup the delayed event
        const delayedEvent = this.createEvent("DelayedCallbackEvent");
        delayedEvent.bind(() => {
            this.billboard.enabled = false;
            print(`Billboard is inactive after delay: ${this.billboard.enabled}`);
            
            // Apply the _billboardOnUpdate condition after delay
            if (this._billboardOnUpdate) {
                this.billboard.enabled = true;
            }
        });
        
        // Start the delay (2 seconds = 2)
        delayedEvent.reset(10);
        print("Billboard delay has started");
    }

    public setBillboardOnUpdate(enabled: boolean) {
        this._billboardOnUpdate = enabled;
        print(`Billboard on update: ${this._billboardOnUpdate}`);
    }
}