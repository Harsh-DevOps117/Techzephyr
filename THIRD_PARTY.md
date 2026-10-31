# Third-party software

TechZephyr uses the following open-source packages and services. Scheduling correctness does not depend on an AI model or external solver.

- Express and CORS — HTTP API and browser access controls.
- PostgreSQL (`pg`) — durable datasets, schedule versions, approvals and audit records.
- RabbitMQ (`amqplib`) — durable background-job delivery.
- Redis — rate limiting and short-lived read caching.
- Zod — request and AI-draft schema validation.
- jose and bcryptjs — JWT authentication and password verification.
- uuid — UUIDv7 identifiers.
- Next.js and React — TypeScript web application.
- OpenAI JavaScript SDK — optional Groq-compatible booking-draft extraction only.
- TypeScript and tsx — compilation and development tooling.
- Swagger UI — local OpenAPI documentation.

The deterministic timetable, exam, repair and booking algorithms are implemented in this repository under `src/application/scheduling/solver.ts`. The supplied `validator.py` remains the final correctness contract.
