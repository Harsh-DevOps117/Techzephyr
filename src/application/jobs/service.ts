import { v7 as uuidv7 } from "uuid";
import type { PoolClient } from "pg";
import { publish } from "../../infrastructure/messaging/rabbitmq.js";
import type { JobEnvelope, JobType } from "../../domain/shared/types.js";

export async function createJob(
  client: PoolClient,
  type: JobType,
  payload: Record<string, unknown>,
  priority: number,
  correlationId: string,
  idempotencyKey?: string
): Promise<JobEnvelope> {
  const id = uuidv7();
  await client.query(
    `INSERT INTO job (id, type, priority, payload, correlation_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, type, priority, payload, correlationId, idempotencyKey ?? null]
  );
  await client.query(
    `INSERT INTO outbox_event (id, type, payload, correlation_id)
     VALUES ($1, 'JOB_CREATED', $2, $3)`,
    [uuidv7(), { id, type, payload, correlationId }, correlationId]
  );
  return { id, type, payload, correlationId };
}

/** Publishes unacknowledged outbox jobs. Safe to run repeatedly. */
export async function publishOutbox(client: PoolClient): Promise<void> {
  const events = await client.query<{ id: string; payload: JobEnvelope }>(
    `SELECT id, payload FROM outbox_event WHERE published_at IS NULL AND type = 'JOB_CREATED'
     ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 100`
  );
  for (const event of events.rows) {
    const priority = await client.query<{ priority: number }>("SELECT priority FROM job WHERE id = $1", [event.payload.id]);
    await publish(event.payload, priority.rows[0]?.priority ?? 1);
    await client.query("UPDATE outbox_event SET published_at = now() WHERE id = $1", [event.id]);
  }
}
