import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "./postgres.js";

const migrationsPath = resolve(process.cwd(), "migrations");

async function main() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migration (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const applied = new Set(
    (
      await pool.query<{ name: string }>("SELECT name FROM schema_migration")
    ).rows.map((row) => row.name),
  );
  const files = (await readdir(migrationsPath))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(resolve(migrationsPath, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migration (name) VALUES ($1)", [
        file,
      ]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
