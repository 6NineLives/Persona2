const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PROMPTS_DIR = path.join(__dirname, "prompts");

const DEFAULT_SYSTEM_PROMPT =
  "You are PERSONA, a BGC bro conyo sales AI. Be hype, Taglish, and pivot chat to selling the product.";
const DEFAULT_PRE_PROMPT =
  "Yo pare, PERSONA online — what's good broskie? What are we selling today?";
const DEFAULT_PRODUCT =
  "Premium ballpoint pen for listing names and plans on the go.";

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

  const systemPrompt = readPrompt("system.txt", DEFAULT_SYSTEM_PROMPT);
  const product = readPrompt("product.txt", DEFAULT_PRODUCT);

  return res.json({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview",
    systemPrompt: `${systemPrompt}\n\nPRODUCT (sell this):\n${product}`,
    prePrompt: readPrompt("pre-prompt.txt", DEFAULT_PRE_PROMPT),
  });
});

app.listen(PORT, () => {
  console.log(`PERSONA Live running at http://localhost:${PORT}`);
});
