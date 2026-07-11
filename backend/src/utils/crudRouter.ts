import { Router } from "express";
import type { z } from "zod";
import { query, queryOne } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../middleware/error.js";

interface ColumnMap {
  // requestKey (camelCase, what the frontend sends) -> db column (snake_case)
  [requestKey: string]: string;
}

function buildSelect(table: string, columns: ColumnMap): string {
  // Build a SELECT that aliases every column to camelCase so the JSON
  // response matches what the frontend expects.
  const aliases: string[] = [
    `id`,
    `user_id AS "userId"`,
    `created_at AS "createdAt"`,
  ];

  for (const [camel, snake] of Object.entries(columns)) {
    if (snake === "id" || snake === "user_id" || snake === "created_at") continue;
    aliases.push(`${snake} AS "${camel}"`);
  }

  aliases.push(`updated_at AS "updatedAt"`);

  return `SELECT ${aliases.join(", ")} FROM ${table}`;
}

// Builds a full CRUD router (list/get/create/update/delete) for a single
// table. Every query is scoped to `user_id = req.userId`, so one user can
// never read or mutate another user's rows even if they guess an id —
// ownership is enforced at the query level, not just in application logic.
export function createCrudRouter<TCreate extends Record<string, unknown>>(config: {
  table: string;
  columns: ColumnMap; // maps request keys to db columns, for both create + update
  createSchema: z.ZodType<TCreate>;
  updateSchema: z.ZodType<Partial<TCreate>>;
}) {
  const router = Router();
  router.use(requireAuth);

  const selectBase = buildSelect(config.table, config.columns);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const rows = await query(
        `${selectBase} WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.userId]
      );
      res.json(rows);
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      const row = await queryOne(
        `${selectBase} WHERE id = $1 AND user_id = $2`,
        [req.params.id, req.userId]
      );
      if (!row) throw new ApiError(404, "Not found");
      res.json(row);
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const input = config.createSchema.parse(req.body);
      const entries = Object.entries(input).filter(([key]) => key in config.columns);
      const dbColumns = entries.map(([key]) => config.columns[key]);
      const values = entries.map(([, value]) => value);

      const placeholders = values.map((_, i) => `$${i + 2}`).join(", ");
      const row = await queryOne(
        `INSERT INTO ${config.table} (user_id, ${dbColumns.join(", ")})
         VALUES ($1, ${placeholders})
         RETURNING *`,
        [req.userId, ...values]
      );
      res.status(201).json(row);
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req, res) => {
      const input = config.updateSchema.parse(req.body);
      const entries = Object.entries(input).filter(([key]) => key in config.columns);

      if (entries.length === 0) throw new ApiError(400, "No valid fields to update");

      const setClauses = entries.map(([key], i) => `${config.columns[key]} = $${i + 3}`);
      const values = entries.map(([, value]) => value);

      const row = await queryOne(
        `UPDATE ${config.table}
         SET ${setClauses.join(", ")}
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [req.params.id, req.userId, ...values]
      );
      if (!row) throw new ApiError(404, "Not found");
      res.json(row);
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const row = await queryOne(
        `DELETE FROM ${config.table} WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, req.userId]
      );
      if (!row) throw new ApiError(404, "Not found");
      res.status(204).send();
    })
  );

  return router;
}
