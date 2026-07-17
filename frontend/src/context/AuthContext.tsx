import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, onSessionExpired, setAccessToken, tryInitialRefresh } from "../lib/api";
import type { AuthResponse, User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUserNull = useCallback(() => setUser(null), []);

  // Register session-expired handler so the api interceptor can clear user
  // state on refresh failure WITHOUT doing a full page reload (which causes
  // infinite redirect loops).
  useEffect(() => {
    onSessionExpired(setUserNull);
  }, [setUserNull]);

  // On mount, try to silently refresh using the HTTP-only cookie so a page
  // reload doesn't force a re-login.
  useEffect(() => {
    (async () => {
      try {
        const result = await tryInitialRefresh();
        if (result) {
          setAccessToken(result.accessToken);
          setUser(result.user);
        } else {
          setAccessToken(null);
          setUser(null);
        }
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function register(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    await api.post<AuthResponse>("/auth/register", input);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
