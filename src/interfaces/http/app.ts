import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import { draftForAvailabilityOption, draftForFreeSlot, judgeAvailability, readAvailabilityQuestion, type Occupant } from "../../application/ai/availability.js";
import {
  AiUnavailableError,
  parseBookingRequest,
} from "../../application/ai/booking-request-parser.js";
import { bookingDraftSchema } from "../../domain/booking/booking-draft.js";
import { parseScheduleChange } from "../../application/ai/schedule-change-parser.js";
import { authenticate, confirmPasswordReset, login, logout, refresh, requestPasswordReset } from "../../application/auth/auth-service.js";
import { assertAiInput, GuardrailBlockedError } from "../../application/ai/guardrails.js";
import { logger } from "../../infrastructure/logging/logger.js";
import {
  IdempotencyKeyReuseError,
  beginIdempotentCommand,
  completeIdempotentCommand,
} from "../../application/idempotency/service.js";
import { createJob, publishOutbox } from "../../application/jobs/service.js";
import type { Role } from "../../domain/shared/types.js";
import { decideBookings, type CitDataset, type Day, type HeldSlot, type Placement } from "../../application/scheduling/solver.js";
import {
  getCachedJson,
  setCachedJson,
} from "../../infrastructure/cache/redis-cache.js";
import { config } from "../../infrastructure/config/env.js";
import {
  pool,
  query,
  transaction,
} from "../../infrastructure/database/postgres.js";
import { rateLimit } from "./rate-limit.js";

type Actor = { id: string; role: Role; department: string | null };
type AuthedRequest = Request & { actor?: Actor; requestId: string };

const roleSchema = z.enum([
  "admin",
  "department_coordinator",
  "faculty",
  "club",
]);
const actorIdSchema = z.string().uuid();
const idempotencyKeySchema = z.string().uuid();
const accessCookieName = "tz_access";
const refreshCookieName = "tz_refresh";

function readCookie(req: Request, name: string): string | undefined {
  const encoded = req.header("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

function sessionCookieOptions(maxAge: number, path = "/") {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax" as const,
    path,
    maxAge,
  };
}

function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
) {
  res.cookie(accessCookieName, tokens.accessToken, sessionCookieOptions(tokens.expiresIn * 1000));
  res.cookie(refreshCookieName, tokens.refreshToken, sessionCookieOptions(config.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000));
}

function clearSessionCookies(res: Response) {
  res.clearCookie(accessCookieName, { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "lax", path: "/" });
  res.clearCookie(refreshCookieName, { httpOnly: true, secure: config.NODE_ENV === "production", sameSite: "lax", path: "/" });
}

function asyncRoute(
  fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    void fn(req as AuthedRequest, res, next).catch(next);
}

function requireRole(...allowed: Role[]) {
  return asyncRoute(async (req, _res, next) => {
    const bearer = req.header("authorization")?.match(/^Bearer (.+)$/i)?.[1] ?? readCookie(req, accessCookieName);
    let claims: { id: string; role: string } | null = null;
    if (bearer) {
      try {
        claims = await authenticate(bearer);
      } catch {
        throw new ApiError(401, "unauthenticated", "Sign in again");
      }
    }
    if (!claims && !config.ALLOW_HEADER_AUTH) {
      throw new ApiError(401, "unauthenticated", "Sign in again");
    }
    const id = claims?.id ?? actorIdSchema.parse(req.header("x-user-id"));
    const role = roleSchema.parse(claims?.role ?? req.header("x-user-role"));
    const found = await query<{
      id: string;
      role: Role;
      department: string | null;
    }>(
      "SELECT id, role, department FROM app_user WHERE id = $1 AND role = $2",
      [id, role],
    );
    if (!found.rowCount)
      throw new ApiError(401, "unauthenticated", "Unknown user or role");
    req.actor = found.rows[0];
    if (!allowed.includes(role))
      throw new ApiError(
        403,
        "forbidden",
        "Your role cannot perform this action",
      );
    next();
  });
}

async function idempotentCommand<T>(
  req: AuthedRequest,
  res: Response,
  route: string,
  action: (context: {
    correlationId: string;
    client: import("pg").PoolClient;
    key: string;
  }) => Promise<{ status: number; body: T; resourceId?: string }>,
) {
  const key = idempotencyKeySchema.parse(req.header("idempotency-key"));
  const actor = req.actor!;
  const result = await transaction(async (client) => {
    const decision = await beginIdempotentCommand(
      client,
      actor.id,
      req.method,
      route,
      key,
      req.body,
    );
    if (decision.kind === "replay") return { replay: decision } as const;
    if (decision.kind === "in_progress") return { inProgress: true } as const;
    const response = await action({
      client,
      key,
      correlationId: req.requestId,
    });
    await completeIdempotentCommand(
      client,
      actor.id,
      req.method,
      route,
      key,
      response.status,
      response.body,
      response.resourceId,
    );
    return { response } as const;
  });
  if (result.replay !== undefined)
    return res.status(result.replay.statusCode).json(result.replay.body);
  if ("inProgress" in result)
    return res
      .status(202)
      .json({ status: "in_progress", requestId: req.requestId });
  const publisher = await pool.connect();
  try {
    await publisher.query("BEGIN");
    await publishOutbox(publisher);
    await publisher.query("COMMIT");
  } catch (error) {
    await publisher.query("ROLLBACK");
    throw error;
  } finally {
    publisher.release();
  }
  return res.status(result.response.status).json(result.response.body);
}

