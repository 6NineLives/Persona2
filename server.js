const fs = require("fs");
const path = require("path");
const express = require("express");
const dotenv = require("dotenv");
const {
  loadPersonaBundle,
  classifyPersona,
  buildPersonaSwitchPrompt,
} = require("./lib/personas");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PROMPTS_DIR = path.join(__dirname, "prompts");

function readPrompt(filename) {
  const filePath = path.join(PROMPTS_DIR, filename);
  return fs.readFileSync(filePath, "utf8").trim();
}

function buildSystemPrompt() {
  const { universalFramework } = loadPersonaBundle();
  const base = readPrompt("system.txt");
  return universalFramework ? `${base}\n\n${universalFramework}` : base;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/output", express.static(path.join(__dirname, "output")));

app.get("/api/config", (_req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing. Add it to your .env file.",
    });
  }

  const { personas } = loadPersonaBundle();

  return res.json({
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview",
    systemPrompt: buildSystemPrompt(),
    prePrompt: readPrompt("pre-prompt.txt"),
    personaCount: personas.length,
    personaMatchers: personas.map((persona) => ({
      id: persona.id,
      name: persona.name,
      terms: persona.matchTerms,
    })),
    personaPromptsById: Object.fromEntries(
      personas.map((persona) => [persona.id, buildPersonaSwitchPrompt(persona)]),
    ),
  });
});

app.post("/api/classify-persona", (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }

  const persona = classifyPersona(text);
  if (!persona) {
    return res.status(500).json({ error: "No personas loaded from data/persona.md" });
  }

  return res.json({
    personaId: persona.id,
    personaName: persona.name,
    personaPrompt: buildPersonaSwitchPrompt(persona),
  });
});

app.listen(PORT, () => {
  console.log(`JARVIS Live demo running at http://localhost:${PORT}`);
});
