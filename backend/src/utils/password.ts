import bcrypt from "bcrypt";
import { createHash } from "node:crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Refresh tokens and verification tokens are stored as SHA-256 hashes, not
// plaintext, so a database read alone can't be replayed as a valid token.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
