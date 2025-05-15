import { ToggleButton } from "SpectaclesInteractionKit.lspkg/Components/UI/ToggleButton/ToggleButton";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { VoiceMLTranscribeSingleton } from "./VoiceMLTranscribeSingleton";
import { PinchButton } from "SpectaclesInteractionKit.lspkg/Components/UI/PinchButton/PinchButton";
import { Widget } from "../Widget";
import Event, {
  PublicApi,
  unsubscribe,
} from "SpectaclesInteractionKit.lspkg/Utils/Event";

@component
export class VoiceNote extends BaseScriptComponent {
  //@input transcriber: VoiceMLTranscribe
  private transcriber: VoiceMLTranscribeSingleton;

  @input private textField: Text;
  @input private recordToggle: ToggleButton;
  @input private deleteButton: PinchButton;
  @input private noteInteractable: Interactable;
  @input private noteMesh: RenderMeshVisual;

  private lastHoveredTime: number = -1;
  private timeToShowButtonsAfterHover = 2;

  private widget: Widget;
  private meshMaterial: Material;

  private unsubscribeOnonTranscriptionFinalized: unsubscribe;

  private onPreRecordToggleChangeState: Event<boolean> = new Event<boolean>();
  readonly OnPreRecordToggleChangeState: PublicApi<boolean> =
    this.onPreRecordToggleChangeState.publicApi();

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      this.transcriber = VoiceMLTranscribeSingleton.getInstance();

      this.meshMaterial = this.noteMesh.mainMaterial.clone();
      this.noteMesh.mainMaterial = this.meshMaterial;

      this.recordToggle.onStateChanged.add(this.toggleIsRecording.bind(this));

      this.widget = this.sceneObject.getComponent(Widget.getTypeName());

      this.deleteButton.onButtonPinched.add(() => {
        this.widget.delete();
      });

      this.noteInteractable.onHoverUpdate.add(() => {
        this.lastHoveredTime = getTime();
      });
    });

    this.createEvent("UpdateEvent").bind(() => {
      if (getTime() - this.timeToShowButtonsAfterHover < this.lastHoveredTime) {
        this.recordToggle.getSceneObject().enabled = true;
        this.deleteButton.getSceneObject().enabled = true;
      } else {
        this.recordToggle.getSceneObject().enabled = false;
        this.deleteButton.getSceneObject().enabled = false;
      }
    });
  }

  private toggleIsRecording(isRecording: boolean): void {
    this.onPreRecordToggleChangeState.invoke(isRecording);

    if (isRecording) {
      this.transcriber.startListening(this.textField);
      this.unsubscribeOnonTranscriptionFinalized =
        this.transcriber.onTranscriptionFinalized.add(
          this.handleTranscriptionFinalized.bind(this)
        );
    } else {
      this.transcriber.stopListening();
      this.transcriber.onTranscriptionFinalized.remove(
        this.unsubscribeOnonTranscriptionFinalized
      );
    }

    const passCount = this.meshMaterial.getPassCount();
    if (passCount >= 2) {
      this.meshMaterial.getPass(1).strength = isRecording ? 1.0 : 0.0;
    }
  }

  private handleTranscriptionFinalized(): void {
    this.widget.updateContent();
  }

  /**
   * Set the recording state of the voice note
   * @param isRecording - the recording state
   */
  public toggleRecordButton(isRecording: boolean): void {
    if (this.recordToggle.isToggledOn === isRecording) {
      return;
    }

    this.recordToggle.toggle();
  }
}
