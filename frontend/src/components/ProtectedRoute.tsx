import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FullScreenLoader } from "./ui/LoadingSpinner";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader text="Loading…" />;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!user.emailVerified) return <Navigate to="/verify-email" replace />;

  return <Outlet />;
}
