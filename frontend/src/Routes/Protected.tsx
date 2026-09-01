import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function Protected() {
  const { token, user } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
