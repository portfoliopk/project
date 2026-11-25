import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Missing GEMINI_API_KEY. Add it in Vercel → Project Settings → Environment Variables, then redeploy." },
      { status: 503 }
    );
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        liveConnectConstraints: {
          model: "models/gemini-3.5-live-translate-preview",
          config: {
            responseModalities: ["AUDIO"],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            translationConfig: {
              targetLanguageCode: "ur",
              echoTargetLanguage: true
            }
          }
        }
      }
    });

    if (!token?.name) throw new Error("Google did not return a temporary session token.");
    return Response.json({ token: token.name });
  } catch (error) {
    console.error("Gemini live token error:", error);
    return Response.json(
      { error: error.message || "Could not create a Gemini live session." },
      { status: 502 }
    );
  }
}
