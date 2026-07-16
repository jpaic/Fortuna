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
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
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
app.use("/api/assets", assetsRouter);
app.use("/api/assets/history", assetHistoryRouter);
app.use("/api/investments", investmentsRouter);
app.use("/api/investments", investmentSellRouter);
app.use("/api/investments/history", investmentHistoryRouter);
app.use("/api/income", incomeRouter);
app.use("/api/expenses", expensesRouter);
app.use("/api/snapshots", snapshotsRouter);
app.use("/api/prices", pricesRouter);
app.use("/api/recurring", recurringRouter);
app.use("/api/dashboard", analyticsRouter);

const CURRENCIES = "EUR,USD,GBP,CHF";
app.get(
  "/api/exchange-rates",
  requireAuth,
  asyncHandler(async (req, res) => {
    const from = String(req.query.from ?? "USD");
    const resp = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${CURRENCIES}`
    );
    if (!resp.ok) throw new Error("Failed to fetch rates");
    const data = await resp.json();
    res.json(data);
  })
);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

export default app;
