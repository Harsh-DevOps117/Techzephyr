import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { config } from "../config/env.js";

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  idleTimeoutMillis: config.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: config.DB_POOL_CONNECTION_TIMEOUT_MS,
  maxLifetimeSeconds: 1800,
  application_name: "techzephyr-api"
});

pool.on("error", (error) => console.error("Unexpected PostgreSQL pool error", error));

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  return pool.query<T>(text, values);
}

export async function transaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
