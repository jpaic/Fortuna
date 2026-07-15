import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { query } from "../db/pool.js";

export const assetHistoryRouter = Router();
assetHistoryRouter.use(requireAuth);

interface HistoryRow {
  recordedDate: string;
  value: number;
}

interface AllHistoryRow {
  assetName: string;
  category: string;
  recordedDate: string;
  value: number;
}

/**
 * GET /api/assets/history?assetId=X
 * Returns value history for a single asset.
 */
assetHistoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const assetId = String(req.query.assetId ?? "");
    if (!assetId) {
      res.status(400).json({ error: "assetId is required" });
      return;
    }

    const rows = await query<HistoryRow>(
      `SELECT recorded_date AS "recordedDate", value
       FROM asset_value_history
       WHERE asset_id = $1 AND user_id = $2
       ORDER BY recorded_date ASC`,
      [assetId, req.userId]
    );

    res.json(
      rows.map((r) => ({
        date: new Date(r.recordedDate).toISOString().slice(0, 10),
        value: Number(r.value),
      }))
    );
  })
);

/**
 * GET /api/assets/history/all
 * Returns value history for ALL assets, grouped by asset.
 * Used by the dashboard chart.
 */
assetHistoryRouter.get(
  "/all",
  asyncHandler(async (req, res) => {
    const rows = await query<AllHistoryRow>(
      `SELECT a.name AS "assetName",
              a.category,
              h.recorded_date AS "recordedDate",
              h.value
       FROM asset_value_history h
       JOIN assets a ON a.id = h.asset_id
       WHERE h.user_id = $1
       ORDER BY h.recorded_date ASC`,
      [req.userId]
    );

    res.json(
      rows.map((r) => ({
        assetName: r.assetName,
        category: r.category,
        date: new Date(r.recordedDate).toISOString().slice(0, 10),
        value: Number(r.value),
      }))
    );
  })
);
