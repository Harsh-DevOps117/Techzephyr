# AI usage declaration

## Product AI

### Provider, model, and credentials

The product uses the Grok API for natural-language assistance. The selected model and API credential are supplied through runtime environment variables and are never committed to the repository. The integration uses an OpenAI-compatible client interface.

### What AI is used for

The AI layer can:

- translate an English or Hinglish venue request into an editable structured booking draft;
- translate a faculty schedule-change request into an editable disruption draft; and
- help present explanations based on deterministic schedule and booking results already stored by the application.

AI output is always a draft or explanation. The user can review and edit booking information before submission. If the AI provider is unavailable, the manual booking form and manual disruption-file workflow remain available.

### Prompt locations

- Venue-request extraction prompt: `src/application/ai/booking-request-parser.ts`
- Schedule-change extraction prompt: `src/application/ai/schedule-change-parser.ts`
- AI guardrails and blocked-intent policy: `src/application/ai/guardrails.ts`
- Deterministic availability and explanation routes: `src/application/ai/availability.ts` and `src/interfaces/http/app.ts`

### Guardrails and validation boundary

Inputs and model outputs are checked with `llm-guardrails` for prompt injection, excessive length, toxicity, and secrets. Additional campus rules block requests that attempt to approve or publish a schedule, change priority, escalate a role, bypass permissions, or skip validation. Blocked prompts do not reach the model.

The LLM is **not allowed** to:

- approve or reject a booking or timetable proposal;
- decide booking priority or alter category caps;
- select or apply an unvalidated room, time, or schedule change;
- bypass authentication, role-based authorization, hard constraints, or Admin approval;
- validate schedules, exams, repairs, or bookings; or
- write directly to the production schedule state.

The deterministic scheduling engine, booking checks, the official `validator.py`, and the role-based approval workflow are authoritative. Every generated schedule proposal is validated before it can be approved or applied.

## Development AI

### Team ownership

The system architecture, product scope, scheduling rules, security requirements, technology choices, review criteria, and acceptance decisions were designed and owned by **Team Cod-i**. AI tools were used to generate and accelerate implementation code under that team direction.

The following AI tools were used during development:

- **OpenAI Codex** - implementation assistance, code review, documentation, testing guidance, and the Next.js user interface.
- **Cursor, using its Grok-based AI assistant** - coding assistance, refactoring support, debugging, and frontend development.
- **MCP-enabled development tooling** - inspection of local project context and documentation.

The implementation code was produced with assistance from these AI tools. Team Cod-i retained responsibility for the architecture, requirements, integration choices, testing, review, and final submission.

These tools were used only during development. They are not part of the production decision path and have no authority over schedules, examinations, bookings, priorities, or approvals.

All product behaviour remains reviewable in this repository and is subject to the application's deterministic checks and the official validator.
