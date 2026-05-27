import { GoogleGenAI, Modality } from "https://esm.sh/@google/genai@2.6.0";

const statusLine = document.getElementById("statusLine");
const statusPill = document.getElementById("statusPill");
const linkState = document.getElementById("linkState");
const modelName = document.getElementById("modelName");
const visorRing = document.getElementById("visorRing");
const logEl = document.getElementById("log");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const localVideo = document.getElementById("localVideo");

let liveSession = null;
let mediaStream = null;
let videoInterval = null;
let captureContext = null;
let micWorklet = null;
let micSource = null;
let audioPlayer = null;

function setPill(state, label) {
  statusPill.className = `status-pill ${state}`;
  statusPill.textContent = label;
}

function setStatus(text, { live = false, pill = "connecting", pillLabel } = {}) {
  statusLine.textContent = text;
  statusLine.classList.toggle("live", live);
  if (pillLabel) setPill(pill, pillLabel);
}

function appendLog(text, type = "system") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = text;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function setLink(online) {
  linkState.textContent = online ? "ONLINE" : "OFFLINE";
  linkState.style.color = online ? "var(--active)" : "var(--muted)";
}

function floatToPcm16(float32) {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm16;
}

function pcm16ToBase64(pcm16) {
  const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function downsampleTo16k(float32, inputSampleRate) {
  if (inputSampleRate === 16000) {
    return floatToPcm16(float32);
  }

  const ratio = inputSampleRate / 16000;
  const length = Math.floor(float32.length / ratio);
  const downsampled = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    downsampled[i] = float32[Math.floor(i * ratio)];
  }

  return floatToPcm16(downsampled);
}

class AudioPlayer {
  constructor() {
    this.context = new AudioContext({ sampleRate: 24000 });
    this.nextStartTime = 0;
  }

  async resume() {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  playBase64Pcm(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const pcm16 = new Int16Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i += 1) {
      float32[i] = pcm16[i] / 32768;
    }

    const buffer = this.context.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    const now = this.context.currentTime;
    const startAt = Math.max(now, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
  }

  reset() {
    this.nextStartTime = 0;
  }

  close() {
    this.context.close();
  }
}

async function getConfig() {
  const res = await fetch("/api/config");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Config fetch failed");
  return data;
}

function handleServerMessage(message) {
  const content = message.serverContent;
  if (!content) return;

  if (content.interrupted) {
    audioPlayer?.reset();
    appendLog("Signal interrupted", "system");
  }

  if (content.inputTranscription?.text) {
    appendLog(content.inputTranscription.text, "user");
  }

  if (content.outputTranscription?.text) {
    appendLog(content.outputTranscription.text, "ai");
  }

  if (content.modelTurn?.parts) {
    for (const part of content.modelTurn.parts) {
      if (part.inlineData?.data) {
        audioPlayer?.playBase64Pcm(part.inlineData.data);
      }
      if (part.text) {
        appendLog(part.text, "ai");
      }
    }
  }
}

async function startSession() {
  try {
    logEl.innerHTML = "";
    setPill("connecting", "BOOTING");
    setStatus("Acquiring optic and audio feeds...", { pill: "connecting", pillLabel: "BOOTING" });
    startBtn.disabled = true;

    const { apiKey, model, systemPrompt, prePrompt } = await getConfig();
    const instruction =
      typeof systemPrompt === "string" && systemPrompt.trim()
        ? systemPrompt.trim()
        : "You are a helpful realtime assistant.";
    const opening =
      typeof prePrompt === "string" ? prePrompt.trim() : "";

    modelName.textContent = model.replace("gemini-", "").toUpperCase();
    const ai = new GoogleGenAI({ apiKey });
    audioPlayer = new AudioPlayer();
    await audioPlayer.resume();

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    localVideo.srcObject = mediaStream;
    await localVideo.play();

    setStatus("Establishing neural link...", { pill: "connecting", pillLabel: "LINKING" });

    let resolveOpen;
    const opened = new Promise((resolve) => {
      resolveOpen = resolve;
    });

    liveSession = await ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Aoede" },
          },
        },
        systemInstruction: instruction,
      },
      callbacks: {
        onopen: () => {
          setLink(true);
          visorRing.classList.add("active");
          setStatus("All systems operational.", {
            live: true,
            pill: "active",
            pillLabel: "ONLINE",
          });
          resolveOpen();
        },
        onerror: (event) => {
          const detail = event?.message || "Connection error";
          setPill("error", "FAULT");
          setStatus(detail);
          appendLog(detail, "error");
        },
        onclose: (event) => {
          const detail = event?.reason || event?.code || "Link terminated";
          setLink(false);
          visorRing.classList.remove("active");
          setPill("standby", "STANDBY");
          setStatus(typeof detail === "string" ? detail : "Link terminated");
          appendLog("Session ended", "system");
          cleanup(false);
          startBtn.disabled = false;
        },
        onmessage: handleServerMessage,
      },
    });

    await opened;

    if (opening) {
      liveSession.sendRealtimeInput({ text: opening });
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    videoInterval = setInterval(() => {
      if (!liveSession || !localVideo.videoWidth) return;

      canvas.width = localVideo.videoWidth;
      canvas.height = localVideo.videoHeight;
      ctx.drawImage(localVideo, 0, 0);

      const base64 = canvas.toDataURL("image/jpeg", 0.65).split(",")[1];
      liveSession.sendRealtimeInput({
        video: {
          mimeType: "image/jpeg",
          data: base64,
        },
      });
    }, 1000);

    captureContext = new AudioContext();
    await captureContext.resume();
    await captureContext.audioWorklet.addModule("./audio-processor.js");

    micSource = captureContext.createMediaStreamSource(mediaStream);
    micWorklet = new AudioWorkletNode(captureContext, "pcm-capture");
    micSource.connect(micWorklet);

    micWorklet.port.onmessage = (event) => {
      if (!liveSession) return;

      const pcm16 = downsampleTo16k(event.data, captureContext.sampleRate);
      liveSession.sendRealtimeInput({
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: pcm16ToBase64(pcm16),
        },
      });
    };

    stopBtn.disabled = false;
    setStatus("Listening. Speak when ready.", {
      live: true,
      pill: "active",
      pillLabel: "ONLINE",
    });
  } catch (error) {
    setPill("error", "FAULT");
    setStatus(error.message);
    appendLog(error.message, "error");
    cleanup(false);
    startBtn.disabled = false;
  }
}

function cleanup(resetUi = true) {
  if (videoInterval) {
    clearInterval(videoInterval);
    videoInterval = null;
  }

  if (micWorklet) {
    micWorklet.port.onmessage = null;
    micWorklet.disconnect();
    micWorklet = null;
  }

  if (micSource) {
    micSource.disconnect();
    micSource = null;
  }

  if (captureContext) {
    captureContext.close();
    captureContext = null;
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
    localVideo.srcObject = null;
  }

  if (liveSession) {
    liveSession.close();
    liveSession = null;
  }

  if (audioPlayer) {
    audioPlayer.close();
    audioPlayer = null;
  }

  if (resetUi) {
    stopBtn.disabled = true;
    setLink(false);
    visorRing.classList.remove("active");
    setPill("standby", "STANDBY");
    setStatus("Awaiting initialization");
  }
}

startBtn.addEventListener("click", startSession);
stopBtn.addEventListener("click", () => {
  cleanup();
  startBtn.disabled = false;
  setStatus("Awaiting initialization");
});

setPill("standby", "STANDBY");
setLink(false);
