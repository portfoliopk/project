# Universal Voice Translator

Next.js App Router project. Records speech in the browser, sends the recording to a server-side OpenAI transcription endpoint for automatic source-language detection, then translates the transcript into the selected target language (Urdu by default).

## Setup

1. Install dependencies: `npm install`
2. Create `.env.local` and add: `OPENAI_API_KEY=your_key_here`
3. Start locally: `npm run dev`
4. Open `http://localhost:3000` and allow microphone access.

## Vercel

In Project Settings → Environment Variables, add `OPENAI_API_KEY` for Production, Preview, and Development, then redeploy. Never put the key in client-side code or commit it to GitHub.

## Current behavior and limitations

- Speech is recorded, then transcribed and translated when you press **Stop & translate**. This is turn-based voice translation, not simultaneous low-latency streaming.
- Whisper transcription auto-detects supported spoken languages; recognition quality varies by language, accent, recording quality, and model support.
- Translation defaults to Urdu and includes a target-language selector.
- Requires an internet connection and a valid OpenAI API key. The PWA shell cache does not make AI transcription/translation available offline.
- Audio is sent to OpenAI for transcription. Do not use for sensitive conversations without reviewing provider privacy and retention terms.
