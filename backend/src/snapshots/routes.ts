import { Router } from "express";
import { z } from "zod";
import { query, queryOne } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, ApiError } from "../middleware/error.js";

export const snapshotsRouter = Router();
snapshotsRouter.use(requireAuth);

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

const SELECT = `
  SELECT id, user_id AS "userId", snapshot_date AS "snapshotDate",
         total_assets AS "totalAssets", total_liabilities AS "totalLiabilities",
         net_worth AS "netWorth", created_at AS "createdAt"
  FROM net_worth_snapshots
`;

const createSchema = z.object({
  snapshotDate: z.string(),
  totalAssets: z.number().min(0),
  totalLiabilities: z.number().min(0).default(0),
});

const updateSchema = createSchema.partial();

snapshotsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await query(
      `${SELECT} WHERE user_id = $1 ORDER BY snapshot_date ASC`,
      [req.userId]
    );
    res.json(rows.map(castRow));
  })
);

snapshotsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const row = await queryOne(
      `INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_assets, total_liabilities)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, snapshot_date)
       DO UPDATE SET total_assets = EXCLUDED.total_assets, total_liabilities = EXCLUDED.total_liabilities
       RETURNING *`,
      [req.userId, input.snapshotDate, input.totalAssets, input.totalLiabilities]
    );
    res.status(201).json(castRow(row));
  })
);

snapshotsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const entries = Object.entries(input).map(([key, value]) => {
      const col =
        key === "snapshotDate"
          ? "snapshot_date"
          : key === "totalAssets"
            ? "total_assets"
            : "total_liabilities";
      return [col, value] as const;
    });

    if (entries.length === 0) throw new ApiError(400, "No valid fields to update");

    const setClauses = entries.map(([col], i) => `${col} = $${i + 3}`);
    const values = entries.map(([, v]) => v);

    const row = await queryOne(
      `UPDATE net_worth_snapshots
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.userId, ...values]
    );
    if (!row) throw new ApiError(404, "Not found");
    res.json(castRow(row));
  })
);

snapshotsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const row = await queryOne(
      `DELETE FROM net_worth_snapshots WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.userId]
    );
    if (!row) throw new ApiError(404, "Not found");
    res.status(204).send();
  })
);
