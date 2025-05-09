
@component
export class TextToSpeechOpenAI extends BaseScriptComponent {
  @input audioComponent: AudioComponent;
  @input audioOutputAsset: Asset;

  @input
  @widget(
    new ComboBoxWidget()
      .addItem("Alloy", "alloy")
      .addItem("Echo", "echo")
      .addItem("Fable", "fable")
      .addItem("Onyx", "onyx")
      .addItem("Nova", "nova")
      .addItem("Shimmer", "shimmer")
  )
  voice: string = "alloy"; // Default voice selection

  @input
  @hint("API Key for OpenAI (do not hardcode in production)")
  apiKey: string = "Insert your OpenAI API Key";

  // Remote service module for fetching data
  private remoteServiceModule: RemoteServiceModule = require("LensStudio:RemoteServiceModule");

  onAwake() {
    if (!this.remoteServiceModule) {
      print("Remote Service Module is missing");
      return;
    }

    if (!this.audioComponent) {
      print("Audio Component is not assigned");
      return;
    }

    if (!this.apiKey || this.apiKey === "Insert your OpenAI API Key") {
      print("Valid OpenAI API Key is required");
      return;
    }

    if (!this.audioOutputAsset) {
      print("Audio Output asset is not assigned. Please assign an Audio Output asset in the Inspector.");
      return;
    }

    print("TextToSpeechOpenAI initialized successfully");
  }

  public async generateAndPlaySpeech(inputText: string) {
    if (!inputText) {
      print("No text provided for speech synthesis.");
      return;
    }

    // Skip API validation check - already done during initialization
    if (!this.remoteServiceModule || !this.audioComponent || !this.audioOutputAsset || !this.apiKey) {
      print("Cannot generate speech: Missing required components or API key");
      return;
    }

    try {
      const requestPayload = {
        model: "tts-1",
        voice: this.voice,
        input: inputText,
        response_format: "pcm",
      };

      const request = new Request("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestPayload),
      });

      print("Sending TTS request to OpenAI...");

      let response = await this.remoteServiceModule.fetch(request);
      print("Response status: " + response.status);

      if (response.status === 200) {
        try {
          const audioData = await response.bytes();
          print("Received audio data, length: " + audioData.length);

          const track = this.getAudioTrackFromData(audioData);
          this.audioComponent.audioTrack = track;
          this.audioComponent.play(1);

          print("Playing speech: " + inputText.substring(0, 50) + (inputText.length > 50 ? "..." : ""));
        } catch (processError) {
          print("Error processing audio data: " + processError);
        }
      } else {
        const errorText = await response.text();
        print("OpenAI API Error: " + response.status + " - " + errorText);
      }
    } catch (error) {
      print("Error generating speech: " + error);
    }
  }

  private getAudioTrackFromData(audioData: Uint8Array): AudioTrackAsset {
    let outputAudioTrack = this.audioOutputAsset as AudioTrackAsset; // Use the assigned asset
    if (!outputAudioTrack) {
      throw new Error("Failed to get Audio Output asset");
    }

    const sampleRate = 24000; // OpenAI TTS output is at 24kHz

    const BUFFER_SIZE = audioData.length / 2;
    print("Processing audio buffer size: " + BUFFER_SIZE);

    var audioOutput = outputAudioTrack.control as AudioOutputProvider;
    if (!audioOutput) {
      throw new Error("Failed to get audio output control");
    }

    audioOutput.sampleRate = sampleRate;
    var data = new Float32Array(BUFFER_SIZE);

    // Convert PCM16 to Float32
    for (let i = 0, j = 0; i < audioData.length; i += 2, j++) {
      const sample = ((audioData[i] | (audioData[i + 1] << 8)) << 16) >> 16;
      data[j] = sample / 32768;
    }

    const shape = new vec3(BUFFER_SIZE, 1, 1);
    shape.x = audioOutput.getPreferredFrameSize();

    // Enqueue audio frames in chunks
    let i = 0;
    while (i < BUFFER_SIZE) {
      try {
        const chunkSize = Math.min(shape.x, BUFFER_SIZE - i);
        shape.x = chunkSize;
        audioOutput.enqueueAudioFrame(data.subarray(i, i + chunkSize), shape);
        i += chunkSize;
      } catch (e) {
        throw new Error("Failed to enqueue audio frame - " + e);
      }
    }

    return outputAudioTrack;
  }
}
