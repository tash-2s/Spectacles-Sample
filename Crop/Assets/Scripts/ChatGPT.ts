//PUT OPENAI KEY HERE!
const openAIKey = "Open AI Key goes HERE!~!";

@component
export class ChatGPT extends BaseScriptComponent {
  private internetModule: InternetModule = require("LensStudio:InternetModule");

  private ImageQuality = CompressionQuality.HighQuality;
  private ImageEncoding = EncodingType.Jpg;

  onAwake() {}

  makeImageRequest(imageTex: Texture, callback) {
    print("Making image request...");
    Base64.encodeTextureAsync(
      imageTex,
      (base64String) => {
        print("Image encode Success!");
        const textQuery =
          "Identify in as much detail what object is in the image but only use a maxiumum of 5 words";
        this.sendGPTChat(textQuery, base64String, callback);
      },
      () => {
        print("Image encoding failed!");
      },
      this.ImageQuality,
      this.ImageEncoding
    );
  }

  async sendGPTChat(
    request: string,
    image64: string,
    callback: (response: string) => void
  ) {
    const reqObj = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: request },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,` + image64,
              },
            },
          ],
        },
      ],
      max_tokens: 50,
    };

    const webRequest = new Request(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey}`,
        },
        body: JSON.stringify(reqObj),
      }
    );

    let resp = await this.internetModule.fetch(webRequest);
    if (resp.status == 200) {
      let bodyText = await resp.text();
      print("GOT: " + bodyText);
      var bodyJson = JSON.parse(bodyText);
      if (bodyJson.choices && bodyJson.choices.length > 0) {
        bodyJson.mainAnswer = bodyJson.choices[0].message.content;
        callback(bodyJson.mainAnswer);
        print(bodyJson.mainAnswer);
      }
    } else {
      print("error code: " + resp.status);
      print("MAKE SURE YOUR API KEY IS SET IN THIS SCRIPT!");
    }
  }
}
