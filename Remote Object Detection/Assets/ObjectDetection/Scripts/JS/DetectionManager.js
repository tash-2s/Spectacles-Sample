//@ui {"widget":"group_start", "label":"Input Configuration"}
//@input Asset.Texture texture {"hint":"Testing a texture"}
//@input bool cameraModeEnabled {"label": "Enable Camera Texture", "default": false}
//@input SceneObject buttonSingleDetection {"hint":"Drag the SceneObject that has the Interactable component"}
//@ui {"widget":"group_end"}

//@ui {"widget":"group_start", "label":"Script References"}
//@input Component.ScriptComponent cameraTextureScript {"label": "Camera Texture Script"}
//@input Component.ScriptComponent logConfig {"label": "SIK Log Level Config"}
//@ui {"widget":"group_end"}

//@ui {"widget":"group_start", "label":"Model Configuration"}
//@input string modelSize {"widget":"combobox", "values":[{"label":"Small - Better performance and less accuracy", "value":"Small - Better performance and less accuracy"}, {"label":"Medium - Balanced performance and accuracy", "value":"Medium - Balanced performance and accuracy"}, {"label":"Large - Slow performance and high accuracy", "value":"Large - Slow performance and high accuracy"}], "label":"Model Size"}
//@input float confidenceThreshold {"label": "Confidence Threshold", "hint": "Values between 0.0 and 1.0", "default": 0.1}
//@input float distanceThreshold {"label": "Distance Threshold (meters)", "hint": "Maximum distance for detections that the model will be picking up. To not confuse with raycast max distance.", "default": 10.0, "min": 0.1}
//@input float sendDelay {"label": "Send Delay (seconds)", "default": 4}
//@ui {"widget":"group_end"}

//@ui {"widget":"group_start", "label":"API Configuration"}
//@input string hfApiToken {"hint":"Enter your Hugging Face API token"}
//@input Component.Text logs
//@ui {"widget":"group_end"}

//@ui {"widget":"group_start", "label":"Detection Prefab"}
//@input Asset detectionPrefab {"hint":"Prefab to use for detection"}
//@input bool prefabBillboardEnabled {"label": "Enable Prefab Billboarding", "default": false}
//@ui {"widget":"group_end"}

//@input Component.ScriptComponent pinholeCapture {"Pinhole Capture": "Pinhole Camera}

// SIK
const SIK = require("SpectaclesInteractionKit.lspkg/SIK").SIK;
const interactionManager = SIK.InteractionManager;
const interactionConfiguration = SIK.InteractionConfiguration;
// module
var internetModule = require("LensStudio:InternetModule");
// others
var activePrefabs = []; // Array to track active detection prefabs
var offsetPositioning = 20; // Offset for prefab positioning - regulate based on your context

script.createEvent("OnStartEvent").bind(() => {
  onStart();
});

function onStart() {
  // Initialize SIK
  const SIK = require("SpectaclesInteractionKit.lspkg/SIK").SIK;
  const interactionManager = SIK.InteractionManager;
  if (script.hfApiToken === null || script.hfApiToken === "") {
    debugLog("Error: Hugging Face API token is not set!");
  } else {
    debugLog("Hugging Face API token is set: " + script.hfApiToken);
  }

  if (!script.buttonSingleDetection) {
    print(
      "Warning: Please assign a SceneObject with an Interactable component in the inspector"
    );
    return;
  }

  // Get the Interactable from the referenced SceneObject
  const interactableSingleDetection =
    interactionManager.getInteractableBySceneObject(
      script.buttonSingleDetection
    );

  if (!interactableSingleDetection) {
    print(
      "Warning: Could not find Interactable component on the referenced SceneObject"
    );
    return;
  }

  // Define the callback for trigger end event
  const onTriggerEndCallbackSingleDetection = (event) => {
    handleTriggerEndSingleDetection(event);
    print(
      `Interaction SingleDetection triggered by: ${event.interactor.inputType} at position: ${event.interactor.targetHitInfo.hit.position}`
    );
  };

  // Bind the callback to the trigger end event
  interactableSingleDetection.onInteractorTriggerEnd(
    onTriggerEndCallbackSingleDetection
  );
}

