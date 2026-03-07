import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import sharp from "sharp";

dotenv.config();

const { GoogleGenAI } = await import("@google/genai");

const app = express();
app.use(express.json({ limit: "10mb" }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------------------
   Image preprocessing for OCR
--------------------------------*/
async function preprocessImage(base64) {

  const buffer = Buffer.from(base64, "base64");

  const processed = await sharp(buffer)
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();

  return processed.toString("base64");
}

// API endpoint
app.post("/api/translate", async (req, res) => {
  try {

    const { imageBase64, mimeType, prompt } = req.body;

    const contents = [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType
            }
          }
        ]
      }
    ];

    // ---------- 第一階段：正常 Vision 分析 ----------
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents
    });

    let text =
      response.text ||
      response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {

      const rawResponse = response;

      // ---------- Safety flag → OCR retry ----------
      if (rawResponse?.promptFeedback?.blockReason) {

        console.warn("Safety block detected → OCR fallback");

        const processedImage = await preprocessImage(imageBase64);

        const ocrPrompt = `
請只提取圖片中的所有文字。
不要描述圖片。
不要做任何分析。
只輸出圖片中的文字。
`;

        const retry = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                { text: ocrPrompt },
                {
                  inlineData: {
                    data: processedImage,
                    mimeType: mimeType
                  }
                }
              ]
            }
          ]
        });

        const retryText =
          retry.text ||
          retry?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (retryText) {
          return res.json({ text: retryText });
        }

        return res.status(400).json({
          error: `Content blocked: ${rawResponse.promptFeedback.blockReason}`
        });
      }

      console.error("Empty Gemini response:", JSON.stringify(response, null, 2));

      return res.status(500).json({
        error: "No response from AI"
      });
    }

    res.json({ text });

  } catch (error) {

    console.error("API Error:", error);

    res.status(500).json({
      error: error?.message || "Translation failed"
    });

  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});