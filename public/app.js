import { GoogleGenAI, Modality } from "https://esm.run/@google/genai";
import {
  PRODUCT_CATALOG,
  YELLOW_DRESS_REPLY,
  detectProductTrigger,
} from "./products.js";

const statusLine = document.getElementById("statusLine");
const statusPill = document.getElementById("statusPill");
const linkState = document.getElementById("linkState");
const modelName = document.getElementById("modelName");
const agentStage = document.getElementById("agentStage");
const agentStateLabel = document.getElementById("agentStateLabel");
const cameraPreview = document.getElementById("cameraPreview");
const productOfferSidebar = document.getElementById("productOfferSidebar");
const productOfferClose = document.getElementById("productOfferClose");
const productOfferFab = document.getElementById("productOfferFab");
const productOfferTag = document.getElementById("productOfferTag");
const productOfferTitle = document.getElementById("productOfferTitle");
const productOfferImage = document.getElementById("productOfferImage");
const productOfferPrice = document.getElementById("productOfferPrice");
const productOfferDescription = document.getElementById("productOfferDescription");
const productOfferNav = document.getElementById("productOfferNav");
const productOfferPrev = document.getElementById("productOfferPrev");
const productOfferNext = document.getElementById("productOfferNext");
const productOfferDots = document.getElementById("productOfferDots");
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
let suppressAiForYellowDress = false;
let activeProductCatalogId = null;
let activeProductIndex = 0;

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

function setAgentSpeaking(active) {
  if (speakingTimeout) {
    clearTimeout(speakingTimeout);
    speakingTimeout = null;
  }

  if (active) {
    setAgentVisualizerState("speaking");
    return;
  }

  if (liveSession) {
    setAgentVisualizerState("listening");
  }
}

function setSpeaking(active) {
  setAgentSpeaking(active);
  if (active) {
    speakingTimeout = setTimeout(() => {
      if (liveSession) {
        setAgentVisualizerState("listening");
      }
      speakingTimeout = null;
    }, 400);
  }
}

function stopHardcodedTts() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function pickFemaleEnglishVoice(voices) {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  if (!english.length) return null;

  const femalePattern =
    /female|samantha|victoria|zira|karen|moira|fiona|tessa|joanna|amy|emma|ava|jenny|aria|hazel|susan|linda|serena|sara/i;
  const malePattern =
    /male|\bdavid\b|\bmark\b|\bjames\b|\bguy\b|\bryan\b|\bfred\b|\bgeorge\b|\bdaniel\b|\balex\b/i;

  return (
    english.find((v) => v.gender === "female") ||
    english.find((v) => femalePattern.test(v.name)) ||
    english.find((v) => !malePattern.test(v.name))
  );
}

function speakHardcodedReply(text) {
  if (!text || typeof window === "undefined" || !window.speechSynthesis) return;

  stopHardcodedTts();

  const startSpeaking = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1.05;

    const femaleVoice = pickFemaleEnglishVoice(window.speechSynthesis.getVoices());
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    utterance.onstart = () => setAgentSpeaking(true);
    utterance.onend = () => setAgentSpeaking(false);
    utterance.onerror = () => setAgentSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length > 0) {
    startSpeaking();
    return;
  }

  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.onvoiceschanged = null;
    startSpeaking();
  };
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

function setProductSidebarOpen(open) {
  if (!productOfferSidebar) return;
  productOfferSidebar.classList.toggle("open", open);
  productOfferSidebar.setAttribute("aria-hidden", open ? "false" : "true");
}

function renderProductItem(catalogId, index) {
  const catalog = PRODUCT_CATALOG[catalogId];
  if (!catalog?.items?.length) return;

  const itemCount = catalog.items.length;
  const safeIndex = ((index % itemCount) + itemCount) % itemCount;
  const item = catalog.items[safeIndex];

  activeProductCatalogId = catalogId;
  activeProductIndex = safeIndex;

  if (productOfferTag) productOfferTag.textContent = catalog.tag;
  if (productOfferTitle) productOfferTitle.textContent = item.title;
  if (productOfferImage) {
    productOfferImage.src = item.image;
    productOfferImage.alt = item.title;
  }
  if (productOfferPrice) productOfferPrice.textContent = item.price;
  if (productOfferDescription) productOfferDescription.textContent = item.description;

  if (productOfferNav) {
    productOfferNav.classList.toggle("hidden", itemCount <= 1);
  }

  if (productOfferDots) {
    productOfferDots.innerHTML = "";
    catalog.items.forEach((_, dotIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `offer-dot${dotIndex === safeIndex ? " active" : ""}`;
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", `Item ${dotIndex + 1}`);
      dot.setAttribute("aria-selected", dotIndex === safeIndex ? "true" : "false");
      dot.addEventListener("click", () => renderProductItem(catalogId, dotIndex));
      productOfferDots.appendChild(dot);
    });
  }
}

