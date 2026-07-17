import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AuthResponse } from "../types";

// Access token is kept in memory only (never localStorage) to reduce XSS exposure.
// The refresh token lives in an HTTP-only cookie set by the backend.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// --- Session-expired callback ---
let _onSessionExpired: (() => void) | null = null;

export function onSessionExpired(cb: () => void) {
  _onSessionExpired = cb;
}

// --- Refresh logic ---
// The refresh promise resolves to the full AuthResponse so callers can access
// both the new access token and the user object. The interceptor only uses
// the accessToken field.
let refreshPromise: Promise<AuthResponse | null> | null = null;

async function refreshAccessToken(): Promise<AuthResponse | null> {
  try {
    const { data } = await axios.post<AuthResponse>(
      `${api.defaults.baseURL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    setAccessToken(data.accessToken);
    return data;
  } catch {
    setAccessToken(null);
    return null;
  }
}

/**
 * Attempt a silent refresh on mount. Returns the full auth response or null.
 * Primes refreshPromise so concurrent interceptor calls can reuse the result.
 */
export async function tryInitialRefresh(): Promise<AuthResponse | null> {
  refreshPromise = refreshAccessToken();
  try {
    return await refreshPromise;
  } finally {
    setTimeout(() => { refreshPromise = null; }, 3000);
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const url = original.url ?? "";
    const isAuthEndpoint = url.includes("/auth/");

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken();
      }

      const result = await refreshPromise;

      setTimeout(() => { refreshPromise = null; }, 3000);

      if (result) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${result.accessToken}`;
        return api(original);
      }

      // Refresh failed — notify AuthContext (NO page reload).
      refreshPromise = null;
      setAccessToken(null);
      _onSessionExpired?.();
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);
