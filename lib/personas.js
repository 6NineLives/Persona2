const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractStarterVocabulary(personaBody) {
  const match = personaBody.match(/\*\*Starter Vocabulary\*\*:\s*([^\n]+)/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
}

function parsePersonaMarkdown(content) {
  const universalIndex = content.indexOf("## Universal Sales Framework");
  const universalFramework =
    universalIndex >= 0 ? content.slice(universalIndex).trim() : "";

  const personaSection = universalIndex >= 0 ? content.slice(0, universalIndex) : content;
  const personaRegex = /## Persona (\d+): ([^\n]+)\n([\s\S]*?)(?=\n## Persona \d+:|$)/g;

  const personas = [];
  let match = personaRegex.exec(personaSection);
  while (match) {
    const name = match[2].trim();
    const body = match[3].trim();
    personas.push({
      id: slugify(name),
      number: Number.parseInt(match[1], 10),
      name,
      body,
      vocabulary: extractStarterVocabulary(body),
    });
    match = personaRegex.exec(personaSection);
  }

  return { personas, universalFramework };
}

function parseSlangMarkdown(content) {
  const slangByPersonaId = {};
  const sectionRegex = /## ([^\n]+) Slang Dictionary\n([\s\S]*?)(?=\n## |\n---\s*$|$)/g;
  let match = sectionRegex.exec(content);

  while (match) {
    const personaName = match[1].trim();
    const sectionBody = match[2];
    const terms = [];
    const termRegex = /^- (.+)$/gm;
    let termMatch = termRegex.exec(sectionBody);
    while (termMatch) {
      terms.push(termMatch[1].trim());
      termMatch = termRegex.exec(sectionBody);
    }
    slangByPersonaId[slugify(personaName)] = terms;
    match = sectionRegex.exec(content);
  }

  return slangByPersonaId;
}

let cachedBundle = null;

function loadPersonaBundle() {
  if (cachedBundle) return cachedBundle;

  const personaPath = path.join(DATA_DIR, "persona.md");
  const slangPath = path.join(DATA_DIR, "archetype_type.md");

  const personaMarkdown = fs.readFileSync(personaPath, "utf8");
  const slangMarkdown = fs.existsSync(slangPath)
    ? fs.readFileSync(slangPath, "utf8")
    : "";

  const { personas, universalFramework } = parsePersonaMarkdown(personaMarkdown);
  const slangByPersonaId = parseSlangMarkdown(slangMarkdown);

  for (const persona of personas) {
    persona.slang = slangByPersonaId[persona.id] ?? [];
    persona.matchTerms = [...new Set([...persona.vocabulary, ...persona.slang])];
  }

  cachedBundle = { personas, universalFramework, slangByPersonaId };
  return cachedBundle;
}

function scorePersona(persona, text) {
  const normalized = text.toLowerCase();
  let score = 0;

  for (const term of persona.matchTerms) {
    const needle = term.toLowerCase();
    if (!needle) continue;
    if (normalized.includes(needle)) {
      score += needle.includes(" ") ? 3 : 1;
    }
  }

  return score;
}

function classifyPersona(userText) {
  const { personas } = loadPersonaBundle();
  const text = userText.trim();

  if (!text || personas.length === 0) {
    return personas[0] ?? null;
  }

  let best = personas[0];
  let bestScore = -1;

  for (const persona of personas) {
    const score = scorePersona(persona, text);
    if (score > bestScore) {
      bestScore = score;
      best = persona;
    }
  }

  return best;
}

function buildPersonaSwitchPrompt(persona) {
  const { universalFramework } = loadPersonaBundle();
  const slangHint =
    persona.slang.length > 0
      ? persona.slang.slice(0, 24).join(", ")
      : persona.vocabulary.join(", ");

  return `[PERSONA LOCK — do not read this aloud]

The customer just spoke for the first time. From your NEXT spoken reply onward, fully adopt this ShopSmart online shopping persona and stay in character for the rest of the session.

Persona: ${persona.name}

${persona.body}

Use vocabulary naturally (examples: ${slangHint}).

SHOPPING-CENTRIC RULES (required for every reply after lock):
- You are a live sales associate on ShopSmart—every response must help them shop.
- Steer toward: what they want to buy, category, budget, size, color, occasion, compare options, deals, add to cart, checkout, delivery.
- If they go off-topic, acknowledge briefly in persona voice, then redirect to products or their cart.
- Use camera only for shopping cues (outfit, item they're holding, style match)—not small talk.
- Suggest concrete next steps: "check this pick," "same style in another color," "bundle deal," "filter by price."

${universalFramework}

Mirror the customer's energy. Keep every turn shopping-focused in this voice. Do not mention personas, switches, or being an AI.`;
}

module.exports = {
  loadPersonaBundle,
  classifyPersona,
  buildPersonaSwitchPrompt,
};
