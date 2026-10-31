import { writeFile, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { v7 as uuidv7 } from "uuid";
import { getChannel, QUEUE_NAME, closeQueue } from "../../infrastructure/messaging/rabbitmq.js";
import { config } from "../../infrastructure/config/env.js";
import { pool, transaction } from "../../infrastructure/database/postgres.js";
import type { JobEnvelope } from "../../domain/shared/types.js";
import { invalidateCache } from "../../infrastructure/cache/redis-cache.js";

async function runValidator(scheduleVersionId: string): Promise<unknown> {
  const data = await pool.query<{ payload: unknown }>(
    `SELECT d.payload FROM schedule_version s JOIN dataset_version d ON d.id = s.dataset_version_id WHERE s.id = $1`, [scheduleVersionId]
  );
  const sessions = await pool.query("SELECT session_id, day, start_period, room_id FROM schedule_session WHERE schedule_version_id = $1", [scheduleVersionId]);
  if (!data.rowCount) throw new Error("Schedule or dataset version not found");
  const tempDir = resolve(process.cwd(), ".tmp", `validation-${uuidv7()}`);
  await mkdir(tempDir, { recursive: true });
  const dataPath = join(tempDir, "data.json");
  const schedulePath = join(tempDir, "schedule.json");
  const reportPath = join(tempDir, "report.json");
  try {
    await writeFile(dataPath, JSON.stringify(data.rows[0].payload));
    await writeFile(schedulePath, JSON.stringify({ dataset_id: (data.rows[0].payload as { dataset_id?: string }).dataset_id, team: "TechZephyr", sessions: sessions.rows }));
    await new Promise<void>((resolveProcess, reject) => {
      const child = spawn(config.PYTHON_BIN, [config.VALIDATOR_PATH, "--data", dataPath, "--schedule", schedulePath, "--json", reportPath, "--quiet"]);
      let stderr = "";
      child.stderr.on("data", (part) => { stderr += part.toString(); });
      child.on("error", reject);
      child.on("exit", (code) => code === 0 ? resolveProcess() : reject(new Error(stderr || `validator exited ${code}`)));
    });
    const reportText = await (await import("node:fs/promises")).readFile(reportPath, "utf8");
    return JSON.parse(reportText);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function processJob(job: JobEnvelope): Promise<unknown> {
  const scheduleVersionId = job.payload.scheduleVersionId;
  if (typeof scheduleVersionId !== "string") throw new Error("Job payload requires scheduleVersionId");
  switch (job.type) {
    case "VALIDATE_SCHEDULE":
    case "EXPORT_SCHEDULE":
      return runValidator(scheduleVersionId);
    case "GENERATE_SCHEDULE":
    case "REPAIR_SCHEDULE":
      // The queue boundary is deliberately implemented before the solver adapter.
      // A worker must only mark the version ready after a solver persists placements and validation succeeds.
      throw new Error("Solver adapter is not configured; no schedule was published");
    case "DECIDE_BOOKINGS":
      throw new Error("Booking optimizer adapter is not configured; no decision was published");
  }
}

async function main() {
  const channel = await getChannel();
  await channel.prefetch(1);
  await channel.consume(QUEUE_NAME, async (message) => {
    if (!message) return;
    let job: JobEnvelope | undefined;
    try {
      job = JSON.parse(message.content.toString()) as JobEnvelope;
      await pool.query("UPDATE job SET status = 'running', started_at = now(), attempt_count = attempt_count + 1 WHERE id = $1", [job.id]);
      const result = await processJob(job);
      await transaction(async (client) => {
        await client.query("UPDATE job SET status = 'succeeded', result = $2, completed_at = now() WHERE id = $1", [job!.id, result]);
        if (job!.type === "VALIDATE_SCHEDULE") {
          const hardViolations = (result as { hard_violation_count?: number }).hard_violation_count ?? 1;
          await client.query(
            `UPDATE schedule_version
             SET validation_report = $2, status = CASE WHEN $3 = 0 THEN 'pending_admin_approval' ELSE 'failed' END, updated_at = now()
             WHERE id = $1`, [job!.payload.scheduleVersionId, result, hardViolations]
          );
        }
      });
      channel.ack(message);
      await invalidateCache(`job:${job.id}`, `schedule:${String(job.payload.scheduleVersionId ?? "")}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown worker error";
      if (job) await pool.query("UPDATE job SET status = 'failed', error = $2, completed_at = now() WHERE id = $1", [job.id, detail]);
      if (job) await invalidateCache(`job:${job.id}`);
      console.error({ jobId: job?.id, error: detail });
      channel.ack(message);
    }
  }, { noAck: false });
  console.log("Worker is consuming jobs");
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void closeQueue().finally(() => process.exit(0)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
