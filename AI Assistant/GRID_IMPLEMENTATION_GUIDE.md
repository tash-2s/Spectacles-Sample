# Automatic Object Grid Detection - Implementation Guide

This guide will help you set up the Automatic Object Detection 3x3 Grid project in Lens Studio using the AI Assistant sample as a foundation.

## Overview

This project captures the camera view every 3 seconds, sends it to OpenAI's Vision API, and displays detected objects in a 3x3 grid overlay. The implementation requires:

1. Setting up the camera capture
2. Creating a 3x3 grid UI with text labels
3. Connecting everything to the AutomaticGridObjectDetector script

## Setup Instructions

### Step 1: Add the TypeScript Script
- The script `AutomaticGridObjectDetector.ts` has been added to the project. You'll need to place it in the `/Assets/Scripts/TS/` directory.

### Step 2: Create the Grid UI
1. Create a new SceneObject named "GridUI"
2. For each cell in the 3x3 grid, create a SceneObject with:
   - A Text component to show the detected object name
   - (Optional) A background Panel to make text more visible

Here's a recommended layout:
- Create a parent "GridUI" object
- Create 9 child objects named "Cell0" through "Cell8"
- Position them in a 3x3 grid pattern
- Add Text components to each cell

Example positioning (adjust as needed for your design):
- Cell0: Top-left
- Cell1: Top-center
- Cell2: Top-right
- Cell3: Middle-left
- Cell4: Middle-center
- Cell5: Middle-right
- Cell6: Bottom-left
- Cell7: Bottom-center
- Cell8: Bottom-right

### Step 3: Connect the Script
1. Create a new SceneObject or use an existing one
2. Add a Script Component and specify the TypeScript class:
   - Set the Script Class to `AutomaticGridObjectDetector`
3. Configure the script parameters:
   - `cameraImage`: Assign the same Component.Image that's used with the ContinuousCameraFrameExample script
   - `gridLabels`: Assign all 9 Text components from your grid cells
   - `captureInterval`: Set to 3 (or adjust as needed)
   - (Optional) Enable `debugMode` and assign materials for debugging

### Step 4: API Key Configuration
1. Open the `AutomaticGridObjectDetector.ts` script
2. Replace the placeholder `"Insert your Open AI Key"` with your actual OpenAI API key

### Step 5: Test
1. Preview the lens to ensure the camera is working
2. Verify that:
   - The grid UI is visible on screen
   - Text labels update every 3 seconds with detected objects
   - Objects are correctly identified in their grid positions

## Troubleshooting

- **No objects detected**: Check API key and network connection
- **Grid positioning issues**: Adjust the SceneObject transforms
- **Camera not showing**: Verify ContinuousCameraFrameExample script is working correctly
- **Console errors**: Check Script Inspector for error messages

## Additional Customization

- Adjust font size, color, and background of text components for better visibility
- Change the `captureInterval` for faster/slower detection
- Modify the system prompt in the script to get different types of object descriptions

## Note on Performance

The automatic API calls every 3 seconds will consume OpenAI API credits. Consider implementing:
- A toggle to enable/disable automatic detection
- A manual capture button for user-initiated detection