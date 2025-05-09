import NativeLogger from "../../SpectaclesInteractionKit/Utils/NativeLogger";
const log = new NativeLogger("GeminiLiveAPI");

@component
export class GeminiLiveAPI extends BaseScriptComponent {
  @input
  @hint("API Key for Gemini (do not hardcode in production)")
  apiKey: string = "Insert your Gemini API Key";

  @input
  @hint("Model name to use")
  model: string = "gemini-2.0-flash-live-preview-04-09";

  @input
  @hint("Text component to display assistant responses")
  outputText: Text;

  @input
  @hint("Text component to display connection status")
  statusText: Text;

  @input
  @hint("Audio component for speaking responses")
  audioComponent: AudioComponent;

  @input
  @hint("Audio output asset")
  audioOutputAsset: Asset;

  @input
  @hint("Auto-connect on start")
  autoConnect: boolean = true;

  @input
  @hint("Maximum reconnection attempts")
  maxReconnectAttempts: number = 5;

  @input
  @hint("Reconnection interval in seconds")
  reconnectInterval: number = 3.0;
  
  @input
  @hint("System instruction for assistant personality")
  systemInstruction: string = "You are a helpful AI assistant for Snap Spectacles. Keep responses concise and under 30 words. Be a little funny and keep it positive.";
  
  @input
  @widget(
    new ComboBoxWidget()
      .addItem("Aoede", "Aoede")
      .addItem("Helios", "Helios")
      .addItem("Lumin", "Lumin")
      .addItem("Nova", "Nova")
  )
  voice: string = "Nova"; // Default voice selection

  // Remote service module for WebSocket and HTTP requests
  private remoteServiceModule: RemoteServiceModule = require("LensStudio:RemoteServiceModule");
  private webSocket: WebSocket;
  private isConnected: boolean = false;
  private isProcessing: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: number = 0;
  private isReconnecting: boolean = false;
  private sessionActive: boolean = false;
  
  // Frame management
  private lastFrameTime: number = 0;
  private frameInterval: number = 1.0; // 1 second between frames, as recommended by Gemini
  
