import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

export type IdempotencyReplay = { kind: "replay"; statusCode: number; body: unknown };
export type IdempotencyInProgress = { kind: "in_progress" };
export type IdempotencyNew = { kind: "new"; requestHash: string };
export type IdempotencyDecision = IdempotencyReplay | IdempotencyInProgress | IdempotencyNew;

export function hashRequest(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

export async function beginIdempotentCommand(
  client: PoolClient,
  actorId: string,
  method: string,
  route: string,
  key: string,
  body: unknown
): Promise<IdempotencyDecision> {
  const requestHash = hashRequest(body);
  const existing = await client.query<{ request_hash: string; status_code: number | null; response_body: unknown }>(
    `SELECT request_hash, status_code, response_body FROM idempotency_record
     WHERE actor_id = $1 AND method = $2 AND route = $3 AND idempotency_key = $4 FOR UPDATE`,
    [actorId, method, route, key]
  );
  if (existing.rowCount) {
    const row = existing.rows[0];
    if (row.request_hash !== requestHash) throw new IdempotencyKeyReuseError();
    if (row.status_code !== null) return { kind: "replay", statusCode: row.status_code, body: row.response_body };
    return { kind: "in_progress" };
  }
  await client.query(
    `INSERT INTO idempotency_record
     (actor_id, method, route, idempotency_key, request_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + interval '7 days')`,
    [actorId, method, route, key, requestHash]
  );
  return { kind: "new", requestHash };
}

export async function completeIdempotentCommand(
  client: PoolClient,
  actorId: string,
  method: string,
  route: string,
  key: string,
  statusCode: number,
  body: unknown,
  resourceId?: string
): Promise<void> {
  await client.query(
    `UPDATE idempotency_record
     SET status_code = $6, response_body = $7, resource_id = $8, completed_at = now()
     WHERE actor_id = $1 AND method = $2 AND route = $3 AND idempotency_key = $4`,
    [actorId, method, route, key, statusCode, body, resourceId ?? null]
  );
}

export class IdempotencyKeyReuseError extends Error {
  constructor() { super("Idempotency-Key was previously used with a different request body"); }
}