// Ensure single detection stops continuous mode
async function handleTriggerEndSingleDetection(event) {
  if (script.hfApiToken === null || script.hfApiToken === "") {
    debugLog("Error: Hugging Face API token is not set!");
    return;
  }

  debugLog(
    `>>> Single Detection Triggered by: ${event.interactor.inputType} at position: ${event.interactor.targetHitInfo.hit.position}`
  );

  try {
    await processTexture();
    debugLog("Single detection completed");
  } catch (e) {
    debugLog(`Error in single detection: ${e}`);
  }
}

// Helper functions for detection management
function clearDetections() {
  for (let i = 0; i < activePrefabs.length; i++) {
    activePrefabs[i].destroy();
  }
  activePrefabs = [];
}
/* Just a FYI 
// Scale 2D coordinates from 480x640 (Python/YOLO) to 1512x1008 (Spectacles)
const sourceWidth = 480;  // YOLO resolution
const sourceHeight = 640; // YOLO resolution
const targetWidth = 1008; // Spectacles width
const targetHeight = 1512; // Spectacles height
*/
async function createDetectionPrefabAsync(detection) {
  try {
    if (!script.detectionPrefab) {
      throw new Error("No detection prefab assigned");
    }

    debugLog("Creating detection object...");
    const detectionObj = scene.createSceneObject("Detection");
    script.detectionPrefab.instantiate(detectionObj);
    const prefabChild = detectionObj.getChild(0);
    if (!prefabChild) throw new Error("No child found on Detection object");

    const container = prefabChild.getComponent("Component.ScriptComponent");
    if (!container)
      throw new Error("No script component found on prefab child");

    debugLog("Debug - Detection object: " + JSON.stringify(detection));

    // Validate distance
    let distanceM = detection.distance;
    debugLog(
      "Non normalized center from server" +
        new vec2(detection.center_2d[0], detection.center_2d[1])
    );
    // normalize the center to 480x640
    // const normalizedCenter = new vec2(detection.center_2d[0] / 480, detection.center_2d[1] / 640);
    const normalizedCenter = new vec2(
      (detection.center_2d[0] + 0.5) / 640,
      1 - (detection.center_2d[1] + 0.5) / 480
    );
    debugLog("Normalized center in lens studio" + normalizedCenter);
    debugLog("Camera infos");
    debugLog("Distance from server" + detection.distance);

    let newCenter = new vec3(0, 0, 0);

    // On device, we use the pinhole capture to project the 2D center to 3D
    newCenter = script.pinholeCapture.captureToWorld(
      normalizedCenter,
      detection.distance * offsetPositioning
    );
    newCenter = new vec3(newCenter.x, newCenter.y, newCenter.z);

    // Set initial position based on estimated distance
    detectionObj.getTransform().setWorldPosition(newCenter);
    debugLog(
      `Projected 3D center position: [${newCenter.x.toFixed(
        3
      )}, ${newCenter.y.toFixed(3)}, ${newCenter.z.toFixed(3)}]`
    );

    container.setBillboardOnUpdate(script.prefabBillboardEnabled);

    if (detection.bounding_box && container) {
      debugLog("Debug - Starting vertex handling");
      debugLog(
        "Debug - Detection bounding_box: " +
          JSON.stringify(detection.bounding_box)
      );

      // Get the four vertex children (PointA, PointB, PointC, PointD)
      const children = [
        prefabChild.getChild(0), // Lower left (PointA)
        prefabChild.getChild(1), // Lower right (PointB)
        prefabChild.getChild(2), // Upper right (PointC)
        prefabChild.getChild(3), // Upper left (PointD)
      ];

      if (
        children.length === 4 &&
        detection.bounding_box.vertices.length >= 4
      ) {
        const vertexOrder = [
          detection.bounding_box.vertices[0], // Lower left [x1, y1]
          detection.bounding_box.vertices[1], // Lower right [x2, y2]
          detection.bounding_box.vertices[2], // Upper right [x3, y3]
          detection.bounding_box.vertices[3], // Upper left [x4, y4]
        ];
        debugLog("Debug - Vertex order: " + JSON.stringify(vertexOrder));

        // Calculate the center of the bounding box in pixel coordinates
        const centerX =
          (vertexOrder[0][0] +
            vertexOrder[1][0] +
            vertexOrder[2][0] +
            vertexOrder[3][0]) /
          4;
        const centerY =
          (vertexOrder[0][1] +
            vertexOrder[1][1] +
            vertexOrder[2][1] +
            vertexOrder[3][1]) /
          4;
        debugLog(`Bounding box center in pixels: [${centerX}, ${centerY}]`);

        // Scaling factor to fit the vertices in Lens Studio local space (adjust as needed)
        const scaleFactor = 0.3; // Adjust this value to fit your scene (e.g., scales 480 pixels to 0.48 units)

        children.forEach((child, i) => {
          const vertex = vertexOrder[i]; // [x, y] in pixel coordinates
          debugLog(`Processing vertex ${i}: [${vertex[0]}, ${vertex[1]}]`);

          // Calculate the offset from the center in pixel coordinates
          const offsetX = (vertex[0] - centerX) * scaleFactor;
          const offsetY = (vertex[1] - centerY) * scaleFactor;
          const localZ = 0; // Keep Z as 0 as requested

          // Set the local position of the child (relative to prefab’s local origin)
          const childTransform = child.getTransform();
          if (!childTransform) {
            debugLog(`Error: No transform found for child ${i}`);
            return;
          }

          childTransform.setLocalPosition(new vec3(offsetX, offsetY, localZ));

          debugLog(
            `Vertex ${i} set to local position: [${offsetX.toFixed(
              3
            )}, ${offsetY.toFixed(3)}, ${localZ.toFixed(3)}]`
          );
        });

        // Refresh the polyline if needed
        if (container.polyline) {
          container.polyline.refreshLine();
        }
      } else {
        debugLog("Warning: Insufficient children or vertices for positioning");
      }
    }

    // Update text and color (unchanged)
    if (container.categoryAndConfidence) {
      container.categoryAndConfidence.text = `${detection.class_name} (${(
        detection.confidence * 100
      ).toFixed(1)}%)`;
    }

    if (container.distanceFromCamera) {
      // Display detection distance estimate
      container.distanceFromCamera.text = `${detection.distance.toFixed(2)} m`;
    }
    if (container.polyline && container.polyline.setColor) {
      const color = detection.color;
      const newColor = new vec3(
        color[0] / 255.0,
        color[1] / 255.0,
        color[2] / 255.0
      );
      container.polyline.setColor(newColor);
    }

    activePrefabs.push(detectionObj);
    debugLog("Detection prefab created successfully");
  } catch (error) {
    debugLog("Error in createDetectionPrefab: " + error.message);
  }
}
// Process detections sequentially
async function processDetections(detections) {
  // Clear existing detections
  clearDetections();

  // Filter valid detections
  const validDetections = detections.filter(
    (detection) => detection.confidence >= script.confidenceThreshold
  );

  debugLog(
    `Processing ${validDetections.length} valid detections sequentially...`
  );

  // Process each detection one at a time
  for (let i = 0; i < validDetections.length; i++) {
    debugLog(
      `Processing detection ${i + 1}/${validDetections.length}: ${
        validDetections[i].class_name
      }`
    );
    await createDetectionPrefabAsync(validDetections[i]);

    // Add a small delay between objects to ensure clean state
    await delay(0.2);
  }

  debugLog(`Finished processing ${validDetections.length} detections`);
}

