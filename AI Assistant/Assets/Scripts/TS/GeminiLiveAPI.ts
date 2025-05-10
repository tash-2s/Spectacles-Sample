import NativeLogger from "../../SpectaclesInteractionKit/Utils/NativeLogger";
const log = new NativeLogger("GeminiLiveAPI");

@component
export class GeminiLiveAPI extends BaseScriptComponent {
  @input
  @hint("API Key for Gemini (do not hardcode in production)")
  apiKey: string = "Insert your Gemini API Key";

  @input
  @hint("Model name to use")
  model: string = "gemini-2.0-flash-live-001";

  @input
  @hint("Text component to display assistant responses")
  outputText: Text;

  @input
  @hint("Text component to display connection status")
  statusText: Text;

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
  @hint("Video frame interval in milliseconds")
  videoIntervalMs: number = 500; // Send frames every 500ms

  // Remote service module for WebSocket and HTTP requests
  private remoteServiceModule: RemoteServiceModule = require("LensStudio:RemoteServiceModule");
  private webSocket: WebSocket;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: number = 0;
  private isReconnecting: boolean = false;
  private sessionActive: boolean = false;
  private setupComplete: boolean = false;
  
  // Frame management
  private lastFrameTime: number = 0;

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

    // This is the new BidiGenerateContent endpoint that supports real-time audio streaming
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.apiKey)}`;
    
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

      this.webSocket.onmessage = async (event: any) => {
        log.d("Received message from Gemini");

        try {
          // Access data property safely (TypeScript doesn't know WebSocketEvent structure in Lens Studio)
          if (!event || !('data' in event)) {
            log.e("Invalid WebSocket message event");
            return;
          }

          // Convert to string if it's a blob
          let rawData: any = event.data;
          if (rawData instanceof Blob) {
            rawData = await rawData.text();
          }

          // Skip if no data
          if (!rawData) return;

          // Parse and handle the message
          const msg = JSON.parse(rawData.toString());
          this.handleServerMessage(msg);
        } catch (error) {
          log.e(`Error processing message: ${error}`);
        }
      };

      this.webSocket.onclose = () => {
        log.d("WebSocket connection closed");
        this.isConnected = false;
        this.sessionActive = false;
        this.setupComplete = false;
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
    this.setupComplete = false;
    
    try {
      this.webSocket.close();
      this.webSocket = null;
      this.isConnected = false;
      this.updateStatus("Disconnected");
    } catch (error) {
      log.e(`Error disconnecting: ${error}`);
    }
  }

  // Set up the Gemini Live session with the new format
  private setupSession() {
    if (!this.isConnected || !this.webSocket) {
      log.e("Cannot setup session: Not connected");
      return;
    }

    try {
      // Create setup message for Gemini Live with TEXT only response modality
      const setupMessage = {
        setup: {
          model: this.model,
          generationConfig: {
            responseModalities: ["TEXT"],
            temperature: 0.2,
            maxOutputTokens: 1024
          },
          systemInstruction: this.systemInstruction
        }
      };

      log.d("Sending setup message to Gemini Live");
      this.webSocket.send(JSON.stringify(setupMessage));
      this.sessionActive = true;
      this.updateStatus("Session setup");
    } catch (error) {
      log.e(`Error setting up session: ${error}`);
      this.updateStatus("Setup failed");
    }
  }

  // Send a video frame using the new realtimeInput format
  public sendVideoFrame(texture: Texture) {
    if (!this.sessionActive || !this.webSocket || !this.setupComplete) {
      log.d("Cannot send video frame: Session not ready");
      return;
    }

    // Check if we should send a frame based on the frame rate
    const currentTime = getTime();
    if ((currentTime - this.lastFrameTime) * 1000 < this.videoIntervalMs) {
      return; // Not time to send a frame yet
    }

    this.lastFrameTime = currentTime;

    // Encode texture to base64
    this.encodeTextureToBase64(texture)
      .then(base64Image => {
        try {
          const message = {
            realtimeInput: {
              video: base64Image
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

  // Send audio data using the new realtimeInput format
  public sendRealtimeAudio(base64Audio: string) {
    if (!this.sessionActive || !this.webSocket || !this.setupComplete) {
      log.d("Cannot send audio data: Session not ready");
      return;
    }

    try {
      const message = {
        realtimeInput: {
          audio: base64Audio
        }
      };

      this.webSocket.send(JSON.stringify(message));
    } catch (error) {
      log.e(`Error sending audio data: ${error}`);
    }
  }

  // Send text using the new realtimeInput format (not needed for our implementation)
  public sendText(text: string) {
    if (!this.sessionActive || !this.webSocket || !this.setupComplete) {
      log.d("Cannot send text: Session not ready");
      return;
    }

    try {
      const message = {
        realtimeInput: {
          text: text
        }
      };

      log.d(`Sending text to Gemini Live: ${text}`);
      this.webSocket.send(JSON.stringify(message));
    } catch (error) {
      log.e(`Error sending text: ${error}`);
    }
  }

  // Handle messages from Gemini with the new format
  private handleServerMessage(msg: any) {
    if (msg.setupComplete) {
      this.setupComplete = true;
      this.updateStatus("Session active");
      log.d("Gemini setupComplete received");
      return;
    }

    if (msg.serverContent && msg.serverContent.modelTurn) {
      const parts = msg.serverContent.modelTurn.parts ?? [];
      let text = "";
      
      // Collect all text from parts
      parts.forEach((p: any) => { 
        if (p.text) { 
          text += p.text; 
        } 
      });
      
      // Update UI with response
      if (text && this.outputText) {
        this.outputText.text = text;
        log.d("Gemini response: " + text);
      }
    }
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

  // Check if WebSocket is connected
  public isWebSocketConnected(): boolean {
    return this.isConnected;
  }

  // Check if session is active
  public isSessionActive(): boolean {
    return this.sessionActive && this.setupComplete;
  }
}