import crypto from "node:crypto";
import { query, queryOne } from "../db/pool.js";
import { hashPassword, verifyPassword, hashToken } from "../utils/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { ApiError } from "../middleware/error.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email.js";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  created_at: string;
}

function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
  };
}

const REFRESH_TOKEN_TTL_DAYS = 30;

async function issueTokenPair(userId: string, email: string, _attempt = 0): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken({ user_id: userId, email });
  const refreshToken = signRefreshToken(userId);

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  try {
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, hashToken(refreshToken), expiresAt]
    );
  } catch (e: unknown) {
    // Unique-violation on token_hash (extremely rare jti collision) — regenerate
    if ((e as { code?: string }).code === "23505" && _attempt < 3) {
      return issueTokenPair(userId, email, _attempt + 1);
    }
    throw e;
  }

  return { accessToken, refreshToken };
}

export async function register(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const existing = await queryOne(`SELECT id FROM users WHERE email = $1`, [input.email]);
  if (existing) throw new ApiError(409, "An account with that email already exists");

  const passwordHash = await hashPassword(input.password);
  const user = await queryOne<UserRow>(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.email, passwordHash, input.firstName, input.lastName]
  );
  if (!user) throw new ApiError(500, "Could not create account");

  await issueVerificationEmail(user.id, user.email);

  const tokens = await issueTokenPair(user.id, user.email);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(email: string, password: string) {
  const user = await queryOne<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
  if (!user) throw new ApiError(401, "Invalid email or password");

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) throw new ApiError(401, "Invalid email or password");

  if (!user.email_verified) throw new ApiError(403, "Please verify your email before logging in");

  const tokens = await issueTokenPair(user.id, user.email);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  let payload: { user_id: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await queryOne<{ id: string; revoked_at: string | null; expires_at: string }>(
    `SELECT id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2`,
    [tokenHash, payload.user_id]
  );

  if (!stored || stored.revoked_at || new Date(stored.expires_at) < new Date()) {
    throw new ApiError(401, "Refresh token is invalid or has been revoked");
  }

  const user = await queryOne<UserRow>(`SELECT * FROM users WHERE id = $1`, [payload.user_id]);
  if (!user) throw new ApiError(401, "User no longer exists");

  // Rotate: revoke the used token, issue a brand new pair
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [stored.id]);
  const tokens = await issueTokenPair(user.id, user.email);

  return { user: toPublicUser(user), ...tokens };
}

export async function logout(refreshToken: string) {
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [
    hashToken(refreshToken),
  ]);
}

async function issueVerificationEmail(userId: string, email: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await query(
    `INSERT INTO email_verification_tokens (user_id, token, purpose, expires_at)
     VALUES ($1, $2, 'email_verification', $3)`,
    [userId, token, expiresAt]
  );

  await sendVerificationEmail(email, token);
}

export async function verifyEmail(token: string) {
  const row = await queryOne<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    `SELECT id, user_id, expires_at, used_at FROM email_verification_tokens
     WHERE token = $1 AND purpose = 'email_verification'`,
    [token]
  );

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    throw new ApiError(400, "Verification link is invalid or has expired");
  }

  await query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [row.user_id]);
  await query(`UPDATE email_verification_tokens SET used_at = now() WHERE id = $1`, [row.id]);
}

export async function requestPasswordReset(email: string) {
  const user = await queryOne<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  // Always return success to the caller regardless of whether the email
  // exists, so this endpoint can't be used to enumerate registered accounts.
  if (!user) return;

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await query(
    `INSERT INTO email_verification_tokens (user_id, token, purpose, expires_at)
     VALUES ($1, $2, 'password_reset', $3)`,
    [user.id, token, expiresAt]
  );

  await sendPasswordResetEmail(email, token);
}

export async function resetPassword(token: string, newPassword: string) {
  const row = await queryOne<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    `SELECT id, user_id, expires_at, used_at FROM email_verification_tokens
     WHERE token = $1 AND purpose = 'password_reset'`,
    [token]
  );

  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    throw new ApiError(400, "Reset link is invalid or has expired");
  }

  const passwordHash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, row.user_id]);
  await query(`UPDATE email_verification_tokens SET used_at = now() WHERE id = $1`, [row.id]);
  // Invalidate all existing sessions on password change
  await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1`, [row.user_id]);
}

export async function resendVerificationEmail(userId: string, email: string) {
  const row = await queryOne<{ used_at: string | null }>(
    `SELECT used_at FROM email_verification_tokens
     WHERE user_id = $1 AND purpose = 'email_verification'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (row && !row.used_at) {
    throw new ApiError(429, "A verification email was already sent recently");
  }

  await issueVerificationEmail(userId, email);
}
