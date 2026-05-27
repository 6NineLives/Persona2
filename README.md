# Gemini Live Realtime Demo

Simple local demo that:
- captures your webcam video
- captures your microphone audio
- streams both to Gemini Live
- supports editable **system prompt** and **pre-prompt**

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set your API key:

```bash
copy .env.example .env
```

3. Start the server:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## Prompts

Edit these files (no UI fields):

- `prompts/system.txt` — personality and behavior (sent as `systemInstruction`)
- `prompts/pre-prompt.txt` — opening line sent once after connect

Restart the server after changing prompt files.

## Notes

- Model must be `gemini-3.1-flash-live-preview` (older live models are shut down).
- Pre-prompt is sent with `sendRealtimeInput({ text })`, not `sendClientContent`.
- Audio/video chunks must use `audio` and `video` keys in `sendRealtimeInput`.
- Use headphones while testing to avoid mic echo.
- This is intentionally minimal and for local development.
- The `/api/config` endpoint returns your key to the browser; do not deploy this directly to production.
