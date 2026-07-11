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

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true, // required so the refresh-token cookie is sent/received
  })
);
app.use(express.json());
app.use(cookieParser());

// Generous global limit; auth endpoints get a stricter one below to slow
// down credential-stuffing / brute-force attempts specifically.
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

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use(errorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
