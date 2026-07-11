import { Pool } from "@neondatabase/serverless";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Thin wrapper so every call site uses parameterized queries by construction
// (never string-concatenated SQL) — this is the project's one and only
// place that talks to the database driver directly.
export async function query<T = unknown>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = unknown>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
