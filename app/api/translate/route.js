export const runtime = "nodejs";
export const maxDuration = 60;

const OPENAI_URL = "https://api.openai.com/v1";

async function translateText(text, targetLanguage, apiKey) {
  const response = await fetch(`${OPENAI_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: `You are a professional translator. Detect the source language automatically and translate the user's text into ${targetLanguage}. Preserve meaning, tone, names, numbers, and formatting. Return only the translation, without explanations. If the input is already in the target language, return it unchanged.` },
        { role: "user", content: text }
      ]
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Translation provider error.");
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Server setup required: add OPENAI_API_KEY in Vercel Environment Variables." }, { status: 503 });

  try {
    const form = await request.formData();
    const targetLanguage = String(form.get("targetLanguage") || "Urdu").slice(0, 50);
    const text = String(form.get("text") || "").trim();
    const audio = form.get("audio");
    let transcript = text;
    let detectedLanguage = "Auto-detected from text";

    if (audio && typeof audio.arrayBuffer === "function" && audio.size > 0) {
      const audioForm = new FormData();
      audioForm.append("file", audio, audio.name || "speech.webm");
      audioForm.append("model", "whisper-1");
      audioForm.append("response_format", "verbose_json");
      const speechResponse = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: audioForm
      });
      const speechData = await speechResponse.json();
      if (!speechResponse.ok) throw new Error(speechData.error?.message || "Speech recognition failed.");
      transcript = speechData.text?.trim() || "";
      detectedLanguage = speechData.language || "Unknown";
    }

    if (!transcript) return Response.json({ error: "No speech or text was received." }, { status: 400 });
    const translation = await translateText(transcript, targetLanguage, apiKey);
    return Response.json({ transcript, translation, detectedLanguage, targetLanguage });
  } catch (error) {
    return Response.json({ error: error.message || "Translation failed." }, { status: 500 });
  }
}
