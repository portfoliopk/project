'use client';

import { useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality } from "@google/genai";

const MODEL = "gemini-3.5-live-translate-preview";
const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function floatToPcm16(float32) {
  const output = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function resample(input, inputRate, outputRate) {
  if (inputRate === outputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    output[i] = sum / Math.max(1, end - start);
  }
  return output;
}

export default function Home() {
  const [status, setStatus] = useState("Ready. Start listening to translate speech into Urdu.");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");
  const sessionRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef(new Set());

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      stopAudioCapture();
      sessionRef.current?.close?.();
    };
  }, []);

  function stopAudioCapture() {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }

  function playPcm(base64Audio) {
    const context = audioContextRef.current;
    if (!context) return;
    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const samples = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) samples[i] = pcm[i] / 32768;
    const buffer = context.createBuffer(1, samples.length, OUTPUT_RATE);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.04, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
    activeSourcesRef.current.add(source);
    source.onended = () => activeSourcesRef.current.delete(source);
  }

  async function startLive() {
    if (connected || connecting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access requires HTTPS and a supported browser.");
      return;
    }
    setConnecting(true);
    setError("");
    setStatus("Connecting to live Urdu translation…");
    try {
      const tokenResponse = await fetch("/api/live-token", { method: "POST" });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Could not create a secure Gemini session.");

      const ai = new GoogleGenAI({ apiKey: tokenData.token });
      const context = new AudioContext();
      audioContextRef.current = context;
      await context.resume();

      const session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          translationConfig: {
            targetLanguageCode: "ur",
            echoTargetLanguage: true
          }
        },
        callbacks: {
          onopen: () => {
            setConnected(true);
            setConnecting(false);
            setStatus("Listening. Speak naturally; translated Urdu audio will play automatically.");
          },
          onmessage: (message) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              setInputText((old) => (old + " " + content.inputTranscription.text).trim());
            }
            if (content?.outputTranscription?.text) {
              setOutputText((old) => (old + " " + content.outputTranscription.text).trim());
            }
            for (const part of content?.modelTurn?.parts || []) {
              if (part.inlineData?.data) playPcm(part.inlineData.data);
            }
          },
          onerror: (event) => {
            setError(event?.message || "Gemini live connection error.");
            setStatus("Connection error. Stop and reconnect.");
          },
          onclose: () => {
            setConnected(false);
            setConnecting(false);
            setStatus("Connection closed.");
          }
        }
      });
      sessionRef.current = session;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
      const input = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      sourceRef.current = input;
      processor.onaudioprocess = (event) => {
        if (!sessionRef.current) return;
        const channel = event.inputBuffer.getChannelData(0);
        const mono16k = resample(channel, context.sampleRate, INPUT_RATE);
        const pcm = floatToPcm16(mono16k);
        sessionRef.current.sendRealtimeInput({
          audio: { data: toBase64(new Uint8Array(pcm.buffer)), mimeType: "audio/pcm;rate=16000" }
        });
      };
      input.connect(processor);
      processor.connect(context.destination);
    } catch (e) {
      setConnecting(false);
      setConnected(false);
      stopAudioCapture();
      sessionRef.current?.close?.();
      sessionRef.current = null;
      setError(e.message || "Unable to start live translation.");
      setStatus("Could not start. Check your API key and microphone permission.");
    }
  }

  function stopLive() {
    sessionRef.current?.close?.();
    sessionRef.current = null;
    stopAudioCapture();
    for (const source of activeSourcesRef.current) {
      try { source.stop(); } catch {}
    }
    activeSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
    setConnected(false);
    setConnecting(false);
    setStatus("Stopped. Press Start listening to begin again.");
  }

  function clearCaptions() {
    setInputText("");
    setOutputText("");
    setError("");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandmark">ت</div>
        <div className="brandcopy"><strong>Universal <span>Translator</span></strong><small>LIVE VOICE · AUTO-DETECT · URDU</small></div>
        <div className={"network " + (offline ? "isOffline" : "")}>{offline ? "OFFLINE" : "ONLINE"}</div>
      </header>

      <section className="intro">
        <p className="kicker">SPEAK NATURALLY · NO LANGUAGE SELECTION</p>
        <h1>Speak any language.<br/><em>Hear it in Urdu.</em></h1>
        <p className="sub">Automatic speech-language detection with continuous voice-to-voice translation. No typing or manual language selection.</p>
      </section>

      <section className="conversation">
        <div className="sectionhead"><div><i/> LIVE VOICE TRANSLATION</div><span className="mode">GEMINI LIVE · AUDIO TO AUDIO</span></div>
        <div className={"listeningPanel " + (connected ? "isListening" : "")}>
          <div className="micOrb"><span>●</span></div>
          <strong>{connecting ? "Connecting…" : connected ? "Listening to your voice" : "Ready to listen"}</strong>
          <p>{connected ? "Source language is detected automatically. Urdu audio plays as translation arrives." : "Press Start listening and speak in your preferred language."}</p>
        </div>
        <div className="panel">
          <span className="panelTitle">DETECTED SPEECH · AUTOMATIC</span>
          <div className="captionText">{inputText || "Your recognized speech will appear here while you speak."}</div>
        </div>
        <div className="panel output">
          <span className="panelTitle">URDU TRANSLATION</span>
          <div className="result" dir="rtl">{outputText || "اردو ترجمہ یہاں ظاہر ہوگا۔"}</div>
        </div>
        <div className="actions">
          {!connected ? <button className="primary" disabled={connecting || offline} onClick={startLive}>● Start listening</button> : <button className="stopButton" onClick={stopLive}>■ Stop listening</button>}
          <button disabled={!inputText && !outputText} onClick={clearCaptions}>Clear captions</button>
        </div>
        <p className="status" role="status">{status}</p>
        {error && <p className="errorText" role="alert">{error}</p>}
      </section>

      <section className="offlineCard">
        <div className="offlineIcon">⌁</div>
        <div><strong>Internet connection required</strong><p>Gemini processes live audio online. The installed PWA can cache its interface, but live AI translation does not work offline. Audio is streamed to Google while the session is active.</p></div>
      </section>
      <footer>API credentials stay on the server · Translation target is fixed to Urdu · Microphone access is used only while listening.</footer>
    </main>
  );
}
