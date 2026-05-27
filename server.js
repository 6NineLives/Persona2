const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PROMPTS_DIR = path.join(__dirname, "prompts");

const DEFAULT_SYSTEM_PROMPT =
  "You are J.A.R.V.I.S., a helpful realtime assistant. Be concise and clear.";
const DEFAULT_PRE_PROMPT =
  "Systems online. Greet the user briefly, then ask how you can help.";

function readPrompt(filename, fallback) {
  try {
    const filePath = path.join(PROMPTS_DIR, filename);
    const text = fs.readFileSync(filePath, "utf8").trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (_req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing. Add it to your .env file.",
    });
  }

  return res.json({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview",
    systemPrompt: readPrompt("system.txt", DEFAULT_SYSTEM_PROMPT),
    prePrompt: readPrompt("pre-prompt.txt", DEFAULT_PRE_PROMPT),
  });
});

app.listen(PORT, () => {
  console.log(`JARVIS Live demo running at http://localhost:${PORT}`);
});
