@component
export class AutomaticGridObjectDetector extends BaseScriptComponent {
    @input
    @hint("The image that displays the camera feed")
    cameraImage: Image;

    @input
    @hint("Array of 9 text components for the 3x3 grid display")
    @label("Grid Labels (9)")
    gridLabels: Text[];

    @input
    @hint("Time interval between captures in seconds")
    captureInterval: number = 5.0;

    @input
    @hint("Enable debug visualization of the grid")
    debugMode: boolean = false;

    @input
    @showIf("debugMode")
    @hint("Material for grid visualization")
    debugGridMaterial: Material;

    // OpenAI API Key
    private apiKey: string = "fixme";

    // Modules
    private remoteServiceModule: RemoteServiceModule;

    // State
    private isProcessing: boolean = false;
    private lastCaptureTime: number = 0;

    // Debug visualization properties
    @input
    @showIf("debugMode")
    @hint("Color for grid lines")
    gridLineColor: vec4 = new vec4(1, 1, 1, 0.5);

    @input
    @showIf("debugMode")
    @hint("Thickness of grid lines")
    gridLineThickness: number = 0.005;

    onAwake() {
        this.remoteServiceModule = require("LensStudio:RemoteServiceModule");

        // Set up events
        this.createEvent("UpdateEvent").bind(() => {
            const currentTime = getTime();

            // Check if it's time to capture
            if (currentTime - this.lastCaptureTime >= this.captureInterval && !this.isProcessing) {
                this.lastCaptureTime = currentTime;
                this.captureAndProcessFrame();
            }
        });

        this.createEvent("OnStartEvent").bind(() => {
            // Verify inputs
            if (!this.cameraImage) {
                print("ERROR: Please assign a camera image in the inspector");
                return;
            }

            if (!this.gridLabels || this.gridLabels.length < 9) {
                print("ERROR: Please assign 9 text components for the grid labels");
                return;
            }

            // Initialize grid labels to empty
            for (let i = 0; i < this.gridLabels.length; i++) {
                if (this.gridLabels[i]) {
                    this.gridLabels[i].text = "";
                }
            }

            // Set up debug visualization if enabled
            if (this.debugMode) {
                this.setupDebugVisualization();
            }
        });
    }

    private async captureAndProcessFrame() {
        if (this.isProcessing) {
            return;
        }

        try {
            this.isProcessing = true;

            // Access the texture from the image component displaying the camera feed
            const texture = this.cameraImage.mainPass.baseTex;
            if (!texture) {
                print("ERROR: No texture found in the camera image");
                return;
            }

            const base64Image = await this.encodeTextureToBase64(texture);
            await this.sendToOpenAI(base64Image);
        } catch (error) {
            print("ERROR: " + error);
        } finally {
            this.isProcessing = false;
        }
    }

    private encodeTextureToBase64(texture: Texture): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            Base64.encodeTextureAsync(
                texture,
                (result: string) => resolve(result),
                () => reject("Failed to encode texture"),
                CompressionQuality.LowQuality,
                EncodingType.Jpg
            );
        });
    }

    private async sendToOpenAI(base64Image: string) {
        const requestPayload = {
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a visual object detection assistant. " +
                        "Analyze the image as if it were divided into a 3x3 grid (numbered 0-8, starting from top-left, going left-to-right, top-to-bottom). " +
                        "For each cell in the grid, identify the most prominent object or feature. " +
                        "Respond ONLY with a JSON object of format: {\"cells\": [\"object0\", \"object1\", \"object2\", \"object3\", \"object4\", \"object5\", \"object6\", \"object7\", \"object8\"]}. " +
                        "If a cell has no clear object, use an empty string. Keep object names very short (1-2 words max)."
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ]
        };

        const request = new Request("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(requestPayload)
        });

        try {
            let response = await this.remoteServiceModule.fetch(request);
            if (response.status === 200) {
                let responseData = await response.json();
                let contentText = responseData.choices[0].message.content;

                // Extract JSON from the response
                let jsonMatch = contentText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        let gridData = JSON.parse(jsonMatch[0]);
                        this.updateGridDisplay(gridData.cells);
                    } catch (e) {
                        print("ERROR parsing JSON response: " + e);
                        print("Raw response: " + contentText);
                    }
                } else {
                    print("ERROR: Could not extract JSON from response");
                    print("Raw response: " + contentText);
                }
            } else {
                print("ERROR: API request failed with status " + response.status);
            }
        } catch (error) {
            print("ERROR in API call: " + error);
        }
    }

    private updateGridDisplay(cellsData: string[]) {
        if (!cellsData || cellsData.length < 9) {
            print("ERROR: Invalid grid data");
            return;
        }

        // Update text labels with detected objects
        for (let i = 0; i < Math.min(cellsData.length, this.gridLabels.length); i++) {
            if (this.gridLabels[i]) {
                this.gridLabels[i].text = cellsData[i] || "";
            }
        }
    }

    private setupDebugVisualization() {
        // This is a placeholder for creating a visual grid overlay
        print("Debug visualization enabled");

        // This would typically create line renderers or plane objects to show the grid
        // For brevity, this is not fully implemented in this code snippet
    }
}
