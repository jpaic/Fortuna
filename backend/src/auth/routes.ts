import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import * as authService from "./service.js";
import {
  registerSchema,
  loginSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "./schemas.js";

export const authRouter = Router();

const REFRESH_COOKIE = "refresh_token";
const isProd = process.env.NODE_ENV === "production";

function setRefreshCookie(res: import("express").Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.register(input);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { user, accessToken, refreshToken } = await authService.login(email, password);
    setRefreshCookie(res, refreshToken);
    res.json({ user, accessToken });
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ error: "No refresh token" });

    const { user, accessToken, refreshToken } = await authService.refresh(token);
    setRefreshCookie(res, refreshToken);
    res.json({ user, accessToken });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).send();
  })
);

authRouter.get(
  "/verify",
  asyncHandler(async (req, res) => {
    const token = String(req.query.token ?? "");
    await authService.verifyEmail(token);
    res.json({ success: true });
  })
);

authRouter.post(
  "/password-reset/request",
  asyncHandler(async (req, res) => {
    const { email } = requestPasswordResetSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    // Always 200, regardless of whether the email exists (see service.ts note)
    res.json({ success: true });
  })
);

authRouter.post(
  "/password-reset/confirm",
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, newPassword);
    res.json({ success: true });
  })
);
