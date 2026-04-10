import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../db/pool.js";
async function ensureMigrationsTable() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      file_name text PRIMARY KEY,
      executed_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}
async function run() {
    const migrationsDir = path.resolve(process.cwd(), "migrations");
    const files = (await readdir(migrationsDir))
        .filter((name) => name.endsWith(".sql"))
        .sort((a, b) => a.localeCompare(b));
    await ensureMigrationsTable();
    for (const fileName of files) {
        const alreadyRan = await pool.query("SELECT 1 FROM schema_migrations WHERE file_name = $1", [fileName]);
        if (alreadyRan.rowCount && alreadyRan.rowCount > 0) {
            continue;
        }
        const filePath = path.join(migrationsDir, fileName);
        const sql = await readFile(filePath, "utf8");
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query(sql);
            await client.query("INSERT INTO schema_migrations (file_name) VALUES ($1)", [fileName]);
            await client.query("COMMIT");
            console.log(`Applied migration: ${fileName}`);
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
    }
    console.log("Migration run complete.");
}
run()
    .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await pool.end();
});
