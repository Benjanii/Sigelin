import { jwtDecode } from "jwt-decode"; // o usa la versión sin dependencia que ya te di

export function saveToken(token) { localStorage.setItem("token", token); }
export function getToken() { return localStorage.getItem("token"); }
export function clearToken() { localStorage.removeItem("token"); }

export function getRoleFromToken() {
  const t = getToken();
  if (!t) return null;
  try { return jwtDecode(t)?.role || null; } catch { return null; }
}

// permisos
const PERMS = {
  ADMIN:    ["inventory:read","inventory:write","repairs:read","repairs:write","parts:read","parts:write","purchases:write","reports:read","users:admin"],
  TECH:     ["inventory:read","repairs:read","repairs:write","parts:read","reports:read"],
  DIRECTOR: ["inventory:read","reports:read"]
};

export function can(perm) {
  const role = getRoleFromToken();
  if (!role) return false;
  return (PERMS[role] || []).includes(perm);
}

export function getUsernameFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const d = jwtDecode(token);
    return d?.sub || d?.username || null;
  } catch {
    return null;
  }
}