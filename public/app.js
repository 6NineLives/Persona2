import { GoogleGenAI, Modality } from "https://esm.run/@google/genai";

const statusLine = document.getElementById("statusLine");
const statusPill = document.getElementById("statusPill");
const linkState = document.getElementById("linkState");
const modelName = document.getElementById("modelName");
const agentStage = document.getElementById("agentStage");
const agentStateLabel = document.getElementById("agentStateLabel");
const cameraPreview = document.getElementById("cameraPreview");
const yellowDressSidebar = document.getElementById("yellowDressSidebar");
const yellowDressClose = document.getElementById("yellowDressClose");
const yellowDressFab = document.getElementById("yellowDressFab");
const logEl = document.getElementById("log");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const localVideo = document.getElementById("localVideo");

const AGENT_STATE_LABELS = {
  idle: "Ready",
  connecting: "Connecting…",
  listening: "Listening",
  thinking: "Thinking…",
  speaking: "Speaking",
  disconnected: "Disconnected",
};

let speakingTimeout = null;
let inProgressUser = null;
let inProgressAi = null;
let personaApplied = false;
let personaMatchers = [];
let personaPromptsById = {};
let lastUserMessageText = "";
let yellowDressOffered = false;

let liveSession = null;
let mediaStream = null;
let videoInterval = null;
let captureContext = null;
let scriptProcessor = null;
let micSource = null;
let silentGain = null;
let audioPlayer = null;

function setAgentVisualizerState(state) {
  agentStage.dataset.state = state;
  agentStateLabel.textContent = AGENT_STATE_LABELS[state] ?? state;
}

function setSpeaking(active) {
  if (speakingTimeout) {
    clearTimeout(speakingTimeout);
    speakingTimeout = null;
  }

  if (active) {
    setAgentVisualizerState("speaking");
    speakingTimeout = setTimeout(() => {
      if (liveSession) {
        setAgentVisualizerState("listening");
      }
      speakingTimeout = null;
    }, 400);
    return;
  }

  if (liveSession) {
    setAgentVisualizerState("listening");
  }
}

function setPill(state, label) {
  statusPill.className = `status-pill ${state}`;
  statusPill.textContent = label;

  if (state === "connecting") {
    setAgentVisualizerState("connecting");
  } else if (state === "active") {
    setAgentVisualizerState("listening");
  } else if (state === "error") {
    setAgentVisualizerState("disconnected");
  } else {
    setAgentVisualizerState("idle");
  }
}

function setCameraPreviewVisible(visible) {
  cameraPreview.classList.toggle("hidden", !visible);
  cameraPreview.setAttribute("aria-hidden", visible ? "false" : "true");
}

function setYellowDressSidebar(open) {
  if (!yellowDressSidebar) return;
  yellowDressSidebar.classList.toggle("open", open);
  yellowDressSidebar.setAttribute("aria-hidden", open ? "false" : "true");
}

function showYellowDressOffer() {
  if (!yellowDressOffered) {
    yellowDressOffered = true;
    appendLog(
      "You mentioned a yellow dress—great pick for ShopSmart. This Sunny Day Yellow Wrap Dress is ₱1,890: light, breathable, and easy for mall days or weekend hangouts. Want me to check your size, similar styles, or add it to your cart?",
      "ai",
    );
  }
  setYellowDressSidebar(true);
}

function maybeTriggerYellowDressFromText(text) {
  if (!text) return;
  if (text.toLowerCase().includes("yellow dress")) {
    showYellowDressOffer();
  }
}

function setStatus(text, { live = false, pill = "connecting", pillLabel } = {}) {
  statusLine.textContent = text;
  statusLine.classList.toggle("live", live);
  if (pillLabel) setPill(pill, pillLabel);
}

function mergeTranscriptText(existing, incoming) {
  const inc = incoming.trim();
  if (!inc) return existing;
  if (!existing) return inc;
  if (inc === existing) return existing;
  if (inc.startsWith(existing)) return inc;
  if (existing.startsWith(inc)) return existing;
  if (existing.endsWith(inc)) return existing;
  return `${existing} ${inc}`.replace(/\s+/g, " ").trim();
}

function scrollLogToBottom() {
  logEl.scrollTop = logEl.scrollHeight;
}

function finalizeTranscriptTurn() {
  inProgressUser = null;
  inProgressAi = null;
}

function getOrCreateTranscriptBubble(type) {
  const inProgress = type === "user" ? inProgressUser : inProgressAi;

  if (inProgress) {
    return inProgress;
  }

  const entry = document.createElement("article");
  entry.className = `log-entry ${type}`;
  const bubble = document.createElement("div");
  bubble.className = "log-bubble";
  entry.appendChild(bubble);
  logEl.appendChild(entry);

  const state = { entry, bubble, text: "" };
  if (type === "user") {
    inProgressUser = state;
  } else {
    inProgressAi = state;
  }
  return state;
}

function updateTranscript(text, type) {
  const state = getOrCreateTranscriptBubble(type);
  state.text = mergeTranscriptText(state.text, text);
  state.bubble.textContent = state.text;
  if (type === "user") {
    lastUserMessageText = state.text;
  }
  scrollLogToBottom();
}

