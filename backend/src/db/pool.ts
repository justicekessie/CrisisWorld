import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/crisisworld";

export const pool = new Pool({
  connectionString,
  max: Number(process.env.PGPOOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
