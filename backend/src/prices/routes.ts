import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { refreshUserPrices, getLastPriceUpdate, fetchSinglePrice } from "./service.js";

export const pricesRouter = Router();
pricesRouter.use(requireAuth);

// Simple in-memory rate limit: 1 refresh per user per hour
const lastRefresh = new Map<string, number>();
const ONE_HOUR = 60 * 60 * 1000;

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of lastRefresh) {
    if (now - ts > ONE_HOUR) lastRefresh.delete(key);
  }
}, 10 * 60 * 1000);

pricesRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    const now = Date.now();
    const last = lastRefresh.get(userId) ?? 0;

    if (now - last < ONE_HOUR) {
      const waitMin = Math.ceil((ONE_HOUR - (now - last)) / 60_000);
      res.status(429).json({
        error: `Rate limited. Try again in ${waitMin} minute${waitMin > 1 ? "s" : ""}.`,
      });
      return;
    }

    lastRefresh.set(userId, now);
    const result = await refreshUserPrices(userId);
    const lastUpdated = await getLastPriceUpdate(userId);

    res.json({ ...result, lastUpdated });
  })
);

pricesRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    const lastUpdated = await getLastPriceUpdate(req.userId!);
    const last = lastRefresh.get(req.userId!) ?? 0;
    const now = Date.now();
    const canRefresh = now - last >= ONE_HOUR;
    const waitMin = canRefresh ? 0 : Math.ceil((ONE_HOUR - (now - last)) / 60_000);

    res.json({ lastUpdated, canRefresh, waitMinutes: waitMin });
  })
);

pricesRouter.get(
  "/quote",
  asyncHandler(async (req, res) => {
    const ticker = String(req.query.ticker ?? "").toUpperCase();
    const type = String(req.query.type ?? "stock");
    const currency = String(req.query.currency ?? "EUR");

    if (!ticker) {
      res.status(400).json({ error: "ticker is required" });
      return;
    }

    const price = await fetchSinglePrice(ticker, type, currency);
    if (price === null) {
      res.status(404).json({ error: "Price not found" });
      return;
    }
    res.json({ price });
  })
);
