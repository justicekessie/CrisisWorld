import { Pool } from "pg";
const connectionString = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/crisisworld";
export const pool = new Pool({ connectionString });
