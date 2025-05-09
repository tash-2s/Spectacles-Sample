// @input Component.ScriptComponent geminiLiveAPI
// @input Text transcriptionText
// @input bool autoStartAudio = false

var NativeLogger = require("SpectaclesInteractionKit/Utils/NativeLogger");
var log = new NativeLogger("GeminiAudioAPI");

// Voice ML module for speech recognition
var voiceMLModule = require("LensStudio:VoiceMLModule");
var isCapturingAudio = false;
var audioBuffer = [];

// Buffer management
var AUDIO_CHUNK_SIZE = 8192; // Size of audio chunks to send
var lastAudioSendTime = 0;
var audioSendInterval = 0.1; // Send audio every 100ms

script.createEvent("OnStartEvent").bind(function() {
    if (script.autoStartAudio) {
        startAudioCapture();
    }
    
    // Set up VoiceML for transcription
    var options = VoiceML.ListeningOptions.create();
    options.shouldReturnAsrTranscription = true;
    options.shouldReturnInterimAsrTranscription = true;
    options.shouldReturnAudioWaveform = true; // Important for getting raw audio data
    options.waveformMaxDurationSec = 10; // Max buffer size
    
    voiceMLModule.onListeningEnabled.add(function() {
        voiceMLModule.startListening(options);
        voiceMLModule.onListeningUpdate.add(onListenUpdate);
    });
});

script.createEvent("UpdateEvent").bind(function() {
    update();
});

function update() {
    if (isCapturingAudio && script.geminiLiveAPI && script.geminiLiveAPI.api.isSessionActive()) {
        var currentTime = getTime();
        if (currentTime - lastAudioSendTime >= audioSendInterval) {
            sendBufferedAudio();
            lastAudioSendTime = currentTime;
        }
    }
}

function onListenUpdate(eventData) {
    // Handle transcription
    if (eventData.isFinalTranscription) {
        if (script.transcriptionText) {
            script.transcriptionText.text = eventData.transcription;
        }
        log.d("Transcription: " + eventData.transcription);
    }
    
    // Process audio data if available
    if (eventData.audioWaveform && isCapturingAudio) {
        processAudioData(eventData.audioWaveform);
    }
}

function processAudioData(audioWaveform) {
    if (!audioWaveform || !isCapturingAudio) {
        return;
    }
    
    try {
        // Convert audio waveform to PCM format required by Gemini
        // Note: This implementation is simplified and may need adjustment based on 
        // the actual format provided by VoiceML.AudioWaveform
        
        var samples = audioWaveform.samples;
        if (!samples || samples.length === 0) {
            return;
        }
        
        // Create PCM buffer (16-bit signed, little-endian)
        var pcmBuffer = new Uint8Array(samples.length * 2);
        
        // Convert floating point samples (-1.0 to 1.0) to 16-bit PCM
        for (var i = 0; i < samples.length; i++) {
            // Convert to int16 range and clamp
            var sample = Math.max(-32768, Math.min(32767, Math.floor(samples[i] * 32767)));
            
            // Write as little-endian
            pcmBuffer[i * 2] = sample & 0xFF;
            pcmBuffer[i * 2 + 1] = (sample >> 8) & 0xFF;
        }
        
        // Add to buffer for sending
        audioBuffer.push(pcmBuffer);
        
    } catch (error) {
        log.e("Error processing audio data: " + error);
    }
}

function sendBufferedAudio() {
    if (!script.geminiLiveAPI || !script.geminiLiveAPI.api.isSessionActive() || audioBuffer.length === 0) {
        return;
    }
    
    try {
        // Combine all buffered chunks
        var totalLength = 0;
        for (var i = 0; i < audioBuffer.length; i++) {
            totalLength += audioBuffer[i].length;
        }
        
        var combinedBuffer = new Uint8Array(totalLength);
        var offset = 0;
        
        for (var j = 0; j < audioBuffer.length; j++) {
            var chunk = audioBuffer[j];
            for (var k = 0; k < chunk.length; k++) {
                combinedBuffer[offset++] = chunk[k];
            }
        }
        
        // Send to Gemini
        script.geminiLiveAPI.api.sendAudioData(combinedBuffer);
        
        // Clear buffer after sending
        audioBuffer = [];
        
    } catch (error) {
        log.e("Error sending audio data: " + error);
    }
}

function startAudioCapture() {
    if (!script.geminiLiveAPI) {
        log.e("GeminiLiveAPI component not assigned");
        return;
    }
    
    isCapturingAudio = true;
    lastAudioSendTime = getTime();
    audioBuffer = [];
    
    // Enable VoiceML listening if not already enabled
    if (!voiceMLModule.isListening()) {
        voiceMLModule.enableListening();
    }
    
    log.d("Started audio capture for Gemini");
}

function stopAudioCapture() {
    isCapturingAudio = false;
    
    // Send any remaining buffered audio
    if (audioBuffer.length > 0) {
        sendBufferedAudio();
    }
    
    log.d("Stopped audio capture for Gemini");
}

function isCapturing() {
    return isCapturingAudio;
}

// Expose public functions
script.api.startAudioCapture = startAudioCapture;
script.api.stopAudioCapture = stopAudioCapture;
script.api.isCapturing = isCapturing;