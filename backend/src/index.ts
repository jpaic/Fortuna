import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

const helmetFn = helmet as unknown as (...args: unknown[]) => express.Handler;
const rateLimitFn = rateLimit as unknown as (...args: unknown[]) => express.Handler;

import { authRouter } from "./auth/routes.js";
import { usersRouter } from "./users/routes.js";
import { assetsRouter } from "./assets/routes.js";
import { assetHistoryRouter } from "./assets/historyRoutes.js";
import { investmentsRouter } from "./investments/routes.js";
import { investmentSellRouter } from "./investments/sellRoutes.js";
import { investmentBuyRouter } from "./investments/buyRoutes.js";
import { investmentHistoryRouter } from "./investments/historyRoutes.js";
import { incomeRouter } from "./income/routes.js";
import { expensesRouter } from "./expenses/routes.js";
import { analyticsRouter } from "./analytics/dashboard.js";
import { snapshotsRouter } from "./snapshots/routes.js";
import { pricesRouter } from "./prices/routes.js";
import { recurringRouter } from "./recurring/routes.js";
import { errorHandler } from "./middleware/error.js";
import { asyncHandler } from "./middleware/error.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

if (process.env.VERCEL) app.set("trust proxy", 1);

app.use(helmetFn());
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_URL?.replace(/\/+$/, ""),
        "http://localhost:5173",
      ].filter(Boolean) as string[];
      // Allow requests with no origin (same-origin, curl, server-to-server)
      // or if the origin is in the allowed list.
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use(rateLimitFn({ windowMs: 15 * 60 * 1000, limit: 300 }));

const authLimiter = rateLimitFn({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: "Too many attempts. Try again later." },
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/users", usersRouter);
app.use("/api/assets/history", assetHistoryRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/investments/history", investmentHistoryRouter);
app.use("/api/investments", investmentsRouter);
app.use("/api/investments", investmentSellRouter);
app.use("/api/investments", investmentBuyRouter);
app.use("/api/income", incomeRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/snapshots", snapshotsRouter);
app.use("/api/prices", pricesRouter);
app.use("/api/recurring", recurringRouter);
app.use("/api/dashboard", analyticsRouter);

const CURRENCIES = "EUR,USD,GBP,CHF,RSD";

// In-memory cache for exchange rates (1 hour TTL — rates change infrequently)
const ratesCache = new Map<string, { data: Record<string, number>; ts: number }>();
const RATES_TTL = 60 * 60 * 1000;

app.get(
  "/api/exchange-rates",
  requireAuth,
  asyncHandler(async (req, res) => {
    const from = String(req.query.from ?? "EUR").toUpperCase();
    const cached = ratesCache.get(from);
    if (cached && Date.now() - cached.ts < RATES_TTL) {
      res.json({ rates: cached.data });
      return;
    }

    const resp = await fetch(
      `https://open.er-api.com/v6/latest/${from}`
    );
    if (!resp.ok) throw new Error("Failed to fetch rates");
    const data = (await resp.json()) as { rates?: Record<string, number> };
    const allowed = ["EUR", "USD", "GBP", "CHF", "RSD"];
    const filtered: Record<string, number> = {};
    for (const c of allowed) {
      if (data.rates?.[c] != null) filtered[c] = data.rates[c];
    }
    ratesCache.set(from, { data: filtered, ts: Date.now() });
    res.json({ rates: filtered });
  })
);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

export default app;
