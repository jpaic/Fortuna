import { Router } from "express";
import { queryOne } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await queryOne(
      `SELECT id, email, first_name, last_name, email_verified, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    res.json(user);
  })
);