function showProductOffer(catalogId, fromUserSpeech = false) {
  const catalog = PRODUCT_CATALOG[catalogId];
  if (!catalog) return;

  setProductSidebarOpen(true);
  renderProductItem(catalogId, 0);

  if (catalogId === "yellow-dress") {
    if (!yellowDressOffered) {
      yellowDressOffered = true;
      finalizeTranscriptTurn();
      inProgressAi = null;
      appendLog(YELLOW_DRESS_REPLY, "ai");
      speakHardcodedReply(YELLOW_DRESS_REPLY);
    } else if (fromUserSpeech) {
      finalizeTranscriptTurn();
      inProgressAi = null;
      speakHardcodedReply(YELLOW_DRESS_REPLY);
    }

    if (fromUserSpeech) {
      suppressAiForYellowDress = true;
      audioPlayer?.reset();
    }
  }
}

function shiftProductItem(delta) {
  if (!activeProductCatalogId) return;
  renderProductItem(activeProductCatalogId, activeProductIndex + delta);
}

function shouldOmitAiTranscript(text) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes("remains silent") ||
    normalized.includes("no spoken response") ||
    normalized.includes("[ai remains silent") ||
    normalized.includes("do not read aloud") ||
    normalized.includes("stay completely silent")
  );
}

function maybeTriggerProductFromUserSpeech(text) {
  const catalogId = detectProductTrigger(text);
  if (!catalogId) return;
  showProductOffer(catalogId, true);
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
  if (type === "ai" && (suppressAiForYellowDress || shouldOmitAiTranscript(text))) {
    return;
  }

  const state = getOrCreateTranscriptBubble(type);
  state.text = mergeTranscriptText(state.text, text);
  if (type === "ai" && shouldOmitAiTranscript(state.text)) {
    state.entry.remove();
    inProgressAi = null;
    return;
  }
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
    maybeTriggerProductFromUserSpeech(content.inputTranscription.text);
  }

  if (!suppressAiForYellowDress && content.outputTranscription?.text) {
    maybeApplyPersonaAfterUserTurn();
    inProgressUser = null;
    updateTranscript(content.outputTranscription.text, "ai");
  }

  if (content.modelTurn?.parts) {
    if (!suppressAiForYellowDress) {
      maybeApplyPersonaAfterUserTurn();
    }
    for (const part of content.modelTurn.parts) {
      if (part.inlineData?.data && !suppressAiForYellowDress) {
        audioPlayer?.playBase64Pcm(part.inlineData.data);
      }
      if (part.text && !suppressAiForYellowDress) {
        inProgressUser = null;
        updateTranscript(part.text, "ai");
      }
    }
  }

  if (content.turnComplete) {
    maybeApplyPersonaAfterUserTurn();
    if (suppressAiForYellowDress) {
      suppressAiForYellowDress = false;
    }
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
    suppressAiForYellowDress = false;
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

  stopHardcodedTts();
  setAgentSpeaking(false);

  personaApplied = false;
  lastUserMessageText = "";
  yellowDressOffered = false;
  suppressAiForYellowDress = false;

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

if (productOfferClose) {
  productOfferClose.addEventListener("click", () => {
    setProductSidebarOpen(false);
  });
}

if (productOfferPrev) {
  productOfferPrev.addEventListener("click", () => shiftProductItem(-1));
}

if (productOfferNext) {
  productOfferNext.addEventListener("click", () => shiftProductItem(1));
}

if (productOfferFab) {
  productOfferFab.addEventListener("click", () => {
    showProductOffer("yellow-dress", false);
  });
}

setPill("standby", "STANDBY");
setLink(false);
setAgentVisualizerState("idle");
setCameraPreviewVisible(false);
