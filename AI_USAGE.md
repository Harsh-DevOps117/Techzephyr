# AI usage declaration

## Product AI

The backend calls Groq through its OpenAI-compatible interface. The model is configured by `GROQ_MODEL`; its credential is supplied only at runtime in `GROQ_API_KEY` and is never committed.

The AI layer translates English or Hinglish venue requests into editable booking drafts and can explain computed decisions. The product prompt is in `src/application/ai/booking-request-parser.ts`.

The AI is not allowed to approve or reject requests, determine category priority, select an unvalidated room/time, bypass permissions, validate schedules, or apply changes. The deterministic validator and role-based approval workflow remain authoritative. If AI is unavailable, manual booking remains available.

## Development AI

Codex was used to build and review the TypeScript API, deterministic scheduling engine, worker integration, tests, documentation and Next.js interface. Product behavior remains reviewable in this repository and subject to the official validator.
