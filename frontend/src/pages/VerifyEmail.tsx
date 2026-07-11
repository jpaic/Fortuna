import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">(
    token ? "loading" : "idle"
  );
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get(`/auth/verify?token=${token}`)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  async function resendEmail() {
    setResending(true);
    try {
      await api.post("/auth/resend-verification");
      setResent(true);
    } catch {
      // silently fail
    } finally {
      setResending(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        Verifying your email…
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Email verified</h1>
          <p className="mt-2 text-sm text-slate-400">
            Your account is now active. Please sign in to continue.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Verification failed</h1>
          <p className="mt-2 text-sm text-slate-400">
            This link is invalid or has expired.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Check your email</h1>
        <p className="mt-2 text-sm text-slate-400">
          We sent a verification link to your email address. Click the link to
          activate your account.
        </p>

        {resent ? (
          <p className="mt-4 text-sm text-emerald-400">Verification email resent.</p>
        ) : (
          <button
            onClick={resendEmail}
            disabled={resending}
            className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend verification email"}
          </button>
        )}

        <Link
          to="/login"
          className="mt-4 block text-center text-sm text-slate-400 hover:text-white"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
