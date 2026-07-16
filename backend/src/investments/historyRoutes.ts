import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { query } from "../db/pool.js";

export const investmentHistoryRouter = Router();
investmentHistoryRouter.use(requireAuth);

/**
 * GET /api/investments/history?investmentId=X
 * Returns value history for a single investment.
 */
investmentHistoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const investmentId = String(req.query.investmentId ?? "");
    if (!investmentId) {
      res.status(400).json({ error: "investmentId is required" });
      return;
    }

    const rows = await query<{ recordedDate: string; value: string }>(
      `SELECT recorded_date AS "recordedDate", value
       FROM investment_value_history
       WHERE investment_id = $1 AND user_id = $2
       ORDER BY recorded_date ASC`,
      [investmentId, req.userId]
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
 * GET /api/investments/history/all
 * Returns value history for ALL investments, grouped by investment.
 */
investmentHistoryRouter.get(
  "/all",
  asyncHandler(async (req, res) => {
    const rows = await query<{
      investmentId: string;
      assetName: string;
      ticker: string;
      recordedDate: string;
      value: string;
    }>(
      `SELECT i.id AS "investmentId",
              i.asset_name AS "assetName",
              i.ticker,
              h.recorded_date AS "recordedDate",
              h.value
       FROM investment_value_history h
       JOIN investments i ON i.id = h.investment_id
       WHERE h.user_id = $1
       ORDER BY h.recorded_date ASC`,
      [req.userId]
    );

    res.json(
      rows.map((r) => ({
        investmentId: r.investmentId,
        assetName: r.assetName,
        ticker: r.ticker,
        date: new Date(r.recordedDate).toISOString().slice(0, 10),
        value: Number(r.value),
      }))
    );
  })
);

/**
 * POST /api/investments/history
 * Record a historical value point for an investment (manual backfill).
 */
investmentHistoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { investmentId, value, date } = req.body as {
      investmentId: string;
      value: number;
      date: string;
    };

    if (!investmentId || value == null || !date) {
      res.status(400).json({ error: "investmentId, value, and date are required" });
      return;
    }

    await query(
      `INSERT INTO investment_value_history (investment_id, user_id, value, recorded_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (investment_id, recorded_date)
       DO UPDATE SET value = EXCLUDED.value`,
      [investmentId, req.userId, value, date]
    );

    res.status(201).json({ ok: true });
  })
);