const importDatasetSchema = z.object({
  dataset: z.record(z.unknown()),
  sourceName: z.string().min(1).max(255),
});
const generateSchema = z.object({ datasetVersionId: z.string().uuid() });
const repairSchema = z.object({
  baselineScheduleId: z.string().uuid(),
  datasetVersionId: z.string().uuid(),
  disruption: z.object({ changes: z.array(z.record(z.unknown())) }),
});
const bookingSchema = z.object({ scheduleVersionId: z.string().uuid() });
const aiBookingRequestSchema = z.object({
  text: z.string().trim().min(3).max(4000),
});
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
const manualEventSchema = z.object({
  scheduleVersionId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  day: z.enum(["MON", "TUE", "WED", "THU", "FRI"]),
  startPeriod: z.number().int().min(1).max(13),
  endPeriod: z.number().int().min(1).max(13),
  roomId: z.string().min(1).max(64),
  attendance: z.number().int().positive().max(10000),
  needs: z.array(z.string().min(1).max(64)).max(20).default([]),
  mandatoryGroups: z.array(z.string().min(1).max(64)).max(30).default([]),
  reason: z.string().trim().min(3).max(500),
}).refine((value) => value.endPeriod >= value.startPeriod, { message: "End period must be at or after the start period" });
const reviewActionSchema = z.object({ action: z.enum(["accept", "reject"]) });
const bookingSubmissionSchema = z.object({
  scheduleVersionId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  requestedCategory: z.enum(["institute_event", "guest_lecture", "department_event", "club_event"]),
  draft: bookingDraftSchema,
  aiAssisted: z.boolean().optional().default(false),
});

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  const allowedOrigins = new Set(config.ALLOWED_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean));
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || allowedOrigins.has(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", rateLimit("api", 120, 2));
  app.use((req, res, next) => {
    const requestId =
      req.header("x-request-id") &&
      actorIdSchema.safeParse(req.header("x-request-id")).success
        ? req.header("x-request-id")!
        : uuidv7();
    (req as AuthedRequest).requestId = requestId;
    res.setHeader("x-request-id", requestId);
    const started = Date.now();
    res.on("finish", () => {
      logger.info("http.request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
        requestId,
      });
    });
    next();
  });

  app.get(
    "/health",
    asyncRoute(async (_req, res) => {
      await query("SELECT 1");
      res.json({ status: "ok" });
    }),
  );
  app.get("/openapi.yaml", (_req, res) =>
    res.sendFile("docs/openapi.yaml", { root: process.cwd() }),
  );
  app.post(
    "/api/v1/auth/login",
    asyncRoute(async (req, res) => {
      try {
        const input = loginSchema.parse(req.body);
        const tokens = await login(input.email, input.password);
        setSessionCookies(res, tokens);
        res.json({ expiresIn: tokens.expiresIn, role: tokens.role });
      } catch {
        throw new ApiError(
          401,
          "invalid_credentials",
          "Invalid email or password",
        );
      }
    }),
  );

  app.post(
    "/api/v1/auth/password-resets",
    asyncRoute(async (req, res) => {
      const input = z.object({
        email: z.string().email(),
        phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use a phone number like +919876543210"),
      }).parse(req.body);
      try {
        res.json(await requestPasswordReset(input.email, input.phone));
      } catch (error) {
        if (error instanceof Error && error.message === "unknown_account") throw new ApiError(404, "unknown_account", "No campus account uses that email");
        if (error instanceof Error && error.message === "sms_failed") throw new ApiError(502, "sms_failed", "Twilio could not send the code. Check the demo number and try again.");
        throw error;
      }
    }),
  );

  app.post(
    "/api/v1/auth/password-resets/confirm",
    asyncRoute(async (req, res) => {
      const input = z.object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/, "Enter the 6 digit code"),
        password: z.string().min(8, "Use at least 8 characters"),
      }).parse(req.body);
      try {
        await confirmPasswordReset(input.email, input.code, input.password);
      } catch {
        throw new ApiError(400, "invalid_code", "That code is wrong or expired");
      }
      res.json({ reset: true });
    }),
  );

  app.get(
    "/api/v1/auth/me",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const found = await query<{
        id: string;
        email: string;
        display_name: string;
        role: string;
        department: string | null;
      }>(
        "SELECT id, email, display_name, role, department FROM app_user WHERE id = $1",
        [req.actor!.id],
      );
      res.json(found.rows[0]);
    }),
  );

  app.post(
    "/api/v1/auth/refresh",
    asyncRoute(async (req, res) => {
      const refreshToken = readCookie(req, refreshCookieName);
      if (!refreshToken || refreshToken.length < 20)
        throw new ApiError(401, "invalid_refresh", "Sign in again");
      try {
        const tokens = await refresh(refreshToken);
        setSessionCookies(res, tokens);
        res.json({ expiresIn: tokens.expiresIn, role: tokens.role });
      } catch {
        throw new ApiError(401, "invalid_refresh", "Sign in again");
      }
    }),
  );

  app.post(
    "/api/v1/auth/logout",
    asyncRoute(async (req, res) => {
      const refreshToken = readCookie(req, refreshCookieName);
      if (refreshToken) await logout(refreshToken);
      clearSessionCookies(res);
      res.json({ status: "signed_out" });
    }),
  );

  app.post(
    "/api/v1/datasets/import",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      const input = importDatasetSchema.parse(req.body);
      await idempotentCommand(
        req,
        res,
        "/api/v1/datasets/import",
        async ({ client, correlationId }) => {
          const datasetId = z.string().min(1).parse(input.dataset.dataset_id);
          const contentHash = createHash("sha256")
            .update(JSON.stringify(input.dataset))
            .digest("hex");
          const id = uuidv7();
          const inserted = await client.query<{ id: string }>(
            `INSERT INTO dataset_version (id, dataset_id, content_hash, source_name, payload, imported_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (dataset_id, content_hash) DO UPDATE SET source_name = EXCLUDED.source_name
         RETURNING id`,
            [
              id,
              datasetId,
              contentHash,
              input.sourceName,
              input.dataset,
              req.actor!.id,
            ],
          );
          await client.query(
            `INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, request_id, after_state)
         VALUES ($1, $2, 'dataset.imported', 'dataset_version', $3, $4, $5)`,
            [
              uuidv7(),
              req.actor!.id,
              inserted.rows[0].id,
              correlationId,
              { datasetId, contentHash },
            ],
          );
          return {
            status: 201,
            body: { id: inserted.rows[0].id, datasetId, contentHash },
            resourceId: inserted.rows[0].id,
          };
        },
      );
    }),
  );

  app.post(
    "/api/v1/schedules/generate",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      const input = generateSchema.parse(req.body);
      await idempotentCommand(
        req,
        res,
        "/api/v1/schedules/generate",
        async ({ client, correlationId, key }) => {
          const dataset = await client.query(
            "SELECT id FROM dataset_version WHERE id = $1",
            [input.datasetVersionId],
          );
          if (!dataset.rowCount)
            throw new ApiError(
              404,
              "dataset_not_found",
              "Dataset version does not exist",
            );
          const scheduleId = uuidv7();
          await client.query(
            `INSERT INTO schedule_version (id, dataset_version_id, status, created_by) VALUES ($1, $2, 'generating', $3)`,
            [scheduleId, input.datasetVersionId, req.actor!.id],
          );
          const job = await createJob(
            client,
            "GENERATE_SCHEDULE",
            { scheduleVersionId: scheduleId },
            2,
            correlationId,
            key,
          );
          return {
            status: 202,
            body: {
              scheduleVersionId: scheduleId,
              jobId: job.id,
              status: "generating",
            },
            resourceId: scheduleId,
          };
        },
      );
    }),
  );

  app.post(
    "/api/v1/schedules/repair",
    requireRole("admin", "department_coordinator", "faculty"),
    asyncRoute(async (req, res) => {
      const input = repairSchema.parse(req.body);
      await idempotentCommand(
        req,
        res,
        "/api/v1/schedules/repair",
        async ({ client, correlationId, key }) => {
          const baseline = await client.query<{ created_by: string }>(
            "SELECT created_by FROM schedule_version WHERE id = $1 AND status = 'approved'",
            [input.baselineScheduleId],
          );
          if (!baseline.rowCount)
            throw new ApiError(
              409,
              "baseline_not_approved",
              "Repairs require an approved baseline schedule",
            );
          const scheduleId = uuidv7();
          await client.query(
            `INSERT INTO schedule_version (id, dataset_version_id, baseline_schedule_id, status, disruption, created_by)
         VALUES ($1, $2, $3, 'generating', $4, $5)`,
            [
              scheduleId,
              input.datasetVersionId,
              input.baselineScheduleId,
              input.disruption,
              req.actor!.id,
            ],
          );
          const job = await createJob(
            client,
            "REPAIR_SCHEDULE",
            { scheduleVersionId: scheduleId },
            1,
            correlationId,
            key,
          );
          return {
            status: 202,
            body: {
              scheduleVersionId: scheduleId,
              jobId: job.id,
              status: "generating",
            },
            resourceId: scheduleId,
          };
        },
      );
    }),
  );

  app.post(
    "/api/v1/bookings/decide",
    requireRole("admin", "department_coordinator"),
    asyncRoute(async (req, res) => {
      const input = bookingSchema.parse(req.body);
      await idempotentCommand(
        req,
        res,
        "/api/v1/bookings/decide",
        async ({ client, correlationId, key }) => {
          const job = await createJob(
            client,
            "DECIDE_BOOKINGS",
            input,
            1,
            correlationId,
            key,
          );
          return {
            status: 202,
            body: { jobId: job.id, status: "queued" },
            resourceId: job.id,
          };
        },
      );
    }),
  );

  app.post(
    "/api/v1/ai/booking-drafts",
    rateLimit("ai", 10, 10 / 60),
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const input = aiBookingRequestSchema.parse(req.body);
      const draft = await parseBookingRequest(input.text);
      res.status(200).json({
        draft,
        validation: "schema_validated",
        requestId: req.requestId,
      });
    }),
  );

  app.post(
    "/api/v1/ai/schedule-change-drafts",
    rateLimit("ai-change", 10, 10 / 60),
    requireRole("admin", "department_coordinator", "faculty"),
    asyncRoute(async (req, res) => {
      const input = aiBookingRequestSchema.parse(req.body);
      const draft = await parseScheduleChange(input.text);
      res.json({ draft, validation: "schema_validated_only", requestId: req.requestId });
    }),
  );

  app.post(
    "/api/v1/ai/assistant",
    rateLimit("ai-assistant", 10, 10 / 60),
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const input = aiBookingRequestSchema.parse(req.body);
      assertAiInput(input.text);
      const change = /\b(leave|unavailable|reschedul|move my class|faculty)\b/i.test(input.text);
      if (!config.GROQ_API_KEY) {
        res.json({
          reply: "I can listen, but drafting needs a configured model. Use the manual form. I cannot approve or publish anything.",
          intent: change ? "schedule_change" : "booking",
          configured: false,
        });
        return;
      }
      if (change) {
        const draft = await parseScheduleChange(input.text);
        res.json({
          reply: draft.follow_up ?? `I drafted ${draft.changes.length} schedule change${draft.changes.length === 1 ? "" : "s"}. Review them before anyone approves.`,
          intent: "schedule_change",
          draft,
          configured: true,
        });
        return;
      }
      const draft = await parseBookingRequest(input.text);
      res.json({
        reply: draft.follow_up ?? `Draft ready${draft.attendance ? ` for ${draft.attendance} people` : ""}. It is not booked until you submit it on the workspace.`,
        intent: "booking",
        draft,
        configured: true,
      });
    }),
  );

  app.post(
    "/api/v1/ai/availability",
    rateLimit("ai-availability", 20, 20 / 60),
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const input = aiBookingRequestSchema.parse(req.body);
      assertAiInput(input.text);
      let parsed = null;
      try {
        parsed = await parseBookingRequest(input.text);
      } catch (error) {
        if (error instanceof GuardrailBlockedError) throw error;
      }
      const ask = readAvailabilityQuestion(input.text, parsed);
      const found = await query<{ id: string; payload: CitDataset; objective: { export?: { sessions?: Placement[] } } }>(
        "SELECT s.id, d.payload, s.objective FROM schedule_version s JOIN dataset_version d ON d.id = s.dataset_version_id WHERE s.status = 'approved' ORDER BY s.approved_at DESC NULLS LAST, s.created_at DESC LIMIT 1",
      );
      if (!found.rowCount) {
        res.json({ reply: "Pehle ek approved timetable chahiye. Uske bina main khali slot nahi bata sakta.", free: null, offerRequest: false, deterministic: true, draft: null, date: ask.date, scheduleVersionId: null });
        return;
      }
      const schedule = found.rows[0];
      const sessions = new Map(schedule.payload.sessions.map((session) => [session.id, session]));
      const occupants: Occupant[] = [];
      for (const placement of schedule.objective.export?.sessions ?? []) {
        const session = sessions.get(placement.session_id);
        if (!session) continue;
        occupants.push({ room_id: placement.room_id, day: placement.day, start_period: placement.start_period, end_period: placement.start_period + session.duration - 1, label: session.course_id });
      }
      const held = await query<{ title: string; proposed_decision: { status?: string; room_id?: string; day?: string; start_period?: number; end_period?: number } }>(
        "SELECT title, proposed_decision FROM venue_request WHERE schedule_version_id=$1 AND status IN ('pending_review','approved','alternative_offered')",
        [schedule.id],
      );
      for (const item of held.rows) {
        const decision = item.proposed_decision;
        if (!decision?.room_id || !decision.day || !decision.start_period || !decision.end_period) continue;
        if (decision.status !== "approved" && decision.status !== "alternative_offered") continue;
        occupants.push({ room_id: decision.room_id, day: decision.day, start_period: decision.start_period, end_period: decision.end_period, label: item.title });
      }
      const manuals = await query<{ title: string; day: string; start_period: number; end_period: number; room_id: string }>(
        "SELECT title, day, start_period, end_period, room_id FROM manual_event WHERE schedule_version_id=$1",
        [schedule.id],
      );
      for (const item of manuals.rows) occupants.push({ room_id: item.room_id, day: item.day, start_period: item.start_period, end_period: item.end_period, label: item.title });
      const judged = judgeAvailability({ ask, rooms: schedule.payload.rooms, occupants, canRequest: req.actor!.role !== "admin" });
      const alternative = !judged.free && "alternatives" in judged ? judged.alternatives?.[0] ?? null : null;
      const draft = judged.free && judged.room ? draftForFreeSlot(ask, judged.room) : alternative ? draftForAvailabilityOption(alternative) : null;
      const exchangeRequested = /\b(exchange|swap|replace|badal|change booking)\b/i.test(input.text);
      res.json({
        reply: exchangeRequested && alternative
          ? `${judged.reply} This is a replacement request, not an automatic exchange; it must be reviewed by the authorized approver.`
          : judged.reply,
        free: judged.free,
        offerRequest: Boolean(draft && req.actor!.role !== "admin"),
        exchangeRequiresApproval: exchangeRequested,
        deterministic: true,
        configured: Boolean(config.GROQ_API_KEY),
        draft,
        date: ask.date,
        day: ask.day,
        scheduleVersionId: schedule.id,
        room: judged.room ? { id: judged.room.id, name: judged.room.name } : null,
        alternative: alternative ? { room: { id: alternative.room.id, name: alternative.room.name }, day: alternative.day, fromPeriod: alternative.fromPeriod, toPeriod: alternative.toPeriod } : null,
      });
    }),
  );

  app.post(
    "/api/v1/ai/explain",
    rateLimit("ai-explain", 10, 10 / 60),
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const input = aiBookingRequestSchema.parse(req.body);
      assertAiInput(input.text);
      const found = await query<{ objective: { export?: { sessions?: Placement[]; fest_week?: { bookings?: Array<{ request_id: string; status: string; reason: string }> } } } }>(
        "SELECT objective FROM schedule_version ORDER BY created_at DESC LIMIT 1",
      );
      const exported = found.rows[0]?.objective?.export;
      const needle = input.text.toLowerCase();
      const bookings = exported?.fest_week?.bookings ?? [];
      const matched = bookings.filter((booking) =>
        needle.includes(booking.request_id.toLowerCase())
        || (needle.includes("reject") && booking.status === "rejected")
        || (needle.includes("alternative") && booking.status === "alternative_offered"),
      ).slice(0, 6);
      const session = (exported?.sessions ?? []).find((item) => needle.includes(item.session_id.toLowerCase()));
      const lines = [
        ...matched.map((booking) => `${booking.request_id} is ${booking.status.replaceAll("_", " ")}: ${booking.reason}`),
        session ? `${session.session_id} is placed on ${session.day} at period ${session.start_period} in ${session.room_id}. That placement was chosen by the deterministic scheduler, not by the model.` : "",
      ].filter(Boolean);
      const reply = lines.length
        ? lines.join(" ")
        : "Name a request such as BR-09, or ask which bookings were rejected. The reason is the one stored by the checker. Drafting can fail without blocking the manual form.";
      res.json({ reply, deterministic: true, configured: Boolean(config.GROQ_API_KEY), manualForm: true, matches: matched });
    }),
  );

  app.post(
    "/api/v1/booking-requests",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const input = bookingSubmissionSchema.parse(req.body);
      if (input.draft.attendance === null || input.draft.duration_periods === null || input.draft.windows.length === 0)
        throw new ApiError(400, "incomplete_booking", input.draft.follow_up ?? "Attendance, duration and at least one time window are required");
      const found = await query<{ payload: CitDataset; objective: { export?: { sessions: Placement[] } } }>("SELECT d.payload,s.objective FROM schedule_version s JOIN dataset_version d ON d.id=s.dataset_version_id WHERE s.id=$1 AND s.status='approved'", [input.scheduleVersionId]);
      if (!found.rowCount) throw new ApiError(409, "approved_schedule_required", "Submit requests against an approved schedule");
      const id = `USR-${uuidv7()}`;
      const request = { id, submitted_at: new Date().toISOString(), requester: req.actor!.id, role: req.actor!.role, requested_category: input.requestedCategory, honor_requested_category: true, title: input.title, attendance: input.draft.attendance, duration_periods: input.draft.duration_periods, windows: input.draft.windows, room_types: input.draft.room_types, needs: input.draft.needs, requested_room: input.draft.requested_room, mandatory_for_groups: input.draft.mandatory_for_groups };
      const data = structuredClone(found.rows[0].payload);
      data.booking_requests = [...(data.booking_requests ?? []), request];
      const heldRows = await query<{ proposed_decision: { status?: string; room_id?: string; day?: string; start_period?: number; end_period?: number } }>(
        "SELECT proposed_decision FROM venue_request WHERE schedule_version_id=$1 AND status IN ('pending_review','approved','alternative_offered')",
        [input.scheduleVersionId],
      );
      const days = new Set(["MON", "TUE", "WED", "THU", "FRI"]);
      const held: HeldSlot[] = heldRows.rows.flatMap((row) => {
        const decision = row.proposed_decision;
        if (!decision || (decision.status !== "approved" && decision.status !== "alternative_offered")) return [];
        if (!decision.room_id || !decision.day || !days.has(decision.day) || !decision.start_period || !decision.end_period || decision.end_period < decision.start_period) return [];
        return [{ room_id: decision.room_id, day: decision.day as Day, start_period: decision.start_period, end_period: decision.end_period }];
      });
      const proposed = decideBookings(data, found.rows[0].objective.export?.sessions ?? [], held).find((decision) => decision.request_id === id)!;
      // Assistant-generated drafts always require an independent human review.
      const direct = req.actor!.role === "admin" && !input.aiAssisted;
      const recordJob = async (outcome: Record<string, unknown>) => {
        const jobId = uuidv7();
        await query(
          "INSERT INTO job (id, type, priority, status, payload, result, attempt_count, correlation_id, started_at, completed_at) VALUES ($1, 'DECIDE_BOOKINGS', 1, 'succeeded', $2, $3, 1, $4, now(), now())",
          [jobId, { scheduleVersionId: input.scheduleVersionId, title: input.title, requestId: id }, outcome, uuidv7()],
        );
        return jobId;
      };
      if (direct && proposed.status !== "approved") {
        const jobId = await recordJob({ title: input.title, status: proposed.status, reason: proposed.reason, requestId: id });
        res.status(200).json({ id: null, jobId, status: proposed.status, booked: false, proposedDecision: proposed, appliedCategory: input.requestedCategory, clash: proposed.reason, deterministic: true });
        return;
      }
      const databaseId = uuidv7();
      const status = direct ? "approved" : "pending_review";
      await query(
        "INSERT INTO venue_request(id,schedule_version_id,title,requested_category,draft,proposed_decision,status,requested_by,reviewed_by,reviewed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,CASE WHEN $9::uuid IS NULL THEN NULL ELSE now() END)",
        [databaseId, input.scheduleVersionId, input.title, input.requestedCategory, input.draft, proposed, status, req.actor!.id, direct ? req.actor!.id : null],
      );
      const jobId = await recordJob({ title: input.title, status, reason: proposed.reason, requestId: id, room: proposed.room_id ?? null, day: proposed.day ?? null });
      res.status(201).json({ id: databaseId, jobId, status, booked: direct, proposedDecision: proposed, appliedCategory: input.requestedCategory, deterministic: true });
    }),
  );

  app.get(
    "/api/v1/booking-requests",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const admin = req.actor!.role === "admin" || req.actor!.role === "department_coordinator";
      const found = await query<{ requested_by: string; status: string }>("SELECT id,schedule_version_id,title,requested_category,proposed_decision,status,requested_by,reviewed_by,reviewed_at,created_at FROM venue_request WHERE $1::boolean OR requested_by=$2 ORDER BY created_at DESC", [admin, req.actor!.id]);
      res.json({
        items: found.rows.map((row) => ({
          ...row,
          canReview: admin && row.requested_by !== req.actor!.id && row.status === "pending_review",
        })),
      });
    }),
  );

  app.post(
    "/api/v1/booking-requests/:id/review",
    requireRole("admin", "department_coordinator"),
    asyncRoute(async (req, res) => {
      const id = actorIdSchema.parse(req.params.id);
      const action = reviewActionSchema.parse(req.body ?? {}).action;
      const found = await query<{ requested_by: string; proposed_decision: { status: "approved" | "rejected" | "alternative_offered"; reason: string } }>("SELECT requested_by,proposed_decision FROM venue_request WHERE id=$1 AND status='pending_review'", [id]);
      if (!found.rowCount) throw new ApiError(404, "request_not_found", "Pending venue request does not exist");
      if (found.rows[0].requested_by === req.actor!.id) throw new ApiError(403, "self_approval_forbidden", "You cannot review your own venue request");
      const proposed = found.rows[0].proposed_decision;
      if (action === "accept" && proposed.status === "rejected") throw new ApiError(409, "no_valid_slot", proposed.reason);
      const decision = action === "reject"
        ? { ...proposed, status: "rejected" as const, reason: proposed.status === "rejected" ? proposed.reason : `Rejected by a reviewer. The checker had proposed: ${proposed.reason}` }
        : proposed;
      await query("UPDATE venue_request SET status=$2,proposed_decision=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1", [id, decision.status, decision, req.actor!.id]);
      res.json({ id, status: decision.status, decision });
    }),
  );

  app.post(
    "/api/v1/booking-requests/:id/cancel",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const id = actorIdSchema.parse(req.params.id);
      const found = await query<{ requested_by: string; proposed_decision: Record<string, unknown> }>("SELECT requested_by,proposed_decision FROM venue_request WHERE id=$1", [id]);
      if (!found.rowCount) throw new ApiError(404, "request_not_found", "Venue request does not exist");
      if (req.actor!.role !== "admin" && found.rows[0].requested_by !== req.actor!.id) throw new ApiError(403, "forbidden", "Only the requester or an Admin can cancel this request");
      const decision = { ...found.rows[0].proposed_decision, status: "rejected", reason: "Cancelled by the requester." };
      await query("UPDATE venue_request SET status='rejected',proposed_decision=$2 WHERE id=$1", [id, decision]);
      res.json({ id, status: "rejected", decision });
    }),
  );

  app.post(
    "/api/v1/schedules/:id/approve",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      const scheduleId = actorIdSchema.parse(req.params.id);
      await idempotentCommand(
        req,
        res,
        "/api/v1/schedules/:id/approve",
        async ({ client, correlationId }) => {
          const schedule = await client.query<{
            created_by: string;
            status: string;
            validation_report: unknown;
          }>(
            "SELECT created_by, status, validation_report FROM schedule_version WHERE id = $1 FOR UPDATE",
            [scheduleId],
          );
          if (!schedule.rowCount)
            throw new ApiError(
              404,
              "schedule_not_found",
              "Schedule version does not exist",
            );
          if (schedule.rows[0].created_by === req.actor!.id)
            throw new ApiError(
              403,
              "self_approval_forbidden",
              "You cannot approve your own proposal",
            );
          if (schedule.rows[0].status !== "pending_admin_approval")
            throw new ApiError(
              409,
              "schedule_not_ready",
              "Only validated proposals can be approved",
            );
          await client.query(
            "UPDATE schedule_version SET status = 'approved', approved_by = $2, approved_at = now(), updated_at = now() WHERE id = $1",
            [scheduleId, req.actor!.id],
          );
          await client.query(
            `INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, request_id, after_state)
         VALUES ($1, $2, 'schedule.approved', 'schedule_version', $3, $4, $5)`,
            [
              uuidv7(),
              req.actor!.id,
              scheduleId,
              correlationId,
              { status: "approved" },
            ],
          );
          return {
            status: 200,
            body: { scheduleVersionId: scheduleId, status: "approved" },
            resourceId: scheduleId,
          };
        },
      );
    }),
  );

  app.get(
    "/api/v1/dashboard",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (_req, res) => {
      const [dataset, schedule, pending, jobs] = await Promise.all([
        query<{ payload: CitDataset; id: string }>("SELECT id, payload FROM dataset_version ORDER BY created_at DESC LIMIT 1"),
        query<{ id: string; status: string; validation_report: Record<string, unknown> | null; objective: { export?: { sessions?: Placement[]; exams?: unknown[]; fest_week?: { bookings?: Array<{ status: string }> } } } }>("SELECT id,status,validation_report,objective FROM schedule_version ORDER BY created_at DESC LIMIT 1"),
        query<{ count: string }>("SELECT count(*)::text AS count FROM schedule_version WHERE status='pending_admin_approval'"),
        query<{ count: string }>("SELECT count(*)::text AS count FROM job WHERE status IN ('queued','running')"),
      ]);
      const data = dataset.rows[0]?.payload;
      const current = schedule.rows[0];
      const exported = current?.objective?.export;
      const approvedBookings = exported?.fest_week?.bookings?.filter((b) => b.status === "approved").length ?? 0;
      const sessionById = new Map(data?.sessions.map((session) => [session.id, session]) ?? []);
      const scheduledRoomHours = exported?.sessions?.reduce((sum, placement) => sum + (sessionById.get(placement.session_id)?.duration ?? 0), 0) ?? 0;
      const roomUtilization = data?.rooms.length ? Math.round((scheduledRoomHours / (data.rooms.length * 45)) * 100) : 0;
      res.json({
        datasetVersionId: dataset.rows[0]?.id ?? null,
        datasetId: data?.dataset_id ?? null,
        counts: { rooms: data?.rooms.length ?? 0, faculty: data?.faculty.length ?? 0, sessions: data?.sessions.length ?? 0, exams: data?.exams?.length ?? 0, bookingRequests: data?.booking_requests?.length ?? 0 }, roomUtilization,
        latestSchedule: current ? { id: current.id, status: current.status, hardViolations: Number(current.validation_report?.hard_violation_count ?? 0), softPenalty: Number(current.validation_report?.soft_total ?? 0), approvedBookings } : null,
        pendingApprovals: Number(pending.rows[0]?.count ?? 0),
        activeJobs: Number(jobs.rows[0]?.count ?? 0),
      });
    }),
  );

  app.get(
    "/api/v1/datasets",
    requireRole("admin", "department_coordinator", "faculty"),
    asyncRoute(async (_req, res) => {
      const found = await query(
        `SELECT id, dataset_id, source_name, content_hash, created_at,
                COALESCE(jsonb_array_length(payload->'rooms'), 0) AS rooms,
                COALESCE(jsonb_array_length(payload->'faculty'), 0) AS faculty,
                COALESCE(jsonb_array_length(payload->'student_groups'), 0) AS groups,
                COALESCE(jsonb_array_length(payload->'sessions'), 0) AS sessions,
                COALESCE(jsonb_array_length(payload->'exams'), 0) AS exams,
                COALESCE(jsonb_array_length(payload->'booking_requests'), 0) AS booking_requests
         FROM dataset_version
         ORDER BY created_at DESC`,
      );
      res.json({ items: found.rows });
    }),
  );

  app.get(
    "/api/v1/schedules",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (_req, res) => {
      const found = await query(
        `SELECT s.id, s.dataset_version_id, s.baseline_schedule_id, s.status, s.validation_report,
                s.created_by, s.approved_by, s.approved_at, s.created_at, s.updated_at,
                d.dataset_id, d.source_name, u.display_name AS created_by_name
         FROM schedule_version s
         JOIN dataset_version d ON d.id = s.dataset_version_id
         LEFT JOIN app_user u ON u.id = s.created_by
         ORDER BY s.created_at DESC
         LIMIT 50`,
      );
      res.json({ items: found.rows });
    }),
  );

  app.get(
    "/api/v1/approvals",
    requireRole("admin"),
    asyncRoute(async (_req, res) => {
      const found = await query("SELECT s.id,s.baseline_schedule_id,s.validation_report,s.created_at,u.display_name AS created_by_name FROM schedule_version s LEFT JOIN app_user u ON u.id=s.created_by WHERE s.status='pending_admin_approval' ORDER BY s.created_at");
      res.json({ items: found.rows });
    }),
  );

  app.get(
    "/api/v1/schedules/:id/catalog",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const id = actorIdSchema.parse(req.params.id);
      const found = await query<{ payload: Record<string, unknown> }>(
        "SELECT d.payload FROM schedule_version s JOIN dataset_version d ON d.id = s.dataset_version_id WHERE s.id = $1",
        [id],
      );
      if (!found.rowCount)
        throw new ApiError(404, "schedule_not_found", "Schedule version does not exist");
      const payload = found.rows[0].payload as {
        rooms?: Array<Record<string, unknown>>;
        faculty?: Array<Record<string, unknown>>;
        student_groups?: Array<Record<string, unknown>>;
      };
      const asText = (value: unknown, fallback = "") =>
        value === undefined || value === null || value === "" ? fallback : String(value);
      const rooms = (payload.rooms ?? []).map((room) => ({
        id: asText(room.id),
        name: asText(room.name, asText(room.id)),
        building: room.building ? asText(room.building) : null,
        type: asText(room.type).replaceAll("_", " "),
        capacity: Number(room.capacity ?? 0),
        features: Array.isArray(room.features) ? room.features.map(String) : [],
        accessible: Boolean(room.accessible),
        allowedUses: Array.isArray(room.allowed_uses) ? room.allowed_uses.map(String) : [],
      }));
      const faculty = (payload.faculty ?? []).map((person) => ({
        id: asText(person.id),
        name: asText(person.name, asText(person.id)),
        department: person.department ? asText(person.department) : null,
      }));
      const groups = (payload.student_groups ?? []).map((group) => ({
        id: asText(group.id),
        name: asText(group.name, asText(group.id)),
        year: group.year === undefined || group.year === null ? null : Number(group.year),
        department: group.department ? asText(group.department) : null,
        size: Number(group.size ?? 0),
      }));
      res.json({ scheduleVersionId: id, rooms, faculty, groups });
    }),
  );

  app.get(
    "/api/v1/schedules/:id",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const id = actorIdSchema.parse(req.params.id);
      const found = await query("SELECT id,dataset_version_id,baseline_schedule_id,status,validation_report,objective,created_by,approved_by,approved_at,created_at,updated_at FROM schedule_version WHERE id=$1", [id]);
      if (!found.rowCount) throw new ApiError(404, "schedule_not_found", "Schedule version does not exist");
      res.json(found.rows[0]);
    }),
  );

  app.get(
    "/api/v1/schedules/:id/export",
    requireRole("admin", "department_coordinator"),
    asyncRoute(async (req, res) => {
      const id = actorIdSchema.parse(req.params.id);
      const found = await query<{ objective: { export?: unknown } }>("SELECT objective FROM schedule_version WHERE id=$1", [id]);
      const exported = found.rows[0]?.objective?.export;
      if (!exported) throw new ApiError(409, "export_not_ready", "This schedule has not finished generating");
      res.setHeader("content-disposition", `attachment; filename="schedule-${id}.json"`);
      res.json(exported);
    }),
  );

  app.get(
    "/api/v1/schedules/:id/timetable",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const id = actorIdSchema.parse(req.params.id);
      const found = await query<{ payload: CitDataset; objective: { export?: { sessions: Placement[] } } }>("SELECT d.payload,s.objective FROM schedule_version s JOIN dataset_version d ON d.id=s.dataset_version_id WHERE s.id=$1", [id]);
      if (!found.rowCount) throw new ApiError(404, "schedule_not_found", "Schedule version does not exist");
      const placements = found.rows[0].objective.export?.sessions ?? [];
      const sessions = new Map(found.rows[0].payload.sessions.map((s) => [s.id, s]));
      const group = typeof req.query.group === "string" ? req.query.group : null;
      const faculty = typeof req.query.faculty === "string" ? req.query.faculty : null;
      const room = typeof req.query.room === "string" ? req.query.room : null;
      const items = placements.flatMap((placement) => {
        const session = sessions.get(placement.session_id);
        if (!session || (group && !session.groups.includes(group)) || (faculty && session.faculty_id !== faculty) || (room && placement.room_id !== room)) return [];
        return [{ ...placement, courseId: session.course_id, kind: session.kind, groups: session.groups, facultyId: session.faculty_id, duration: session.duration, size: session.size }];
      });
      res.json({ scheduleVersionId: id, filters: { group, faculty, room }, items });
    }),
  );

  app.get(
    "/api/v1/schedules/:id/explanations/:sessionId",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const id = actorIdSchema.parse(req.params.id);
      const found = await query<{ payload: CitDataset; objective: { export?: { sessions: Placement[] } } }>("SELECT d.payload,s.objective FROM schedule_version s JOIN dataset_version d ON d.id=s.dataset_version_id WHERE s.id=$1", [id]);
      const session = found.rows[0]?.payload.sessions.find((s) => s.id === req.params.sessionId);
      const placement = found.rows[0]?.objective.export?.sessions.find((p) => p.session_id === req.params.sessionId);
      if (!session || !placement) throw new ApiError(404, "session_not_found", "Scheduled session does not exist");
      const room = found.rows[0].payload.rooms.find((r) => r.id === placement.room_id)!;
      res.json({ sessionId: session.id, placement, reasons: [`${room.name} has capacity ${room.capacity} for ${session.size} students.`, `${room.type.replaceAll("_", " ")} matches the session requirement.`, `The slot is free for ${session.faculty_id}, ${session.groups.join(", ")} and the room.`, session.needs_accessible ? "The room is accessible as required." : "No accessibility restriction was required."], deterministic: true });
    }),
  );

  app.post(
    "/api/v1/manual-events",
    requireRole("admin", "department_coordinator"),
    asyncRoute(async (req, res) => {
      const input = manualEventSchema.parse(req.body);
      const found = await query<{ status: string; payload: CitDataset; objective: { export?: { sessions: Placement[] } } }>("SELECT s.status,d.payload,s.objective FROM schedule_version s JOIN dataset_version d ON d.id=s.dataset_version_id WHERE s.id=$1", [input.scheduleVersionId]);
      if (!found.rowCount || found.rows[0].status !== "approved") throw new ApiError(409, "approved_schedule_required", "Manual events require an approved schedule");
      const data = found.rows[0].payload, room = data.rooms.find((r) => r.id === input.roomId);
      if (!room || !room.allowed_uses.includes("event") || room.capacity < input.attendance) throw new ApiError(409, "room_not_suitable", "Room type, use or capacity does not fit this event");
      const features = new Set([...room.features, ...(room.accessible ? ["accessible"] : [])]);
      if (input.needs.some((need) => !features.has(need))) throw new ApiError(409, "room_features_missing", "The room lacks one or more required features");
      const occupied = new Set(Array.from({ length: input.endPeriod - input.startPeriod + 1 }, (_, index) => input.startPeriod + index));
      if ((data.room_unavailability ?? []).some((u) => u.room_id === room.id && u.day === input.day && u.periods.some((p) => occupied.has(p)))) throw new ApiError(409, "room_unavailable", "The room is unavailable during this event");
      const sessions = new Map(data.sessions.map((s) => [s.id, s]));
      for (const placement of found.rows[0].objective.export?.sessions ?? []) {
        const session = sessions.get(placement.session_id)!;
        const overlap = placement.day === input.day && Array.from({ length: session.duration }, (_, index) => placement.start_period + index).some((p) => occupied.has(p));
        if (overlap && (placement.room_id === input.roomId || session.groups.some((g) => input.mandatoryGroups.includes(g)))) throw new ApiError(409, "event_conflict", `Event conflicts with ${session.id}`);
      }
      const clashes = await query("SELECT id FROM manual_event WHERE schedule_version_id=$1 AND day=$2 AND room_id=$3 AND start_period <= $5 AND end_period >= $4", [input.scheduleVersionId, input.day, input.roomId, input.startPeriod, input.endPeriod]);
      if (clashes.rowCount) throw new ApiError(409, "event_conflict", "The room already has a manually scheduled event");
      const bookingClashes = await query("SELECT request_id FROM booking_decision WHERE schedule_version_id=$1 AND day=$2 AND room_id=$3 AND status<>'rejected' AND start_period <= $5 AND end_period >= $4", [input.scheduleVersionId, input.day, input.roomId, input.startPeriod, input.endPeriod]);
      if (bookingClashes.rowCount) throw new ApiError(409, "event_conflict", `The room is held by booking ${bookingClashes.rows[0].request_id}`);
      const id = uuidv7();
      await query("INSERT INTO manual_event(id,schedule_version_id,title,day,start_period,end_period,room_id,mandatory_groups,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)", [id, input.scheduleVersionId, input.title, input.day, input.startPeriod, input.endPeriod, input.roomId, JSON.stringify(input.mandatoryGroups), input.reason, req.actor!.id]);
      res.status(201).json({ id, status: "scheduled", ...input, validation: "hard_constraints_passed" });
    }),
  );

  app.post(
    "/api/v1/demo/reset",
    requireRole("admin"),
    asyncRoute(async (req, res) => {
      await transaction(async (client) => {
        for (const table of ["venue_request", "manual_event", "booking_decision", "schedule_session", "audit_log", "idempotency_record", "outbox_event", "job", "schedule_version", "dataset_version"]) await client.query(`DELETE FROM ${table}`);
      });
      res.json({ status: "reset", message: "Demo datasets, schedules, jobs and decisions were cleared", requestId: req.requestId });
    }),
  );

  app.get(
    "/api/v1/jobs",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (_req, res) => {
      const found = await query(
        `SELECT id, type, priority, status, error, attempt_count, created_at, started_at, completed_at
         FROM job
         ORDER BY created_at DESC
         LIMIT 40`,
      );
      res.json({ items: found.rows });
    }),
  );

  app.get(
    "/api/v1/jobs/:id",
    requireRole("admin", "department_coordinator", "faculty", "club"),
    asyncRoute(async (req, res) => {
      const id = actorIdSchema.parse(req.params.id);
      const cacheKey = `job:${id}`;
      const cached = await getCachedJson<Record<string, unknown>>(cacheKey);
      if (cached) {
        res.json({ ...cached, cache: "hit" });
        return;
      }
      const found = await query(
        "SELECT id, type, priority, status, result, error, attempt_count, created_at, started_at, completed_at FROM job WHERE id = $1",
        [id],
      );
      if (!found.rowCount)
        throw new ApiError(404, "job_not_found", "Job does not exist");
      await setCachedJson(cacheKey, found.rows[0], 10);
      res.json(found.rows[0]);
    }),
  );

  app.use(
    (error: unknown, req: Request, res: Response, _next: NextFunction) => {
      const requestId = (req as AuthedRequest).requestId;
      if (error instanceof z.ZodError)
        return res.status(400).json({
          code: "invalid_request",
          message: error.issues[0]?.message,
          requestId,
        });
      if (error instanceof IdempotencyKeyReuseError)
        return res.status(409).json({
          code: "idempotency_key_reused",
          message: error.message,
          requestId,
        });
      if (error instanceof AiUnavailableError)
        return res.status(200).json({
          available: false,
          configured: Boolean(config.GROQ_API_KEY),
          manualForm: true,
          code: "ai_unavailable",
          message: error.message,
          reply: error.message,
          draft: null,
          requestId,
        });
      if (error instanceof GuardrailBlockedError)
        return res.status(400).json({ code: "guardrail_blocked", message: error.message, requestId });
      if (error instanceof ApiError)
        return res
          .status(error.status)
          .json({ code: error.code, message: error.message, requestId });
      logger.error("http.unhandled", { requestId, error });
      return res.status(500).json({
        code: "internal_error",
        message: "Unexpected server error",
        requestId,
      });
    },
  );
  return app;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