function debugLog(message) {
  // Standard console print
  print(message);

  // Update script logs
  if (script.logs) {
    script.logs.text = message;
  }

  // Debug log using TypeScript component's functionality
  if (script.logConfig && script.logConfig.debugModeEnabled) {
    print(message); // When debug mode is enabled, print the message
  }
}

function printError(error) {
  debugLog("API Error: " + error);
}

function sendToHuggingFace(encodedImage) {
  const apiToken = script.hfApiToken;
  if (!apiToken) {
    debugLog("Error: No Hugging Face API token provided.");

    return;
  }

  // First set model and confidence
  const modelUrl =
    "https://agrancini-sc-simultaneous-segmented-depth-prediction.hf.space/gradio_api/call/model_selector";
  const confidenceUrl =
    "https://agrancini-sc-simultaneous-segmented-depth-prediction.hf.space/gradio_api/call/update_confidence_threshold";

  // Set model to large for better detection
  const modelRequest = new Request(modelUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [script.modelSize],
    }),
  });

  // Set confidence to 0.1 (10%) for more detections
  const confidenceRequest = new Request(confidenceUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [script.confidenceThreshold],
    }),
  });

  // Now send detection request
  const apiUrl =
    "https://agrancini-sc-simultaneous-segmented-depth-prediction.hf.space/gradio_api/call/get_detection_data";

  let requestPayload = JSON.stringify({
    data: [
      {
        image: {
          image: {
            path: null,
            url: null,
            data: "data:image/png;base64," + encodedImage,
            mime_type: "image/png",
            size: null,
          },
        },
        model_size: script.modelSize, // Added model size
        confidence_threshold: script.confidenceThreshold, // Added confidence threshold
        distance_threshold: script.distanceThreshold, // Add distance threshold in meters
      },
    ],
  });

  debugLog("🚀 Configuring model settings...");

  // First configure model and confidence
  Promise.all([
    internetModule.fetch(modelRequest),
    internetModule.fetch(confidenceRequest),
  ])
    .then(() => {
      debugLog("✅ Model settings updated");
      debugLog("🚀 Sending detection request...");

      let request = new Request(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: requestPayload,
      });

      return internetModule.fetch(request);
    })
    .then((response) => {
      debugLog("🔵 Response status: " + response.status);
      if (!response.ok) {
        throw new Error("Server responded with " + response.status);
      }
      return response.text();
    })
    .then((text) => {
      debugLog("📝 Initial response text: " + text);
      const data = JSON.parse(text);

      if (data && data.event_id) {
        const resultUrl = apiUrl + "/" + data.event_id;
        debugLog("🔄 Fetching results from: " + resultUrl);

        return internetModule.fetch(
          new Request(resultUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiToken}`,
            },
          })
        );
      }
    })
    .then((response) => response.text())
    .then((text) => {
      debugLog("📝 Full result text: " + text);
      const lines = text.split("\n");
      let allDetections = [];
      let parsedAny = false;

      lines.forEach((line, index) => {
        if (line.startsWith("data: ")) {
          try {
            const jsonStr = line.substring(6);
            debugLog(`🔍 Processing line ${index}: ${jsonStr}`);

            const parsed = JSON.parse(jsonStr);
            if (parsed && Array.isArray(parsed)) {
              parsed.forEach((item) => {
                if (item && item.detections) {
                  debugLog(
                    `Found ${item.detections.length} detections in chunk`
                  );
                  allDetections = allDetections.concat(item.detections);
                  parsedAny = true;
                }
              });
            }
          } catch (e) {
            debugLog(`⚠️ Parse error on line ${index}: ${e.message}`);
            debugLog(`Problem line content: ${line}`);
          }
        }
      });

      if (!parsedAny) {
        debugLog("⚠️ No valid detection data found in any line");
        debugLog("Full response for debugging:");
        debugLog(text);
      }

      debugLog("🎯 Total detections accumulated: " + allDetections.length);

      // Process detections to create/update prefabs
      processDetections(allDetections);

      allDetections.forEach((detection, index) => {
        debugLog(`Detection ${index + 1}:`);
        debugLog(`- Class: ${detection.class_name}`);
        debugLog(`- Center 2D: ${JSON.stringify(detection.center_2d)}`);
        debugLog(`- Distance: ${detection.distance.toFixed(3)}`);
        debugLog(`- Confidence: ${(detection.confidence * 100).toFixed(1)}%`);
        debugLog(`- Color: rgb(${detection.color.join(",")})`);
        if (detection.bounding_box) {
          debugLog(
            `- Bounding box: ${JSON.stringify(detection.bounding_box.vertices)}`
          );
        }
      });

      return allDetections;
    })
    .catch(printError);
}

function encode(texture) {
  return new Promise(function (resolve, reject) {
    Base64.encodeTextureAsync(
      texture,
      function (encoded) {
        debugLog("✅ Encoded length: " + encoded.length);
        resolve(encoded);
      },
      function (error) {
        reject(error);
      },
      CompressionQuality.LowQuality,
      EncodingType.Png
    );
  });
}

function getTextureToProcess() {
  if (script.cameraModeEnabled) {
    if (
      !script.cameraTextureScript ||
      !script.cameraTextureScript.getCameraTexture
    ) {
      debugLog(
        "Error: Camera mode enabled but no valid camera texture script provided"
      );
      return null;
    }
    const texture = script.cameraTextureScript.getCameraTexture();
    // Save the matrix for pinhole capture

    if (!texture) {
      debugLog("Warning: No new camera texture available");
      return null; // Ensure we don't proceed with null texture
    }
    return texture;
  }
  debugLog(
    "Using static texture; enable cameraModeEnabled for continuous updates"
  );
  return script.texture;
}

function delay(seconds) {
  return new Promise((resolve) => {
    var delayedEvent = script.createEvent("DelayedCallbackEvent");
    delayedEvent.bind(() => {
      resolve();
    });
    delayedEvent.reset(seconds);
  });
}

async function countdownDelay(seconds) {
  const totalSeconds = seconds;
  for (let i = totalSeconds; i > 0; i--) {
    debugLog(`Capturing in ${i} seconds...`);
    await delay(1.0);
  }
  debugLog("Capturing now!");
}

async function processTexture() {
  if (script.hfApiToken === null || script.hfApiToken === "") {
    debugLog("Error: Hugging Face API token is not set!");
    return;
  }

  debugLog(">>> Starting processTexture...");

  // Add countdown delay BEFORE capturing the texture
  if (script.sendDelay > 0) {
    await countdownDelay(script.sendDelay);
  }

  const textureToProcess = getTextureToProcess();

  if (!textureToProcess) {
    debugLog("Error: No valid texture to process");
    throw new Error("No texture available");
  }

  script.pinholeCapture.saveMatrix();
  print("Matrix saved in detection manager");

  debugLog("Encoding texture...");
  const encodedImage = await encode(textureToProcess);

  // Added tunable delay before sending the image using our custom delay function
  debugLog(
    "Waiting for " + script.sendDelay + " seconds before sending the image..."
  );

  debugLog("Texture encoded, sending to Hugging Face...");
  const result = await sendToHuggingFace(encodedImage);
  debugLog("processTexture completed");
  return result;
}

// Ensure getTextureToProcess is set up for continuous use
function getTextureToProcess() {
  if (script.cameraModeEnabled) {
    if (
      !script.cameraTextureScript ||
      !script.cameraTextureScript.getCameraTexture
    ) {
      debugLog("Error: Camera mode enabled but no valid camera texture script");
      return null;
    }
    const texture = script.cameraTextureScript.getCameraTexture();
    if (!texture) {
      debugLog("Warning: No new camera texture available");
      return null;
    }
    debugLog("Using fresh camera texture");
    return texture;
  }
  debugLog("Using static texture (may not update in continuous mode)");
  return script.texture;
}

// Initialize the script
function init() {
  // Validate camera mode settings
  if (script.cameraModeEnabled && !script.cameraTextureScript) {
    debugLog(
      "Warning: Camera mode is enabled but no camera texture script is assigned!"
    );
  }

  // Initialize state
  isContinuousDetectionActive = false;
  debugLog("Script initialized - waiting for button interaction");
}

init();
