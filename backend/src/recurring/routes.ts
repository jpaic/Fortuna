import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { processRecurring } from "./processor.js";

export const recurringRouter = Router();

// Manual trigger for testing — protected by auth
recurringRouter.post(
  "/process",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const result = await processRecurring();
    res.json(result);
  })
);
