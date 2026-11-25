# Universal Voice Translator

A mobile-first Next.js PWA for continuous voice-to-voice translation into Urdu using the Gemini Live Translation API.

## Features

- Automatically detects the spoken source language; there is no source-language selector.
- Streams microphone audio while the user speaks.
- Receives translated Urdu audio and plays it automatically.
- Optional live captions show detected speech and Urdu translation.
- Uses a short-lived Gemini ephemeral token so the long-lived API key is not sent to the browser.
- PWA shell can be installed, but AI translation requires an internet connection.

## Setup

1. Install dependencies: `npm install`
2. Create `.env.local` and add `GEMINI_API_KEY=your_key_here`.
3. Start locally: `npm run dev`.
4. Open `http://localhost:3000` in a browser that supports microphone access and allow the microphone.

## Vercel

In Project Settings → Environment Variables, add `GEMINI_API_KEY` for the required environments and redeploy. Never use a `NEXT_PUBLIC_` prefix for this secret.

## Audio and API

- Live model: `gemini-3.5-live-translate-preview`.
- Input audio is converted to mono PCM16 at 16 kHz and streamed in real time.
- Output audio is PCM16 at 24 kHz and is played as it arrives.
- The API route creates a one-use, short-lived ephemeral token. The browser uses that token to establish the Live API WebSocket.
- The target language is fixed to Urdu (`ur`); source language detection is automatic.
- Gemini's free tier is subject to quotas and availability. Free-tier content may be used by Google to improve its products; review Google's terms before using sensitive conversations.

## Language support note

Google's current Live Translation language list includes Urdu, Japanese and English, but does not list Pashto. Pashto recognition/translation therefore cannot be promised with this model and needs separate testing or a different pipeline/provider. Do not treat an unlisted language as supported.

## Limitations

- Live translation requires an internet connection and an available Gemini quota.
- Browser microphone access requires HTTPS (localhost is allowed for development).
- Audio output depends on the browser allowing playback after the user starts the session.
- This is a live streaming implementation, not an offline translator.
