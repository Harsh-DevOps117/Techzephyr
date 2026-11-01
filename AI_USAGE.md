# AI usage declaration

## Product AI

The backend calls Groq through its OpenAI-compatible interface. The model is configured by `GROQ_MODEL`; its credential is supplied only at runtime in `GROQ_API_KEY` and is never committed.

The AI layer translates English or Hinglish venue requests into editable booking drafts. Explanations of placements and booking decisions are read from the stored deterministic result (`/api/v1/ai/explain` and `/api/v1/schedules/:id/explanations/:sessionId`). The product prompt is in `src/application/ai/booking-request-parser.ts`. If Groq is missing or fails, those routes answer with a clear message and the manual form stays available. They do not return HTTP 503.

The AI is not allowed to approve or reject requests, determine category priority, select an unvalidated room/time, bypass permissions, validate schedules, or apply changes. The deterministic validator and role-based approval workflow remain authoritative. If AI is unavailable, manual booking remains available.

Input and output are checked with the `llm-guardrails` library (prompt injection, length, toxicity, and secrets) plus campus rules that block approval, priority, and role-bypass requests. Blocked prompts never reach the model. The voice button on the workspace only asks for a draft and speaks that draft back.

## Development AI

Codex was used to build and review the TypeScript API, deterministic scheduling engine, worker integration, tests, documentation and Next.js interface. Product behavior remains reviewable in this repository and subject to the official validator.
