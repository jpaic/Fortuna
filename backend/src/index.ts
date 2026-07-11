import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { authRouter } from "./auth/routes.js";
import { usersRouter } from "./users/routes.js";
import { assetsRouter } from "./assets/routes.js";
import { investmentsRouter } from "./investments/routes.js";
import { incomeRouter } from "./income/routes.js";
import { expensesRouter } from "./expenses/routes.js";
import { analyticsRouter } from "./analytics/dashboard.js";
import { errorHandler } from "./middleware/error.js";
import { asyncHandler } from "./middleware/error.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300 }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: "Too many attempts. Try again later." },
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/users", usersRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/investments", investmentsRouter);
app.use("/api/income", incomeRouter);
app.use("/api/expenses", expensesRouter);
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

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
