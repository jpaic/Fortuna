import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema, type RegisterInput } from "../lib/schemas";
import { useAuth } from "../context/AuthContext";
import type { AxiosError } from "axios";

const inputClass =
  "w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none";

export function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    try {
      await registerUser(data);
      navigate("/verify-email");
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      const msg =
        axiosErr.response?.data?.error ??
        (err instanceof Error ? err.message : "Could not create account. Please try again.");
      setServerError(msg);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-xl font-semibold text-white">Create your account</h1>
        <p className="mt-1 text-sm text-slate-400">Start tracking your net worth today.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-slate-400">First name</label>
              <input {...register("firstName")} className={inputClass} />
              {errors.firstName && (
                <p className="mt-1 text-xs text-rose-400">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Last name</label>
              <input {...register("lastName")} className={inputClass} />
              {errors.lastName && (
                <p className="mt-1 text-xs text-rose-400">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Email</label>
            <input {...register("email")} type="email" className={inputClass} />
            {errors.email && <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Password</label>
            <input {...register("password")} type="password" className={inputClass} />
            {errors.password && (
              <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-400">Confirm password</label>
            <input {...register("confirmPassword")} type="password" className={inputClass} />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-rose-400">{errors.confirmPassword.message}</p>
            )}
          </div>

          {serverError && <p className="text-sm text-rose-400">{serverError}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
