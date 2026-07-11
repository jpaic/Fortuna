import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "Ledger <no-reply@example.com>";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${FRONTEND_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Confirm your email",
    html: `<p>Welcome to Ledger. Confirm your email to activate your account:</p>
           <p><a href="${link}">${link}</a></p>
           <p>This link expires in 24 hours.</p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your password",
    html: `<p>We received a request to reset your password.</p>
           <p><a href="${link}">${link}</a></p>
           <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  });
}
