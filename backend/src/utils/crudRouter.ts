import { Router } from "express";
import type { z } from "zod";
import { query, queryOne } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../middleware/error.js";

interface ColumnMap {
  [requestKey: string]: string;
}

function buildSelect(table: string, columns: ColumnMap, computedColumns?: ColumnMap): string {
  const aliases: string[] = [
    `id`,
    `user_id AS "userId"`,
    `created_at AS "createdAt"`,
  ];

  for (const [camel, snake] of Object.entries(columns)) {
    if (snake === "id" || snake === "user_id" || snake === "created_at") continue;
    aliases.push(`${snake} AS "${camel}"`);
  }

  if (computedColumns) {
    for (const [camel, snake] of Object.entries(computedColumns)) {
      aliases.push(`${snake} AS "${camel}"`);
    }
  }

  aliases.push(`updated_at AS "updatedAt"`);

  return `SELECT ${aliases.join(", ")} FROM ${table}`;
}

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;
function castRow(row: unknown): Record<string, unknown> {
  const obj = row as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string" && NUMERIC_RE.test(val)) {
      obj[key] = Number(val);
    }
  }
  return obj;
}

export function createCrudRouter<TCreate extends Record<string, unknown>>(config: {
  table: string;
  columns: ColumnMap;
  computedColumns?: ColumnMap;
  createSchema: z.ZodType<TCreate>;
  updateSchema: z.ZodType<Partial<TCreate>>;
  postMutation?: (userId: string, row?: Record<string, unknown>, input?: Record<string, unknown>) => Promise<void>;
}) {
  const router = Router();
  router.use(requireAuth);

  const selectBase = buildSelect(config.table, config.columns, config.computedColumns);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const rows = await query(
        `${selectBase} WHERE user_id = $1 ORDER BY created_at DESC`,
        [req.userId]
      );
      res.json(rows.map(castRow));
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
      res.json(castRow(row));
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
      if (config.postMutation) await config.postMutation(req.userId!, (row as Record<string, unknown>) ?? undefined, input as Record<string, unknown>);
      res.status(201).json(castRow(row));
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
      if (config.postMutation) await config.postMutation(req.userId!, (row as Record<string, unknown>) ?? undefined, input as Record<string, unknown>);
      res.json(castRow(row));
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      const row = await queryOne(
        `DELETE FROM ${config.table} WHERE id = $1 AND user_id = $2 RETURNING *`,
        [req.params.id, req.userId]
      );
      if (!row) throw new ApiError(404, "Not found");
      if (config.postMutation) await config.postMutation(req.userId!, row as Record<string, unknown>);
      res.status(204).send();
    })
  );

  return router;
}
