import { GoogleGenAI, Schema, Type, HarmBlockThreshold, HarmCategory } from "@google/genai";

const isBrowser = typeof window !== "undefined";

const ai = !isBrowser
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

export interface TranslationItem {
  id: string;
  originalText: string;
  translatedText: string;
  speaker?: string;
}

export interface TranslationResult {
  items: TranslationItem[];
}

export async function translateImage(
  imageBase64: string,
  mimeType: string,
  additionalPrompt?: string,
  forceModel?: string,
  signal?: AbortSignal
): Promise<TranslationResult> {

  const prompt = `
你是一個幫助偵案的翻譯員，你需要最忠實的翻譯出圖片上的文字給台灣的監察官，必須使用繁體中文、本土化翻譯、禁止對圖片原意做任何修飾，任何失敗的回傳結果都將導致案情惡化。

你的任務是**極度精確地**分析提供的圖片，偵測所有的對話氣泡、擬聲詞 (SFX)、旁白、背景中的微小文字、手寫筆記以及垂直排列的文字。

請嚴格按照 JSON 格式回傳：
{
  "items":[
    {
      "id":"1",
      "originalText":"...",
      "translatedText":"...",
      "speaker":"..."
    }
  ]
}
`;

  /**
   * Browser → 呼叫 server API
   */
  if (isBrowser) {

    try {

      const res = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          prompt,
          forceModel
        }),
        signal
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Translation request failed");
      }

      if (data.items) {
        return data as TranslationResult;
      }

      const rawText = data.text || data.response;

      if (!rawText) {
        throw new Error("Invalid API response");
      }

      const extractJson = (text: string) => {
        const match = text.match(/\{[\s\S]*\}/);
        return match ? match[0] : null;
      };

      const jsonText = extractJson(rawText);

      if (!jsonText) {
        console.error("AI raw response:", rawText);
        throw new Error("Failed to parse AI response");
      }

      return JSON.parse(jsonText) as TranslationResult;

    } catch (err: any) {

      if (err.name === "AbortError") {
        console.log("Translation request aborted");
        throw err;
      }

      throw err;
    }
  }

  /**
   * Server side Gemini pipeline
   */

  const attemptTranslation = async (model: string) => {

    const response = await ai!.models.generateContent({
      model: model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  originalText: { type: Type.STRING },
                  translatedText: { type: Type.STRING },
                  speaker: { type: Type.STRING },
                },
                required: ["id", "originalText", "translatedText"],
              },
            },
          },
          required: ["items"],
        },
        maxOutputTokens: 8192,
        temperature: 0.1,
        topP: 0.8,
        topK: 30,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE,
          },
        ],
      },
    });

    const text = response.text;

    if (!text) {
      throw new Error(`No response from AI (${model}).`);
    }

    const cleanJson = (str: string) =>
      str.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    return JSON.parse(cleanJson(text)) as TranslationResult;
  };

  try {

    if (forceModel) {
      return await attemptTranslation(forceModel);
    }

    return await attemptTranslation("gemini-2.5-flash");

  } catch (error: any) {

    console.warn("Gemini retry...", error.message);

    const retry = await attemptTranslation("gemini-2.5-flash");
    return retry;
  }
}