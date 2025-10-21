import { Navigate } from "react-router-dom";
import { getToken, getRoleFromToken } from "./auth";

export default function ProtectedRoute({ children, rolesPermitidos }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  if (rolesPermitidos && rolesPermitidos.length > 0) {
    const role = getRoleFromToken();
    if (!rolesPermitidos.includes(role)) return <Navigate to="/login" replace />;
  }
  return children;
}
