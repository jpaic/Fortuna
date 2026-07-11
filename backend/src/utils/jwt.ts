import jwt, { type SignOptions } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN ?? "30d") as SignOptions["expiresIn"];

export interface AccessTokenPayload {
  user_id: string;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
}

// Refresh tokens carry only the user id — they're validated against the
// hashed value stored in `refresh_tokens`, so the JWT signature alone is
// not sufficient to use one (supports revocation on logout).
export function signRefreshToken(userId: string): string {
  return jwt.sign({ user_id: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyRefreshToken(token: string): { user_id: string } {
  return jwt.verify(token, REFRESH_SECRET) as { user_id: string };
}
