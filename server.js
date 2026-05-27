const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PROMPTS_DIR = path.join(__dirname, "prompts");

function readPrompt(filename) {
  const filePath = path.join(PROMPTS_DIR, filename);
  return fs.readFileSync(filePath, "utf8").trim();
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
    systemPrompt: readPrompt("system.txt"),
    prePrompt: readPrompt("pre-prompt.txt"),
  });
});

app.listen(PORT, () => {
  console.log(`JARVIS Live demo running at http://localhost:${PORT}`);
});
