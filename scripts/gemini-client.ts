import { GoogleGenAI, createPartFromBase64, Modality } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";

const MODEL = "gemini-3.1-flash-image-preview";

const RESOLUTION_MAP: Record<string, string> = {
  "512": "512x512",
  "1K": "1024x1024",
  "2K": "2048x2048",
  "4K": "4096x4096",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateImage(
  prompt: string,
  referenceImagePath: string,
  options?: { resolution?: "512" | "1K" | "2K" | "4K" }
): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY is not set. Create .env.local with your API key."
    );
  }

  const resolution = options?.resolution ?? "1K";
  const resolutionStr = RESOLUTION_MAP[resolution];

  // Load reference image as base64
  const absRef = path.resolve(referenceImagePath);
  if (!fs.existsSync(absRef)) {
    throw new Error(`Reference image not found: ${absRef}`);
  }
  const refBytes = fs.readFileSync(absRef);
  const refBase64 = refBytes.toString("base64");
  const refPart = createPartFromBase64(refBase64, "image/png");

  const fullPrompt = `${prompt}\n\nOUTPUT: ${resolutionStr} PNG with transparent background.`;

  const client = new GoogleGenAI({ apiKey });

  const RETRY_DELAYS = [1000, 3000, 9000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        const response = await client.models.generateContent({
          model: MODEL,
          contents: [
            {
              role: "user",
              parts: [refPart, { text: fullPrompt }],
            },
          ],
          config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
            abortSignal: controller.signal,
          },
        });

        clearTimeout(timeout);

        // Extract image from response parts
        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) {
          throw new Error("No parts in response");
        }

        for (const part of parts) {
          if (part.inlineData?.data) {
            return Buffer.from(part.inlineData.data, "base64");
          }
        }

        throw new Error(
          "No image data in response. Model returned text only."
        );
      } finally {
        clearTimeout(timeout);
      }
    } catch (err: unknown) {
      lastError = err;

      // Don't retry on client errors (except rate limit)
      if (err instanceof Error && "status" in err) {
        const status = (err as { status: number }).status;
        if (status === 400 || status === 401 || status === 403) {
          throw err;
        }
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= RETRY_DELAYS.length) {
        break;
      }

      const delay = RETRY_DELAYS[attempt];
      console.warn(
        `  Attempt ${attempt + 1} failed, retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
