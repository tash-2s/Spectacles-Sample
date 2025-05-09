// @input Text outputText
// @input Text statusText
// @input Component.AudioComponent audioComponent
// @input Asset audioOutputAsset
// @input bool autoConnect = true
// @input int maxReconnectAttempts = 5
// @input float reconnectInterval = 3.0
// @input string systemInstruction = "You are a helpful AI assistant for Snap Spectacles. Keep responses concise and under 30 words. Be a little funny and keep it positive."
// @input string apiKey = "Insert your Gemini API Key"
// @input string model = "gemini-2.0-flash-live-preview-04-09"
// @ui {"widget":"combobox", "values":[{"label":"Aoede", "value":"Aoede"}, {"label":"Helios", "value":"Helios"}, {"label":"Lumin", "value":"Lumin"}, {"label":"Nova", "value":"Nova"}]}
// @input string voice = "Nova"

var NativeLogger = require("SpectaclesInteractionKit/Utils/NativeLogger");
var log = new NativeLogger("GeminiLiveAPI");

// Remote service module for WebSocket and HTTP requests
var remoteServiceModule = require("LensStudio:RemoteServiceModule");
var webSocket;
var isConnected = false;
var isProcessing = false;
var reconnectAttempts = 0;
var reconnectTimer = 0;
var isReconnecting = false;
var sessionActive = false;

// Frame management
var lastFrameTime = 0;
var frameInterval = 1.0; // 1 second between frames, as recommended by Gemini

// Audio processing state
var isCapturingAudio = false;
var audioBuffer = [];

script.createEvent("OnStartEvent").bind(function() {
    if (script.autoConnect) {
        connect();
    }
});

script.createEvent("UpdateEvent").bind(function() {
    update();
});

function update() {
    // Handle reconnection if needed
    if (isReconnecting) {
        reconnectTimer -= getDeltaTime();
        if (reconnectTimer <= 0) {
            attemptReconnect();
        }
    }
}

// Connect to the Gemini Live API WebSocket server
function connect() {
    if (isConnected) {
        log.d("Already connected to Gemini Live API");
        return;
    }

    if (!remoteServiceModule) {
        log.e("RemoteServiceModule is not assigned");
        updateStatus("Error: No RemoteServiceModule");
        return;
    }

    if (!script.apiKey) {
        log.e("API Key is missing. Please provide a valid Gemini API Key.");
        updateStatus("Error: No API Key");
        return;
    }

    var url = "wss://generativelanguage.googleapis.com/v1beta/models/" + script.model + ":streamGenerateContent?alt=websocket&key=" + script.apiKey;
    
    log.d("Connecting to Gemini Live API: " + script.model);
    updateStatus("Connecting...");

    try {
        // Create WebSocket using the RemoteServiceModule
        webSocket = remoteServiceModule.createWebSocket(url);
        webSocket.binaryType = 'blob';

        // Set up event handlers
        webSocket.onopen = function(event) {
            log.d("WebSocket connection established");
            isConnected = true;
            reconnectAttempts = 0;
            isReconnecting = false;
            updateStatus("Connected");
            
            // Send setup message
            setupSession();
        };

        webSocket.onmessage = function(message) {
            log.d("Received message from Gemini");
            handleMessage(message);
        };

        webSocket.onclose = function() {
            log.d("WebSocket connection closed");
            isConnected = false;
            sessionActive = false;
            updateStatus("Disconnected");
            
            // Start reconnection process
            if (!isReconnecting) {
                startReconnection();
            }
        };

        webSocket.onerror = function(event) {
            log.e("WebSocket error");
            updateStatus("Connection error");
        };
    } catch (error) {
        log.e("Error creating WebSocket: " + error);
        updateStatus("Connection failed");
        
        // Start reconnection process
        if (!isReconnecting) {
            startReconnection();
        }
    }
}

