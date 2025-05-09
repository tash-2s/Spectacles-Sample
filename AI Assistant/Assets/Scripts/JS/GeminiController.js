// @input Component.ScriptComponent geminiLiveAPI
// @input Component.ScriptComponent geminiCameraAPI
// @input Component.ScriptComponent geminiAudioAPI
// @input Component interactable
// @input Text queryText
// @input Text responseText
// @input Text statusText

var NativeLogger = require("SpectaclesInteractionKit/Utils/NativeLogger");
var log = new NativeLogger("GeminiController");

// Import SIK modules
var SIK = require("SpectaclesInteractionKit/SIK");

var isAssistantActive = false;

script.createEvent("OnStartEvent").bind(function() {
    onStart();
});

function onStart() {
    var interactionManager = SIK.InteractionManager;

    // Define callback for interaction
    var onTriggerEndCallback = function(event) {
        handleTriggerEnd(event);
    };

    script.interactable.onInteractorTriggerEnd(onTriggerEndCallback);
    
    // Verify components are connected
    verifyComponents();
}

function verifyComponents() {
    if (!script.geminiLiveAPI) {
        log.e("GeminiLiveAPI component is not assigned");
        updateStatus("Error: Missing GeminiLiveAPI");
        return false;
    }
    
    if (!script.geminiCameraAPI) {
        log.e("GeminiCameraAPI component is not assigned");
        updateStatus("Error: Missing GeminiCameraAPI");
        return false;
    }
    
    if (!script.geminiAudioAPI) {
        log.e("GeminiAudioAPI component is not assigned");
        updateStatus("Error: Missing GeminiAudioAPI");
        return false;
    }
    
    return true;
}

function handleTriggerEnd(eventData) {
    if (!verifyComponents()) {
        return;
    }
    
    // Toggle assistant state
    isAssistantActive = !isAssistantActive;
    
    if (isAssistantActive) {
        startAssistant();
    } else {
        stopAssistant();
    }
}

function startAssistant() {
    log.d("Starting Gemini assistant");
    updateStatus("Starting assistant...");
    
    // Clear previous outputs
    if (script.responseText) {
        script.responseText.text = "";
    }
    
    // Connect to Gemini if not already connected
    if (!script.geminiLiveAPI.api.isWebSocketConnected()) {
        script.geminiLiveAPI.api.connect();
    }
    
    // Start capturing frames and audio
    script.geminiCameraAPI.api.startFrameCapture();
    script.geminiAudioAPI.api.startAudioCapture();
    
    updateStatus("Assistant active");
}

function stopAssistant() {
    log.d("Stopping Gemini assistant");
    
    // Stop capturing frames and audio
    script.geminiCameraAPI.api.stopFrameCapture();
    script.geminiAudioAPI.api.stopAudioCapture();
    
    // We'll leave the connection open but stop sending data
    
    updateStatus("Assistant stopped");
}

// Update the status text
function updateStatus(status) {
    if (script.statusText) {
        script.statusText.text = status;
    }
}

// Expose public functions
script.api.startAssistant = startAssistant;
script.api.stopAssistant = stopAssistant;