function appendLog(text, type = "system") {
  if (type === "user" || type === "ai") {
    updateTranscript(text, type);
    return;
  }

  finalizeTranscriptTurn();

  const entry = document.createElement("article");
  entry.className = `log-entry ${type}`;

  const bubble = document.createElement("div");
  bubble.className = "log-bubble";
  bubble.textContent = text;
  entry.appendChild(bubble);

  logEl.appendChild(entry);
  scrollLogToBottom();
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
    setSpeaking(true);
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

function classifyPersonaLocally(userText) {
  const text = userText.trim().toLowerCase();
  if (!text || personaMatchers.length === 0) {
    return personaMatchers[0] ?? null;
  }

  let best = personaMatchers[0];
  let bestScore = -1;

  for (const persona of personaMatchers) {
    let score = 0;
    for (const term of persona.terms) {
      const needle = term.toLowerCase();
      if (!needle) continue;
      if (text.includes(needle)) {
        score += needle.includes(" ") ? 3 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = persona;
    }
  }

  return best;
}

function applyPersonaFromFirstUserMessage(userText) {
  if (!liveSession || personaApplied) return;

  const persona = classifyPersonaLocally(userText);
  const personaPrompt = persona ? personaPromptsById[persona.id] : null;
  if (!personaPrompt) return;

  liveSession.sendRealtimeInput({ text: personaPrompt });
  personaApplied = true;
}

function getFirstUserMessageText() {
  return (inProgressUser?.text || lastUserMessageText || "").trim();
}

function maybeApplyPersonaAfterUserTurn() {
  if (personaApplied) return;
  const userText = getFirstUserMessageText();
  if (!userText) return;
  applyPersonaFromFirstUserMessage(userText);
}

function handleServerMessage(message) {
  const content = message.serverContent;
  if (!content) return;

  if (content.interrupted) {
    audioPlayer?.reset();
    setSpeaking(false);
    finalizeTranscriptTurn();
    appendLog("Signal interrupted", "system");
  }

  if (content.inputTranscription?.text) {
    inProgressAi = null;
    updateTranscript(content.inputTranscription.text, "user");
    maybeTriggerYellowDressFromText(content.inputTranscription.text);
  }

  if (content.outputTranscription?.text) {
    maybeApplyPersonaAfterUserTurn();
    inProgressUser = null;
    updateTranscript(content.outputTranscription.text, "ai");
    maybeTriggerYellowDressFromText(content.outputTranscription.text);
  }

  if (content.modelTurn?.parts) {
    maybeApplyPersonaAfterUserTurn();
    for (const part of content.modelTurn.parts) {
      if (part.inlineData?.data) {
        audioPlayer?.playBase64Pcm(part.inlineData.data);
      }
      if (part.text) {
        inProgressUser = null;
        updateTranscript(part.text, "ai");
        maybeTriggerYellowDressFromText(part.text);
      }
    }
  }

  if (content.turnComplete) {
    maybeApplyPersonaAfterUserTurn();
    finalizeTranscriptTurn();
  }
}

async function startSession() {
  try {
    logEl.innerHTML = "";
    finalizeTranscriptTurn();
    personaApplied = false;
    lastUserMessageText = "";
    setPill("connecting", "BOOTING");
    setStatus("Acquiring optic and audio feeds...", { pill: "connecting", pillLabel: "BOOTING" });
    startBtn.disabled = true;

    const config = await getConfig();
    const { apiKey, model, systemPrompt, prePrompt } = config;
    personaMatchers = config.personaMatchers ?? [];
    personaPromptsById = config.personaPromptsById ?? {};
    personaApplied = false;
    yellowDressOffered = false;
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
    setCameraPreviewVisible(true);

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
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
      },
      callbacks: {
        onopen: () => {
          setLink(true);
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
          setCameraPreviewVisible(false);
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

    if (prePrompt) {
      liveSession.sendRealtimeInput({ text: prePrompt });
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

    micSource = captureContext.createMediaStreamSource(mediaStream);
    scriptProcessor = captureContext.createScriptProcessor(4096, 1, 1);
    silentGain = captureContext.createGain();
    silentGain.gain.value = 0;

    micSource.connect(scriptProcessor);
    scriptProcessor.connect(silentGain);
    silentGain.connect(captureContext.destination);

    scriptProcessor.onaudioprocess = (event) => {
      if (!liveSession) return;

      const inputData = event.inputBuffer.getChannelData(0);
      const pcm16 = downsampleTo16k(inputData, captureContext.sampleRate);

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

  if (scriptProcessor) {
    scriptProcessor.onaudioprocess = null;
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }

  if (micSource) {
    micSource.disconnect();
    micSource = null;
  }

  if (silentGain) {
    silentGain.disconnect();
    silentGain = null;
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
    setCameraPreviewVisible(false);
  }

  if (liveSession) {
    liveSession.close();
    liveSession = null;
  }

  if (audioPlayer) {
    audioPlayer.close();
    audioPlayer = null;
  }

  personaApplied = false;
  lastUserMessageText = "";
  yellowDressOffered = false;

  if (resetUi) {
    stopBtn.disabled = true;
    setLink(false);
    setSpeaking(false);
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

if (yellowDressClose) {
  yellowDressClose.addEventListener("click", () => {
    setYellowDressSidebar(false);
  });
}

if (yellowDressFab) {
  yellowDressFab.addEventListener("click", () => {
    showYellowDressOffer();
  });
}

setPill("standby", "STANDBY");
setLink(false);
setAgentVisualizerState("idle");
setCameraPreviewVisible(false);