// Disconnect from the WebSocket server
function disconnect() {
    if (!isConnected || !webSocket) {
        log.d("Not connected to Gemini Live API");
        return;
    }

    log.d("Disconnecting from Gemini Live API");
    isReconnecting = false; // Stop any reconnection attempts
    sessionActive = false;
    
    try {
        webSocket.close();
        webSocket = null;
        isConnected = false;
        updateStatus("Disconnected");
    } catch (error) {
        log.e("Error disconnecting: " + error);
    }
}

// Set up the Gemini Live session
function setupSession() {
    if (!isConnected || !webSocket) {
        log.e("Cannot setup session: Not connected");
        return;
    }

    try {
        // Create setup message for Gemini Live
        var setupMessage = {
            setup: {
                model: script.model,
                generationConfig: {
                    responseModalities: ["AUDIO", "TEXT"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: script.voice
                            }
                        }
                    }
                },
                systemInstruction: {
                    parts: [{ text: script.systemInstruction }]
                }
            }
        };

        log.d("Sending setup message to Gemini Live");
        webSocket.send(JSON.stringify(setupMessage));
        sessionActive = true;
        updateStatus("Session active");
    } catch (error) {
        log.e("Error setting up session: " + error);
        updateStatus("Setup failed");
    }
}

// Send a video frame to Gemini
function sendVideoFrame(texture) {
    if (!sessionActive || !webSocket) {
        log.d("Cannot send video frame: Session not active");
        return;
    }

    // Check if we should send a frame based on the frame rate
    var currentTime = getTime();
    if (currentTime - lastFrameTime < frameInterval) {
        return; // Not time to send a frame yet
    }

    lastFrameTime = currentTime;

    // Encode texture to base64
    encodeTextureToBase64(texture)
        .then(function(base64Image) {
            try {
                var message = {
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
                webSocket.send(JSON.stringify(message));
            } catch (error) {
                log.e("Error sending video frame: " + error);
            }
        })
        .catch(function(error) {
            log.e("Error encoding texture: " + error);
        });
}

// Send audio data to Gemini
function sendAudioData(audioData) {
    if (!sessionActive || !webSocket) {
        log.d("Cannot send audio data: Session not active");
        return;
    }

    try {
        // Convert to base64
        var base64Audio = Base64.encode(audioData);
        
        var message = {
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
        webSocket.send(JSON.stringify(message));
    } catch (error) {
        log.e("Error sending audio data: " + error);
    }
}

// Handle messages from Gemini
function handleMessage(data) {
    try {
        // Parse the message data
        var messageData = data;
        
        // If data is a string, parse it as JSON
        if (typeof data === 'string') {
            messageData = JSON.parse(data);
        } 
        // If data is a MessageEvent (from WebSocket), extract the data property
        else if (data && data.data) {
            var dataStr = data.data.toString();
            messageData = JSON.parse(dataStr);
        }
        
        log.d("Processing Gemini message: " + JSON.stringify(messageData));
        
        // Handle different message types
        if (messageData.server_content) {
            processServerContent(messageData.server_content);
        } else if (messageData.state) {
            log.d("Session state update: " + messageData.state.state);
            
            if (messageData.state.state === "ENDED") {
                sessionActive = false;
                updateStatus("Session ended");
            }
        } else if (messageData.error) {
            log.e("Gemini API error: " + messageData.error.message);
            updateStatus("Error: " + messageData.error.message);
        }
    } catch (error) {
        log.e("Error processing message: " + error);
    }
}

// Process content from the server
function processServerContent(serverContent) {
    // Check for text responses
    if (serverContent.parts) {
        for (var i = 0; i < serverContent.parts.length; i++) {
            var part = serverContent.parts[i];
            if (part.text) {
                log.d("Received text response: " + part.text);
                if (script.outputText) {
                    script.outputText.text = part.text;
                }
            } else if (part.audio_part && part.audio_part.data) {
                log.d("Received audio response");
                processAudioResponse(part.audio_part.data);
            }
        }
    }
}

// Process audio response from Gemini
function processAudioResponse(base64Audio) {
    if (!script.audioComponent || !script.audioOutputAsset) {
        log.e("Audio component or audio output asset is missing");
        return;
    }

    try {
        // Decode base64 audio data
        var audioData = Base64.decode(base64Audio);
        
        // Convert to a format that can be played by the audio component
        var track = getAudioTrackFromData(audioData);
        script.audioComponent.audioTrack = track;
        script.audioComponent.play(1);
        
        log.d("Playing audio response");
    } catch (error) {
        log.e("Error processing audio response: " + error);
    }
}

// Convert audio data to AudioTrackAsset
function getAudioTrackFromData(audioData) {
    var outputAudioTrack = script.audioOutputAsset;
    if (!outputAudioTrack) {
        throw new Error("Failed to get Audio Output asset");
    }

    var sampleRate = 24000; // Gemini audio output is at 24kHz

    var BUFFER_SIZE = audioData.length / 2;
    log.d("Processing buffer size: " + BUFFER_SIZE);

    var audioOutput = outputAudioTrack.control;
    if (!audioOutput) {
        throw new Error("Failed to get audio output control");
    }

    audioOutput.sampleRate = sampleRate;
    var data = new Float32Array(BUFFER_SIZE);

    // Convert PCM16 to Float32
    for (var i = 0, j = 0; i < audioData.length; i += 2, j++) {
        var sample = ((audioData[i] | (audioData[i + 1] << 8)) << 16) >> 16;
        data[j] = sample / 32768;
    }

    var shape = new vec3(BUFFER_SIZE, 1, 1);
    shape.x = audioOutput.getPreferredFrameSize();

    // Enqueue audio frames in chunks
    var i = 0;
    while (i < BUFFER_SIZE) {
        try {
            var chunkSize = Math.min(shape.x, BUFFER_SIZE - i);
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
function encodeTextureToBase64(texture) {
    return new Promise(function(resolve, reject) {
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
function startReconnection() {
    if (isReconnecting) {
        return;
    }
    
    isReconnecting = true;
    reconnectAttempts = 0;
    reconnectTimer = script.reconnectInterval;
    log.d("Starting reconnection process");
    updateStatus("Reconnecting...");
}

// Attempt to reconnect to the WebSocket server
function attemptReconnect() {
    if (reconnectAttempts >= script.maxReconnectAttempts) {
        log.d("Maximum reconnection attempts reached");
        isReconnecting = false;
        updateStatus("Reconnection failed");
        return;
    }
    
    reconnectAttempts++;
    log.d("Attempting to reconnect (" + reconnectAttempts + "/" + script.maxReconnectAttempts + ")...");
    updateStatus("Reconnecting (" + reconnectAttempts + "/" + script.maxReconnectAttempts + ")...");
    
    connect();
    
    // Set timer for next attempt if this one fails
    reconnectTimer = script.reconnectInterval;
}

// Update the status text
function updateStatus(status) {
    if (script.statusText) {
        script.statusText.text = status;
    }
}

// Start capturing audio
function startAudioCapture() {
    isCapturingAudio = true;
    log.d("Started audio capture");
}

// Stop capturing audio
function stopAudioCapture() {
    isCapturingAudio = false;
    log.d("Stopped audio capture");
}

// Check if WebSocket is connected
function isWebSocketConnected() {
    return isConnected;
}

// Check if session is active
function isSessionActive() {
    return sessionActive;
}

// Expose public functions
script.api.connect = connect;
script.api.disconnect = disconnect;
script.api.sendVideoFrame = sendVideoFrame;
script.api.sendAudioData = sendAudioData;
script.api.startAudioCapture = startAudioCapture;
script.api.stopAudioCapture = stopAudioCapture;
script.api.isWebSocketConnected = isWebSocketConnected;
script.api.isSessionActive = isSessionActive;