  // Audio processing state
  private isCapturingAudio: boolean = false;
  private audioBuffer: Uint8Array[] = [];

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      if (this.autoConnect) {
        this.connect();
      }
    });

    this.createEvent("UpdateEvent").bind(() => {
      this.update();
    });
  }

  update() {
    // Handle reconnection if needed
    if (this.isReconnecting) {
      this.reconnectTimer -= getDeltaTime();
      if (this.reconnectTimer <= 0) {
        this.attemptReconnect();
      }
    }
  }

  // Connect to the Gemini Live API WebSocket server
  public connect() {
    if (this.isConnected) {
      log.d("Already connected to Gemini Live API");
      return;
    }

    if (!this.remoteServiceModule) {
      log.e("RemoteServiceModule is not assigned");
      this.updateStatus("Error: No RemoteServiceModule");
      return;
    }

    if (!this.apiKey) {
      log.e("API Key is missing. Please provide a valid Gemini API Key.");
      this.updateStatus("Error: No API Key");
      return;
    }

    const url = `wss://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=websocket&key=${this.apiKey}`;
    
    log.d(`Connecting to Gemini Live API: ${this.model}`);
    this.updateStatus("Connecting...");

    try {
      // Create WebSocket using the RemoteServiceModule
      this.webSocket = this.remoteServiceModule.createWebSocket(url);
      this.webSocket.binaryType = 'blob';

      // Set up event handlers
      this.webSocket.onopen = (event) => {
        log.d("WebSocket connection established");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        this.updateStatus("Connected");
        
        // Send setup message
        this.setupSession();
      };

      this.webSocket.onmessage = (message) => {
        log.d("Received message from Gemini");
        this.handleMessage(message);
      };

      this.webSocket.onclose = () => {
        log.d("WebSocket connection closed");
        this.isConnected = false;
        this.sessionActive = false;
        this.updateStatus("Disconnected");
        
        // Start reconnection process
        if (!this.isReconnecting) {
          this.startReconnection();
        }
      };

      this.webSocket.onerror = (event) => {
        log.e("WebSocket error");
        this.updateStatus("Connection error");
      };
    } catch (error) {
      log.e(`Error creating WebSocket: ${error}`);
      this.updateStatus("Connection failed");
      
      // Start reconnection process
      if (!this.isReconnecting) {
        this.startReconnection();
      }
    }
  }

  // Disconnect from the WebSocket server
  public disconnect() {
    if (!this.isConnected || !this.webSocket) {
      log.d("Not connected to Gemini Live API");
      return;
    }

    log.d("Disconnecting from Gemini Live API");
    this.isReconnecting = false; // Stop any reconnection attempts
    this.sessionActive = false;
    
    try {
      this.webSocket.close();
      this.webSocket = null;
      this.isConnected = false;
      this.updateStatus("Disconnected");
    } catch (error) {
      log.e(`Error disconnecting: ${error}`);
    }
  }

  // Set up the Gemini Live session
  private setupSession() {
    if (!this.isConnected || !this.webSocket) {
      log.e("Cannot setup session: Not connected");
      return;
    }

    try {
      // Create setup message for Gemini Live
      const setupMessage = {
        setup: {
          model: this.model,
          generationConfig: {
            responseModalities: ["AUDIO", "TEXT"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: this.voice
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: this.systemInstruction }]
          }
        }
      };

      log.d("Sending setup message to Gemini Live");
      this.webSocket.send(JSON.stringify(setupMessage));
      this.sessionActive = true;
      this.updateStatus("Session active");
    } catch (error) {
      log.e(`Error setting up session: ${error}`);
      this.updateStatus("Setup failed");
    }
  }

  // Send a video frame to Gemini
  public sendVideoFrame(texture: Texture) {
    if (!this.sessionActive || !this.webSocket) {
      log.d("Cannot send video frame: Session not active");
      return;
    }

    // Check if we should send a frame based on the frame rate
    const currentTime = getTime();
    if (currentTime - this.lastFrameTime < this.frameInterval) {
      return; // Not time to send a frame yet
    }

    this.lastFrameTime = currentTime;

    // Encode texture to base64
    this.encodeTextureToBase64(texture)
      .then(base64Image => {
        try {
          const message = {
            client_content: {
              parts: [
                {
                  image_part: {
                    data: base64Image,
                    mime_type: "image/jpeg"
                  }
                }
              ]
            }
          };

          log.d("Sending video frame to Gemini Live");
          this.webSocket.send(JSON.stringify(message));
        } catch (error) {
          log.e(`Error sending video frame: ${error}`);
        }
      })
      .catch(error => {
        log.e(`Error encoding texture: ${error}`);
      });
  }

  // Send audio data to Gemini
  public sendAudioData(audioData: Uint8Array) {
    if (!this.sessionActive || !this.webSocket) {
      log.d("Cannot send audio data: Session not active");
      return;
    }

    try {
      // Convert to base64
      const base64Audio = Base64.encode(audioData);
      
      const message = {
        client_content: {
          parts: [
            {
              audio_part: {
                data: base64Audio,
                mime_type: "audio/x-raw;format=pcm16;rate=16000;channels=1"
              }
            }
          ]
        }
      };

      log.d("Sending audio data to Gemini Live");
      this.webSocket.send(JSON.stringify(message));
    } catch (error) {
      log.e(`Error sending audio data: ${error}`);
    }
  }

  // Handle messages from Gemini
  private handleMessage(data: any) {
    try {
      // Parse the message data
      let messageData = data;
      
      // If data is a string, parse it as JSON
      if (typeof data === 'string') {
        messageData = JSON.parse(data);
      } 
      // If data is a MessageEvent (from WebSocket), extract the data property
      else if (data && data.data) {
        const dataStr = data.data.toString();
        messageData = JSON.parse(dataStr);
      }
      
      log.d(`Processing Gemini message: ${JSON.stringify(messageData)}`);
      
      // Handle different message types
      if (messageData.server_content) {
        this.processServerContent(messageData.server_content);
      } else if (messageData.state) {
        log.d(`Session state update: ${messageData.state.state}`);
        
        if (messageData.state.state === "ENDED") {
          this.sessionActive = false;
          this.updateStatus("Session ended");
        }
      } else if (messageData.error) {
        log.e(`Gemini API error: ${messageData.error.message}`);
        this.updateStatus(`Error: ${messageData.error.message}`);
      }
    } catch (error) {
      log.e(`Error processing message: ${error}`);
    }
  }

  // Process content from the server
  private processServerContent(serverContent: any) {
    // Check for text responses
    if (serverContent.parts) {
      for (const part of serverContent.parts) {
        if (part.text) {
          log.d(`Received text response: ${part.text}`);
          if (this.outputText) {
            this.outputText.text = part.text;
          }
        } else if (part.audio_part && part.audio_part.data) {
          log.d("Received audio response");
          this.processAudioResponse(part.audio_part.data);
        }
      }
    }
  }

  // Process audio response from Gemini
  private processAudioResponse(base64Audio: string) {
    if (!this.audioComponent || !this.audioOutputAsset) {
      log.e("Audio component or audio output asset is missing");
      return;
    }

    try {
      // Decode base64 audio data
      const audioData = Base64.decode(base64Audio);
      
      // Convert to a format that can be played by the audio component
      const track = this.getAudioTrackFromData(audioData);
      this.audioComponent.audioTrack = track;
      this.audioComponent.play(1);
      
      log.d("Playing audio response");
    } catch (error) {
      log.e(`Error processing audio response: ${error}`);
    }
  }

  // Convert audio data to AudioTrackAsset
  private getAudioTrackFromData(audioData: Uint8Array): AudioTrackAsset {
    let outputAudioTrack = this.audioOutputAsset as AudioTrackAsset;
    if (!outputAudioTrack) {
      throw new Error("Failed to get Audio Output asset");
    }

    const sampleRate = 24000; // Gemini audio output is at 24kHz

    const BUFFER_SIZE = audioData.length / 2;
    log.d("Processing buffer size: " + BUFFER_SIZE);

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

  // Encode texture to base64
  private encodeTextureToBase64(texture: Texture): Promise<string> {
    return new Promise((resolve, reject) => {
      Base64.encodeTextureAsync(
        texture,
        resolve,
        reject,
        CompressionQuality.LowQuality,
        EncodingType.Jpg
      );
    });
  }

  // Start the reconnection process
  private startReconnection() {
    if (this.isReconnecting) {
      return;
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts = 0;
    this.reconnectTimer = this.reconnectInterval;
    log.d("Starting reconnection process");
    this.updateStatus("Reconnecting...");
  }

  // Attempt to reconnect to the WebSocket server
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.d("Maximum reconnection attempts reached");
      this.isReconnecting = false;
      this.updateStatus("Reconnection failed");
      return;
    }
    
    this.reconnectAttempts++;
    log.d(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    this.updateStatus(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    this.connect();
    
    // Set timer for next attempt if this one fails
    this.reconnectTimer = this.reconnectInterval;
  }

  // Update the status text
  private updateStatus(status: string) {
    if (this.statusText) {
      this.statusText.text = status;
    }
  }

  // Start capturing audio
  public startAudioCapture() {
    this.isCapturingAudio = true;
    log.d("Started audio capture");
  }

  // Stop capturing audio
  public stopAudioCapture() {
    this.isCapturingAudio = false;
    log.d("Stopped audio capture");
  }

  // Check if WebSocket is connected
  public isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  // Check if session is active
  public isSessionActive(): boolean {
    return this.sessionActive;
  }
}