import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import {
  AiUnavailableError,
  parseBookingRequest,
} from "../../application/ai/booking-request-parser.js";
import { authenticate, login } from "../../application/auth/auth-service.js";
import {
  IdempotencyKeyReuseError,
  beginIdempotentCommand,
  completeIdempotentCommand,
} from "../../application/idempotency/service.js";
import { createJob, publishOutbox } from "../../application/jobs/service.js";
import type { Role } from "../../domain/shared/types.js";
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

function asyncRoute(
  fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    void fn(req as AuthedRequest, res, next).catch(next);
}

function requireRole(...allowed: Role[]) {
  return asyncRoute(async (req, _res, next) => {
    const bearer = req.header("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    const claims = bearer ? await authenticate(bearer) : null;
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

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  const allowedOrigins = new Set([
    ...config.ALLOWED_ORIGIN.split(",").map((origin) => origin.trim()),
    "http://localhost:3001",
    "http://localhost:8080",
    "http://localhost:5173",
  ]);
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
        res.json(await login(input.email, input.password));
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
    requireRole("admin"),
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
        return res
          .status(503)
          .json({ code: "ai_unavailable", message: error.message, requestId });
      if (error instanceof ApiError)
        return res
          .status(error.status)
          .json({ code: error.code, message: error.message, requestId });
      console.error(error);
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
