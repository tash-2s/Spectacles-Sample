// @input Image uiImage
// @input Component.ScriptComponent geminiLiveAPI
// @input bool autoStartFrames = false
// @input float frameInterval = 1.0

var NativeLogger = require("SpectaclesInteractionKit/Utils/NativeLogger");
var log = new NativeLogger("GeminiCameraAPI");

var cameraModule = require("LensStudio:CameraModule");
var cameraRequest;
var cameraTexture;
var cameraTextureProvider;

var isCapturingFrames = false;
var lastFrameTime = 0;

script.createEvent("OnStartEvent").bind(function() {
    initializeCamera();
    
    if (script.autoStartFrames) {
        startFrameCapture();
    }
});

script.createEvent("UpdateEvent").bind(function() {
    update();
});

function update() {
    if (isCapturingFrames && script.geminiLiveAPI && script.geminiLiveAPI.api.isSessionActive()) {
        var currentTime = getTime();
        if (currentTime - lastFrameTime >= script.frameInterval) {
            sendFrameToGemini();
            lastFrameTime = currentTime;
        }
    }
}

function initializeCamera() {
    try {
        cameraRequest = cameraModule.createCameraRequest();
        cameraRequest.cameraId = cameraModule.CameraId.Default_Color;

        cameraTexture = cameraModule.requestCamera(cameraRequest);
        cameraTextureProvider = cameraTexture.control;

        cameraTextureProvider.onNewFrame.add(function(cameraFrame) {
            if (script.uiImage) {
                script.uiImage.mainPass.baseTex = cameraTexture;
            }
        });
        
        log.d("Camera initialized successfully");
    } catch (error) {
        log.e("Error initializing camera: " + error);
    }
}

function sendFrameToGemini() {
    if (!cameraTexture) {
        log.e("Camera texture not available");
        return;
    }
    
    if (!script.geminiLiveAPI) {
        log.e("GeminiLiveAPI component not assigned");
        return;
    }
    
    if (!script.geminiLiveAPI.api.isSessionActive()) {
        log.d("Gemini session not active, skipping frame");
        return;
    }
    
    // Send the current frame to Gemini
    script.geminiLiveAPI.api.sendVideoFrame(cameraTexture);
}

function startFrameCapture() {
    isCapturingFrames = true;
    lastFrameTime = getTime();
    log.d("Started frame capture for Gemini");
}

function stopFrameCapture() {
    isCapturingFrames = false;
    log.d("Stopped frame capture for Gemini");
}

function isCapturing() {
    return isCapturingFrames;
}

// Expose public functions
script.api.startFrameCapture = startFrameCapture;
script.api.stopFrameCapture = stopFrameCapture;
script.api.isCapturing = isCapturing;
script.api.sendFrameToGemini = sendFrameToGemini;